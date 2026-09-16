import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconUploadCloud } from "../components/Icons";
import { createUploadSession, putFileToStorage, finalizeUpload, createJob } from "../lib/api";

type Stage = "idle" | "creating_session" | "uploading" | "finalizing" | "creating_job" | "error";

const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export default function Upload() {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recipe, setRecipe] = useState<"inspect" | "remux">("remux");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  async function handleFile(file: File) {
    setError(null);
    try {
      setStage("creating_session");
      const session = await createUploadSession(file);

      setStage("uploading");
      await putFileToStorage(session.uploadUrl, file, ANON_KEY);

      setStage("finalizing");
      const finalized = await finalizeUpload(session.sessionId);

      setStage("creating_job");
      const job = await createJob(finalized.mediaAssetId, recipe);

      navigate(`/app/jobs/${job.jobId}`);
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  const stageLabel: Record<Stage, string> = {
    idle: "",
    creating_session: "Reserving upload…",
    uploading: "Uploading your file…",
    finalizing: "Finalizing…",
    creating_job: "Queuing job…",
    error: "",
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Upload your video</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        MP4 or MOV. Up to 100&nbsp;MB and 2 minutes on the Verified Free plan.
      </p>

      <div className="mt-6 flex gap-3">
        {(["remux", "inspect"] as const).map((r) => (
          <label key={r} className="flex items-center gap-2 text-sm">
            <input type="radio" name="recipe" checked={recipe === r} onChange={() => setRecipe(r)} className="accent-accent" />
            {r === "remux" ? "Compatible MP4 remux" : "Inspect only"}
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
