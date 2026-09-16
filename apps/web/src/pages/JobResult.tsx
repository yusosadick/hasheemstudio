import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { IconCheckCircle, IconDownload, IconAlertTriangle } from "../components/Icons";
import { getJob, cancelJob, type JobView } from "../lib/api";

const TERMINAL = new Set(["succeeded", "failed", "cancelled", "expired"]);
const STAGES = ["queued", "processing", "verifying", "succeeded"];

export default function JobResult() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<JobView | null>(null);
  const [error, setError] = useState<string | null>(null);

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
            <IconCheckCircle width={16} height={16} /> {job.recipe === "remux" ? "Remux only — no re-encode" : "Inspected"}
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
                    i <= stageIndex ? "border-accent bg-accent/10 text-accent" : "border-border text-foreground-muted"
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

      {job.downloadUrl && (
        <a
          href={job.downloadUrl}
          className="mt-8 inline-flex min-h-touch items-center gap-2 rounded-md bg-gradient-primary px-6 text-sm font-medium text-foreground-on-accent hover:opacity-90"
        >
          <IconDownload width={18} height={18} />
          Download output
        </a>
      )}
    </div>
  );
}
