import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { FileVideo, FileCheck, RefreshCw, Pause, Play, UploadCloud, X, Loader2 } from "lucide-react";
import "./ConversionHero.css";
import { HeroBackdrop } from "./HeroBackdrop";
import { useVideoUpload, formatBytes, type Recipe, type UploadStage } from "../hooks/useVideoUpload";

const RECIPES: { value: Recipe; label: string }[] = [
  { value: "remux", label: "Compatible MP4 remux" },
  { value: "compat_encode", label: "H.264/AAC re-encode" },
  { value: "inspect", label: "Inspect only" },
];

const ACTIVE_STAGES = new Set<UploadStage>([
  "uploading",
  "finalizing",
  "creating_job",
  "queued",
  "processing",
  "verifying",
]);

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
  const navigate = useNavigate();
  const upload = useVideoUpload();
  const { stage, file, progress, error, log, recipe, setRecipe, resumeNotice, jobId, handleFile, cancel, cancelling, dismissResumeNotice } = upload;

  const active = ACTIVE_STAGES.has(stage);
  const canPick = stage === "idle" || stage === "error";

  // Only the terminal success/failure/expiry states leave the page — the whole upload and
  // processing pipeline plays out right here, then hands off to the real JobResult page (its own
  // download gate, sign-in gate and verification report already exist there; not duplicated here).
  useEffect(() => {
    if (jobId && (stage === "succeeded" || stage === "failed" || stage === "expired")) {
      navigate(`/app/jobs/${jobId}`);
    }
  }, [stage, jobId, navigate]);

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
    <div className="conversion-hero">
      <HeroBackdrop paused={paused} />
      <div className="conversion-hero__stage">
        <div className="conversion-hero__copy">
          <p className="conversion-hero__eyebrow">Hasheem Studio video tools</p>
          <h1>Prepare your video<br className="conversion-hero__title-break" /> for upload</h1>
          <p className="conversion-hero__description">
            Inspect, fix compatibility issues, and create a platform-ready video—with a clear report of exactly what changed.
          </p>
        </div>

        <div className="conversion-scene" data-paused={paused}>
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
          {canPick ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <span className="hero-upload__badge"><UploadCloud className="hero-upload__icon" size={29} strokeWidth={1.8} aria-hidden="true" /></span>
              <h2>Select your video to prepare</h2>
              <p>Upload an MP4 or MOV. Sign in when you download.</p>

              <fieldset className="hero-upload__recipes">
                <legend className="hero-upload__recipes-legend">What does it need?</legend>
                {RECIPES.map((r) => (
                  <label key={r.value} className="hero-upload__recipe">
                    <input
                      type="radio"
                      name="hero-recipe"
                      value={r.value}
                      checked={recipe === r.value}
                      onChange={() => setRecipe(r.value)}
                    />
                    {r.label}
                  </label>
                ))}
              </fieldset>

              <button type="button" className="hero-upload__button" onClick={() => inputRef.current?.click()}>
                <UploadCloud size={17} aria-hidden="true" />Choose video
              </button>
              <p className="hero-upload__dropzone-hint">or drop a file anywhere in this card</p>

              {error && <p role="alert" className="hero-upload__error">{error}</p>}
              {resumeNotice && (
                <p className="hero-upload__resume" role="status">
                  {resumeNotice}{" "}
                  <button type="button" className="hero-upload__resume-discard" onClick={dismissResumeNotice}>
                    Discard and start again
                  </button>
                </p>
              )}

              <small>1 free video/day · 100 MB · 2 minutes · 1080p60</small>
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
