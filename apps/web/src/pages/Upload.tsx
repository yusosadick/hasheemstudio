import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { IconUploadCloud } from "../components/Icons";
import { useVideoUpload, RECIPE_OPTIONS } from "../hooks/useVideoUpload";

export default function Upload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { stage, recipe, setRecipe, progress, error, resumeNotice, handleFile, dismissResumeNotice } = useVideoUpload({
    // Preserves this page's existing behaviour: navigate to the job page as soon as the job
    // exists, rather than watching processing progress inline (the homepage hero does that).
    onJobCreated: (jobId) => navigate(`/app/jobs/${jobId}`),
  });

  const busy = stage !== "idle" && stage !== "error";

  const stageLabel: Record<string, string> = {
    idle: "",
    uploading: progress
      ? `Uploading… ${Math.round((progress.sent / Math.max(progress.total, 1)) * 100)}%`
      : "Uploading your file…",
    finalizing: "Finalizing…",
    creating_job: "Queuing job…",
    error: "",
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Upload your video</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        Upload and process first. Sign in to download one free video per day, up to 100&nbsp;MB,
        2 minutes, and 1080p60. Interrupted uploads can resume when you choose the same file again.
      </p>

      {resumeNotice && (
        <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">{resumeNotice} <button className="underline" onClick={dismissResumeNotice}>Discard and start again</button></p>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        {RECIPE_OPTIONS.map((r) => (
          <label key={r.value} title={r.hint} className="flex items-center gap-2 text-sm">
            <input type="radio" disabled={busy} name="recipe" checked={recipe === r.value} onChange={() => setRecipe(r.value)} className="accent-accent" />
            {r.label}
          </label>
        ))}
      </div>

      <div
        className="mt-6 rounded-lg border-2 border-dashed border-border bg-surface1 p-10 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
      >
        <IconUploadCloud className="mx-auto text-accent" width={36} height={36} />
        <p className="mt-4 font-medium">Drag and drop your file here</p>
        <p className="mt-1 text-sm text-foreground-muted">or</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="mt-3 inline-flex min-h-touch items-center justify-center rounded-md border border-border px-5 text-sm font-medium hover:bg-surface2 disabled:opacity-60"
        >
          Choose a file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {busy && (
        <p className="mt-4 text-sm text-foreground-muted" role="status">
          {stageLabel[stage] ?? ""}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
    </div>
  );
}
