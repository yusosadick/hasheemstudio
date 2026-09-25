import { DownloadUpgrade } from "../components/DownloadUpgrade";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { IconCheckCircle, IconDownload, IconAlertTriangle } from "../components/Icons";
import { getSession } from "../lib/auth";
import { getJob, cancelJob, requestDownload, DownloadError, type JobView } from "../lib/api";
import { recipeSummary } from "../hooks/useVideoUpload";

const TERMINAL = new Set(["succeeded", "failed", "cancelled", "expired"]);
const STAGES = ["queued", "processing", "verifying", "succeeded"];

export default function JobResult() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [limitReached,setLimitReached] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  async function download() {
    if (!id || unlocking) return;
    setUnlocking(true); setDownloadError(null);
    try { window.location.assign(await requestDownload(id)); }
    catch (err) {
      if (err instanceof DownloadError && ["login_required", "session_required", "account_not_verified", "invalid_token"].includes(err.code)) setNeedsLogin(true);
      if (err instanceof DownloadError && err.code === 'daily_download_limit') setLimitReached(true);
      setDownloadError(err instanceof Error ? err.message : "Download failed.");
    } finally { setUnlocking(false); }
  }
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const view = await getJob(id!);
        if (cancelled) return;
        setJob(view);
        if (!TERMINAL.has(view.status)) {
          timer = setTimeout(poll, 1500);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load job");
      }
    }
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  if (error) return <p className="mx-auto max-w-3xl px-4 py-12 text-danger sm:px-6">{error}</p>;
  if (!job) return <p className="mx-auto max-w-3xl px-4 py-12 text-foreground-muted sm:px-6">Loading…</p>;

  const stageIndex = STAGES.indexOf(job.status);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          {job.status === "succeeded" ? "Job complete" : `Job ${job.status}`}
        </h1>
        {job.status === "succeeded" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
            <IconCheckCircle width={16} height={16} /> {String(job.verificationReport?.verification_level ?? "").startsWith("remux") && job.recipe !== "remux" ? "Kept as-is (HDR) — no re-encode" : recipeSummary(job.recipe)}
          </span>
        )}
        {job.status === "failed" && (
          <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-3 py-1 text-sm font-medium text-danger">
            <IconAlertTriangle width={16} height={16} /> Failed
          </span>
        )}
      </div>

      {!TERMINAL.has(job.status) && (
        <div className="mt-6">
          <ol className="flex items-center gap-2">
            {STAGES.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
                    i <= stageIndex ? "border-accent bg-accent/10 text-accent-text" : "border-border text-foreground-muted"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="text-sm capitalize text-foreground-muted">{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-foreground-muted">Attempt {job.attemptCount}. Updating…</p>
          <button
            type="button"
            onClick={() => id && cancelJob(id)}
            className="mt-4 rounded-md border border-border px-4 py-2 text-sm hover:bg-surface1"
          >
            Cancel job
          </button>
        </div>
      )}

      {job.errorMessage && <p className="mt-4 text-sm text-danger">{job.errorMessage}</p>}

      {job.verificationReport && (
        <div className="mt-8 rounded-lg border border-border bg-surface1 p-4">
          <p className="text-sm font-medium">Verification report</p>
          <pre className="mt-2 overflow-x-auto text-xs text-foreground-muted">
            {JSON.stringify(job.verificationReport, null, 2)}
          </pre>
        </div>
      )}

      {job.status === "succeeded" && job.hasOutput && !job.outputExpired && (
        <section className="mt-8 rounded-lg border border-border bg-surface1 p-6">
          <h2 className="text-xl font-semibold">Your video is ready</h2>
          {(job.requiresLogin || needsLogin || !getSession()) ? (
            <>
              <p className="mt-2 text-sm text-foreground-muted">Sign in or create an account to download. Your processed video is saved here—no need to upload it again.</p>
              <Link to={`/login?next=${encodeURIComponent(`/app/jobs/${id}`)}`} className="mt-5 inline-flex min-h-touch items-center rounded-md bg-gradient-primary px-6 text-sm font-semibold">Sign in to download</Link>
              <Link to={`/signup?next=${encodeURIComponent(`/app/jobs/${id}`)}`} className="ml-4 inline-flex min-h-touch items-center text-sm underline">Create free account</Link>
            </>
          ) : (
            <button type="button" disabled={unlocking} onClick={() => void download()} className="mt-5 inline-flex min-h-touch items-center gap-2 rounded-md bg-gradient-primary px-6 text-sm font-semibold disabled:opacity-60">
              <IconDownload width={18} height={18} />{unlocking ? "Preparing download…" : "Download video"}
            </button>
          )}
          <p className="mt-3 text-xs text-foreground-muted">Free: 1 video per day, up to 100 MB. Resets at midnight UTC. Downloading the same unlocked video again does not use another allowance.</p>
          {downloadError && <p role="alert" className="mt-4 text-sm text-danger">{downloadError}</p>}
          {limitReached && <DownloadUpgrade jobId={id!} />}
          {job.outputRetainUntil && <p className="mt-3 text-xs text-foreground-muted">Available until {new Date(job.outputRetainUntil).toLocaleString()}.</p>}
        </section>
      )}
      {job.outputExpired && (
        <p className="mt-8 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <IconAlertTriangle width={18} height={18} className="shrink-0 text-warning" />
          This output has passed its retention period and been permanently deleted.
        </p>
      )}
    </div>
  );
}
