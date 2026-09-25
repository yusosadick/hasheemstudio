import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FileVideo, FileCheck, RefreshCw, Pause, Play, UploadCloud, X, Loader2, Check } from "lucide-react";
import "./ConversionHero.css";
import { HeroBackdrop } from "./HeroBackdrop";
import { ResultCard } from "./ResultCard";
import { useVideoUpload, formatBytes, RECIPE_OPTIONS, type UploadStage } from "../hooks/useVideoUpload";

const ACTIVE_STAGES = new Set<UploadStage>([
  "uploading",
  "finalizing",
  "creating_job",
  "queued",
  "processing",
  "verifying",
]);

const TERMINAL_STAGES = new Set<UploadStage>(["succeeded", "failed", "expired"]);

// Four plain steps for the stepper; several internal stages collapse onto one step.
const STEPS = ["Upload", "Queue", "Process", "Verify"] as const;
const STEP_OF: Partial<Record<UploadStage, number>> = { uploading: 0, finalizing: 1, creating_job: 1, queued: 1, processing: 2, verifying: 3, succeeded: 4 };

// What the hero illustration is doing, per real pipeline stage.
function scenePhase(stage: UploadStage): string {
  if (stage === "uploading") return "upload";
  if (stage === "finalizing" || stage === "creating_job" || stage === "queued") return "queue";
  if (stage === "processing") return "process";
  if (stage === "verifying") return "verify";
  if (stage === "succeeded") return "done";
  if (stage === "failed" || stage === "expired") return "failed";
  return "idle";
}

const RECIPE_SHORT: Record<string, string> = { platform_optimize: "Smaller file", remux: "Quick repack", compat_encode: "Re-encode", inspect: "Inspect" };

const STAGE_LABEL: Record<UploadStage, string> = {
  idle: "",
  uploading: "Uploading…",
  finalizing: "Finalizing upload…",
  creating_job: "Queuing processing job…",
  queued: "Queued…",
  processing: "Processing…",
  verifying: "Verifying output…",
  succeeded: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
  expired: "Expired",
  error: "",
};

export function ConversionHero() {
  const [paused, setPaused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const upload = useVideoUpload();
  const { stage, file, progress, error, log, recipe, setRecipe, resumeNotice, jobId, job, reset, handleFile, cancel, cancelling, dismissResumeNotice } = upload;

  const active = ACTIVE_STAGES.has(stage);
  const canPick = stage === "idle" || stage === "error";

  // The whole pipeline — upload, processing and the finished result with its download button — plays out
  // in this one card; nothing navigates away.
  const terminal = TERMINAL_STAGES.has(stage);
  const focus = active || terminal;
  const phase = scenePhase(stage);
  const step = STEP_OF[stage] ?? -1;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) void handleFile(picked);
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (!canPick) return;
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) void handleFile(dropped);
  }

  const uploadPercent = progress ? Math.min(100, Math.round((progress.sent / Math.max(progress.total, 1)) * 100)) : 0;
  const indeterminate = active && stage !== "uploading";
  const barPercent = stage === "uploading" ? uploadPercent : 100;

  return (
    <div className="conversion-hero" data-focus={focus || undefined}>
      <HeroBackdrop paused={paused} />
      <div className="conversion-hero__stage">
        <div className="conversion-hero__copy">
          <p className="conversion-hero__eyebrow">Hasheem Studio video tools</p>
          {!focus && (<>
          <h1>Prepare your video<br className="conversion-hero__title-break" /> for upload</h1>
          <p className="conversion-hero__description">
            Inspect, fix compatibility issues, and create a platform-ready video—with a clear report of exactly what changed.
          </p>
          </>)}
        </div>

        <div className="conversion-scene" data-paused={paused} data-phase={phase} style={{ ["--p" as string]: uploadPercent / 100 }}>
          <div className="conversion-scene__visual" role="img" aria-label="Illustration: prepare a MOV or MP4 video as a compatible MP4 with H.264 video and AAC audio.">
            <div className="conversion-scene__ring conversion-scene__ring--outer" />
            <div className="conversion-scene__ring conversion-scene__ring--inner" />
            <div className="conversion-scene__row" aria-hidden="true">
              <div className="format-tile">
                <div className="format-tile__face format-tile__face--mov"><FileVideo /><strong>MOV</strong></div>
                <div className="format-tile__face format-tile__face--mp4"><FileVideo /><strong>MP4</strong></div>
              </div>
              <div className="conversion-bridge">
                <span className="conversion-bridge__line"><i /></span>
                <div className="conversion-bridge__hub"><RefreshCw /><span /></div>
                <span className="conversion-bridge__line conversion-bridge__line--out"><i /></span>
                <span className="conversion-bridge__label">TO</span>
              </div>
              <div className="format-tile format-tile--output">
                <FileCheck /><strong>MP4</strong><small>H.264 + AAC</small>
              </div>
            </div>
          </div>
          <button type="button" className="conversion-scene__pause" aria-label={paused ? "Play hero animations" : "Pause hero animations"} onClick={() => setPaused(!paused)}>
            {paused ? <Play size={12} /> : <Pause size={12} />}
            <span>{paused ? "Play" : "Pause"} animations</span>
          </button>
        </div>
      </div>

      <div
        className="hero-upload"
        data-drag-over={canPick && dragOver || undefined}
        data-busy={active || undefined}
        onDragOver={canPick ? (e) => { e.preventDefault(); setDragOver(true); } : undefined}
        onDragLeave={canPick ? () => setDragOver(false) : undefined}
        onDrop={canPick ? onDrop : undefined}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime"
          className="hidden"
          onChange={onInputChange}
        />

        <AnimatePresence mode="wait" initial={false}>
          {terminal && job ? (
            <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
              <ResultCard jobId={job.id ?? jobId ?? ""} job={job} onReset={reset} />
            </motion.div>
          ) : canPick ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <span className="hero-upload__badge"><UploadCloud className="hero-upload__icon" size={29} strokeWidth={1.8} aria-hidden="true" /></span>
              <h2>Upload your video</h2>
              <p>MP4 or MOV, up to 100 MB.</p>

              <fieldset className="hero-upload__recipes">
                <legend className="sr-only">Processing mode</legend>
                {RECIPE_OPTIONS.map((r) => (
                  <label key={r.value} title={r.hint} className="hero-upload__recipe">
                    <input
                      type="radio"
                      name="hero-recipe"
                      value={r.value}
                      checked={recipe === r.value}
                      onChange={() => setRecipe(r.value)}
                    />
                    {RECIPE_SHORT[r.value] ?? r.label}
                  </label>
                ))}
              </fieldset>

              <button type="button" className="hero-upload__button" onClick={() => inputRef.current?.click()}>
                <UploadCloud size={17} aria-hidden="true" />Choose video
              </button>
              <p className="hero-upload__dropzone-hint">or drop it here</p>

              {error && <p role="alert" className="hero-upload__error">{error}</p>}
              {resumeNotice && (
                <p className="hero-upload__resume" role="status">
                  {resumeNotice}{" "}
                  <button type="button" className="hero-upload__resume-discard" onClick={dismissResumeNotice}>
                    Discard and start again
                  </button>
                </p>
              )}

              <small>Free: 1 video a day · sign in to download</small>
            </motion.div>
          ) : (
            <motion.div
              key="processing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="hero-upload__processing"
            >
              <div className="hero-upload__file">
                <span className="hero-upload__file-icon"><FileVideo size={20} aria-hidden="true" /></span>
                <div className="hero-upload__file-meta">
                  <strong>{file?.name}</strong>
                  <span>{file ? formatBytes(file.size) : ""}</span>
                </div>
              </div>

              <div
                className="hero-upload__progress"
                role="progressbar"
                aria-label={STAGE_LABEL[stage] || "Working"}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={indeterminate ? undefined : barPercent}
                data-indeterminate={indeterminate || undefined}
              >
                <div className="hero-upload__progress-fill" style={{ width: `${barPercent}%` }} />
              </div>

              <ol className="hero-upload__steps" aria-label="Progress">
                {STEPS.map((label, i) => (
                  <li key={label} data-state={i < step ? "done" : i === step ? "active" : "todo"} aria-current={i === step ? "step" : undefined}>
                    <span>{i < step ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : i + 1}</span>{label}
                  </li>
                ))}
              </ol>

              <p className="hero-upload__status" role="status" aria-live="polite">
                {STAGE_LABEL[stage]}
                {stage === "uploading" && progress
                  ? ` ${uploadPercent}% · ${formatBytes(progress.sent)} / ${formatBytes(progress.total)}`
                  : ""}
              </p>

              <div className="hero-upload__log" ref={logRef} aria-hidden="true">
                {log.map((line) => (
                  <div key={line.id} className="hero-upload__log-line">
                    <span className="hero-upload__log-marker">›</span>{line.text}
                  </div>
                ))}
              </div>

              <button type="button" className="hero-upload__cancel" onClick={cancel} disabled={cancelling}>
                {cancelling ? <Loader2 size={15} className="hero-upload__spin" aria-hidden="true" /> : <X size={15} aria-hidden="true" />}
                {cancelling ? "Cancelling…" : "Cancel"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
