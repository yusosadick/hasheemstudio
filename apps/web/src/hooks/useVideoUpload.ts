// Shared upload + processing state machine, extracted so the homepage inline flow
// (ConversionHero) and the /app/upload fallback page (Upload.tsx) run the exact same
// tested logic instead of two copies drifting apart. Every stage transition here is driven
// by a real server response (upload byte offsets, finalize/job-creation responses, job-status
// polling) — nothing here fabricates progress or status text (docs/AGENTS.md evidence standard).
import { useCallback, useEffect, useRef, useState } from "react";
import { getSession } from "../lib/auth";
import { createUploadSession, finalizeUpload, createJob, getJob, cancelJob, type JobView } from "../lib/api";
import { uploadFileResumable, savePendingUpload, loadPendingUpload, clearPendingUpload, type PendingUpload } from "../lib/upload";

export type Recipe = "inspect" | "remux" | "compat_encode" | "platform_optimize";

// Single source of truth for the recipe choices shown on the homepage hero and /app/upload.
export const RECIPE_OPTIONS: { value: Recipe; label: string; hint: string }[] = [
  { value: "platform_optimize", label: "Platform-optimized (smaller file, recommended)", hint: "Re-encode to a bitrate suited to TikTok, Instagram and WhatsApp" },
  { value: "remux", label: "Compatible MP4 remux", hint: "Repackage only — no re-encode, same file size" },
  { value: "compat_encode", label: "H.264/AAC re-encode", hint: "High-quality H.264/AAC re-encode" },
  { value: "inspect", label: "Inspect only", hint: "Report only — no output video" },
];

export function recipeSummary(recipe: string): string {
  switch (recipe) {
    case "remux": return "Remux only — no re-encode";
    case "compat_encode": return "H.264/AAC re-encoded";
    case "platform_optimize": return "Platform-optimized H.264/AAC";
    default: return "Inspected";
  }
}

export type UploadStage =
  | "idle"
  | "uploading"
  | "finalizing"
  | "creating_job"
  | "queued"
  | "processing"
  | "verifying"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired"
  | "error";

export interface UploadProgress {
  sent: number;
  total: number;
}

export interface LogLine {
  id: number;
  text: string;
}

export interface UseVideoUploadOptions {
  /** Fires the instant a job row exists server-side, before its processing status is known.
   *  Upload.tsx uses this to navigate away immediately (its existing behaviour). The homepage
   *  hero leaves this unset and keeps watching real job-status polling on the same page. */
  onJobCreated?: (jobId: string) => void;
}

const TERMINAL_JOB_STATUSES = new Set(["succeeded", "failed", "cancelled", "expired"]);
const POLL_INTERVAL_MS = 1500;
const GUEST_MAX_BYTES = 100 * 1024 * 1024;

const STAGE_LOG: Record<string, string> = {
  queued: "Queued for processing…",
  processing: "Processing…",
  verifying: "Verifying output…",
  succeeded: "Done — your video is ready.",
  failed: "Processing failed.",
  cancelled: "Job cancelled.",
  expired: "Output expired.",
};

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(mb >= 10 ? 0 : 1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function useVideoUpload(options: UseVideoUploadOptions = {}) {
  const { onJobCreated } = options;
  const [recipe, setRecipe] = useState<Recipe>("platform_optimize");
  const [stage, setStage] = useState<UploadStage>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobView | null>(null);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [cancelling, setCancelling] = useState(false);

  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const cancelRequestedRef = useRef(false);
  const jobIdRef = useRef<string | null>(null);
  const lastJobStatusRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const logIdRef = useRef(0);

  const appendLog = useCallback((text: string) => {
    logIdRef.current += 1;
    setLog((prev) => [...prev.slice(-7), { id: logIdRef.current, text }]);
  }, []);

  useEffect(() => {
    const pending = loadPendingUpload();
    if (pending) {
      setResumeNotice(`You have an interrupted upload of "${pending.fileName}". Choose that same file again to resume from where it left off.`);
    }
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = undefined;
    }
  }, []);

  const pollJob = useCallback(
    (id: string) => {
      stopPolling();
      async function tick() {
        try {
          const view = await getJob(id);
          if (jobIdRef.current !== id) return; // superseded by a cancel or a newer upload
          setJob(view);
          if (lastJobStatusRef.current !== view.status) {
            lastJobStatusRef.current = view.status;
            appendLog(STAGE_LOG[view.status] ?? view.status);
          }
          if (TERMINAL_JOB_STATUSES.has(view.status)) {
            setStage(view.status as UploadStage);
            return;
          }
          setStage(view.status as UploadStage);
          pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        } catch {
          // A dropped poll request doesn't mean the job failed — it's still safely processing
          // server-side. Keep polling rather than surfacing a spurious error.
          if (jobIdRef.current === id) pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        }
      }
      void tick();
    },
    [appendLog, stopPolling],
  );

  const resetToIdle = useCallback(() => {
    stopPolling();
    jobIdRef.current = null;
    lastJobStatusRef.current = null;
    cancelRequestedRef.current = false;
    setStage("idle");
    setFile(null);
    setError(null);
    setProgress(null);
    setJobId(null);
    setJob(null);
    setLog([]);
    setCancelling(false);
  }, [stopPolling]);

  const dismissResumeNotice = useCallback(() => {
    clearPendingUpload();
    setResumeNotice(null);
  }, []);

  const handleFile = useCallback(
    async (selected: File) => {
      if (busyRef.current) return;
      if (!/\.(mp4|mov)$/i.test(selected.name) || selected.size <= 0) {
        setError("Choose a non-empty MP4 or MOV video.");
        setStage("error");
        return;
      }
      if (selected.size > GUEST_MAX_BYTES && !getSession()) {
        setError("Guest videos must be 100 MB or smaller.");
        setStage("error");
        return;
      }

      busyRef.current = true;
      cancelRequestedRef.current = false;
      lastJobStatusRef.current = null;
      jobIdRef.current = null;
      setFile(selected);
      setError(null);
      setJob(null);
      setJobId(null);
      setProgress(null);
      setLog([]);
      setStage("uploading");
      appendLog(`Selected ${selected.name} (${formatBytes(selected.size)}).`);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const pending = loadPendingUpload();
        let session: PendingUpload;
        if (
          pending &&
          pending.fileName === selected.name &&
          pending.fileSize === selected.size &&
          pending.fileModified === selected.lastModified
        ) {
          session = pending;
          appendLog("Resuming interrupted upload…");
        } else {
          const created = await createUploadSession(selected);
          session = {
            ...created,
            fileName: selected.name,
            fileSize: selected.size,
            fileModified: selected.lastModified,
            idempotencyKey: crypto.randomUUID(),
          };
          savePendingUpload(session);
        }
        setResumeNotice(null);
        // A cancel clicked during createUploadSession's round trip arrives before any fetch is
        // listening on controller.signal (uploadFileResumable hasn't started yet) — check here too,
        // not just after the byte transfer, so it can't be silently ignored.
        if (cancelRequestedRef.current) throw new DOMException("Cancelled before upload started.", "AbortError");

        if (!session.mediaAssetId) {
          appendLog("Uploading…");
          await uploadFileResumable(selected, session.tusUploadPath, {
            signal: controller.signal,
            onProgress: (sent, total) => setProgress({ sent, total }),
          });
          appendLog("Upload complete.");

          setStage("finalizing");
          appendLog("Finalizing upload…");
          const finalized = await finalizeUpload(session.sessionId);
          session = { ...session, mediaAssetId: finalized.mediaAssetId };
          savePendingUpload(session);
        }

        if (cancelRequestedRef.current) throw new DOMException("Cancelled before processing started.", "AbortError");

        setStage("creating_job");
        appendLog("Queuing processing job…");
        const created = await createJob(session.mediaAssetId!, recipe, session.idempotencyKey);
        clearPendingUpload();
        jobIdRef.current = created.jobId;
        setJobId(created.jobId);
        onJobCreated?.(created.jobId);

        if (cancelRequestedRef.current) {
          await cancelJob(created.jobId).catch(() => {});
          resetToIdle();
          return;
        }

        lastJobStatusRef.current = created.status;
        setStage(created.status as UploadStage);
        appendLog(STAGE_LOG[created.status] ?? created.status);
        // A caller that supplied onJobCreated (Upload.tsx) is about to navigate away right now —
        // starting the poll loop would just be wasted requests against an unmounting page. The
        // homepage hero leaves onJobCreated unset and relies on this polling for its inline view.
        if (!onJobCreated) pollJob(created.jobId);
      } catch (err) {
        if (cancelRequestedRef.current || (err instanceof DOMException && err.name === "AbortError")) {
          resetToIdle();
        } else {
          setStage("error");
          const message = err instanceof Error ? err.message : "Upload failed";
          setError(message);
          appendLog(message);
        }
      } finally {
        busyRef.current = false;
        abortRef.current = null;
      }
    },
    [appendLog, onJobCreated, pollJob, recipe, resetToIdle],
  );

  const cancel = useCallback(() => {
    cancelRequestedRef.current = true;
    setCancelling(true);
    if (stage === "uploading" && abortRef.current) {
      abortRef.current.abort();
      return;
    }
    const currentJobId = jobIdRef.current;
    if (currentJobId && !TERMINAL_JOB_STATUSES.has(stage)) {
      stopPolling();
      void cancelJob(currentJobId)
        .then(() => resetToIdle())
        .catch((err) => {
          setCancelling(false);
          setError(err instanceof Error ? err.message : "Could not cancel the job.");
        });
    }
    // Otherwise a cancel arrived mid-finalize/mid-create-job, with no controller or job id to
    // act on yet — cancelRequestedRef is checked right after those awaits above and unwinds
    // cleanly (releasing the just-created job, if any) once they settle.
  }, [stage, stopPolling, resetToIdle]);

  return {
    recipe,
    setRecipe,
    stage,
    file,
    error,
    progress,
    jobId,
    job,
    resumeNotice,
    log,
    cancelling,
    handleFile,
    cancel,
    reset: resetToIdle,
    dismissResumeNotice,
  };
}
