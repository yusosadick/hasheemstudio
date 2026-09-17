import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconUploadCloud } from "../components/Icons";
import { createUploadSession, finalizeUpload, createJob } from "../lib/api";
import { uploadFileResumable, savePendingUpload, loadPendingUpload, clearPendingUpload } from "../lib/upload";

type Stage = "idle" | "uploading" | "finalizing" | "creating_job" | "error";

export default function Upload() {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<"inspect" | "remux" | "compat_encode">("remux");
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const pending = loadPendingUpload();
    if (pending) {
      setResumeNotice(
        `You have an interrupted upload of "${pending.fileName}". Choose that same file again to resume from where it left off.`,
      );
    }
  }, []);

  async function handleFile(file: File) {
    setError(null);
    try {
      const pending = loadPendingUpload();
      let session: { sessionId: string; tusUploadPath: string };

      if (pending && pending.fileName === file.name && pending.fileSize === file.size) {
        // Same file re-selected after an interruption/reload — resume against the existing TUS
        // resource instead of starting a brand new upload session (and a brand new quota hold).
        session = { sessionId: pending.sessionId, tusUploadPath: pending.tusUploadPath };
      } else {
        session = await createUploadSession(file);
        savePendingUpload({ sessionId: session.sessionId, tusUploadPath: session.tusUploadPath, fileName: file.name, fileSize: file.size });
      }
      setResumeNotice(null);

      setStage("uploading");
      await uploadFileResumable(file, session.tusUploadPath, {
        onProgress: (sent, total) => setProgress({ sent, total }),
      });

      setStage("finalizing");
      const finalized = await finalizeUpload(session.sessionId);
      clearPendingUpload();

      setStage("creating_job");
      const job = await createJob(finalized.mediaAssetId, recipe);

      navigate(`/app/jobs/${job.jobId}`);
    } catch (err) {
      setStage("error");
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(`${message} — choose the same file again to resume from where it stopped.`);
    }
  }

  const stageLabel: Record<Stage, string> = {
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
        MP4 or MOV. Up to 100&nbsp;MB and 2 minutes on the Verified Free plan. Uploads resume
        automatically if your connection drops.
      </p>

      {resumeNotice && (
        <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">{resumeNotice}</p>
      )}

      <div className="mt-6 flex gap-3">
        {(["remux", "compat_encode", "inspect"] as const).map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm">
            <input type="radio" name="recipe" checked={recipe === r} onChange={() => setRecipe(r)} className="accent-accent" />
            {r === "remux" ? "Compatible MP4 remux" : r === "compat_encode" ? "H.264/AAC re-encode" : "Inspect only"}
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
          disabled={stage !== "idle" && stage !== "error"}
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
          }}
        />
      </div>

      {stage !== "idle" && stage !== "error" && (
        <p className="mt-4 text-sm text-foreground-muted" role="status">
          {stageLabel[stage]}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
    </div>
  );
}
