import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ResultCard } from "../components/ResultCard";
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

  if (TERMINAL.has(job.status)) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <ResultCard jobId={id!} job={job} standalone />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Preparing your video</h1>
      <div className="mt-6">
        <ol className="flex items-center gap-2">
          {STAGES.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${i <= stageIndex ? "border-accent bg-accent/10 text-accent-text" : "border-border text-foreground-muted"}`}>{i + 1}</span>
              <span className="text-sm capitalize text-foreground-muted">{s === "succeeded" ? "done" : s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-foreground-muted">Updating…</p>
        <button type="button" onClick={() => id && cancelJob(id)} className="mt-4 rounded-md border border-border px-4 py-2 text-sm hover:bg-surface1">Cancel job</button>
      </div>
    </div>
  );
}
