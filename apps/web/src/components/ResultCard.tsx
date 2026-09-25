import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowDownToLine, Clapperboard, FileVideo, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { UpgradeInline } from "./PlansPanel";
import { getSession } from "../lib/auth";
import { requestDownload, DownloadError, type JobView } from "../lib/api";
import { formatOutputFileName } from "../lib/outputName";
import "./ResultCard.css";

// The result view shared by the homepage hero and /app/jobs/:id. It deliberately shows FOUR plain-language
// facts about the finished video and nothing about how it was made (no encoder settings, bitrates, tools or
// checksums) — and the API does not send those to the browser in the first place.

interface Tile {
  key: string;
  label: string;
  value: ReactNode;
  sub: string;
  icon: ReactNode;
  accent?: boolean;
}

function buildTiles(job: JobView): Tile[] {
  const s = job.summary;
  if (!s) return [];
  const video = s.format.video, audio = s.format.audio;

  const playback: Tile = {
    key: "playback", label: "Playback",
    value: s.verified ? "Verified" : "Checked",
    sub: video ? `${video} · ${audio ?? "no audio"}` : s.verified ? "Plays start to end" : "Review before posting",
    icon: <ShieldCheck size={16} aria-hidden="true" />,
  };

  const second: Tile = s.platformReady
    ? { key: "ready", label: "Ready for", value: "Social upload", sub: s.underWhatsAppLimit ? "TikTok · Instagram · WhatsApp" : "TikTok · Instagram", icon: <Clapperboard size={16} aria-hidden="true" />, accent: true }
    : { key: "mode", label: "Mode", value: job.recipe === "remux" ? "Repackaged" : job.recipe === "compat_encode" ? "Re-encoded" : "Processed", sub: job.recipe === "remux" ? "Nothing lost" : "H.264 · AAC", icon: <Clapperboard size={16} aria-hidden="true" /> };

  return [playback, second];
}

export function ResultCard({ jobId, job, onReset, standalone = false }: { jobId: string; job: JobView; onReset?: () => void; standalone?: boolean }) {
  const reduce = useReducedMotion();
  const [unlocking, setUnlocking] = useState(false);
  const [started, setStarted] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);
  const busy = useRef(false);

  const fileName = formatOutputFileName(job.summary?.completedAt ?? job.updatedAt);
  const failed = job.status === "failed" || job.status === "expired" || job.status === "cancelled";
  const signedIn = Boolean(getSession()) && !job.requiresLogin && !needsLogin;
  const next = encodeURIComponent(`/app/jobs/${jobId}`);

  async function download() {
    if (busy.current) return;
    busy.current = true; setUnlocking(true); setDownloadError(null);
    try {
      window.location.assign(await requestDownload(jobId, fileName));
      setStarted(true);
    } catch (err) {
      if (err instanceof DownloadError && ["login_required", "session_required", "account_not_verified", "invalid_token"].includes(err.code)) setNeedsLogin(true);
      if (err instanceof DownloadError && err.code === "daily_download_limit") setLimitReached(true);
      setDownloadError(err instanceof Error ? err.message : "Download failed.");
    } finally { busy.current = false; setUnlocking(false); }
  }

  if (failed) {
    return (
      <motion.section className={`result-card result-card--failed${standalone ? " result-card--standalone" : ""}`} data-job-id={jobId} aria-label="Processing result"
        initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <span className="result-card__badge result-card__badge--failed"><AlertTriangle size={26} aria-hidden="true" /></span>
        <h2>We couldn’t prepare this video</h2>
        <p className="result-card__lead" role="alert">{job.errorMessage ?? "Something went wrong while processing. Please try again."}</p>
        {onReset ? (
          <button type="button" className="result-card__primary" onClick={onReset}><RotateCcw size={17} aria-hidden="true" />Try another video</button>
        ) : (
          <Link to="/" className="result-card__primary"><RotateCcw size={17} aria-hidden="true" />Try another video</Link>
        )}
      </motion.section>
    );
  }

  if (job.status === "succeeded" && !job.hasOutput && !job.outputExpired) {
    return (
      <motion.section className={`result-card result-card--failed${standalone ? " result-card--standalone" : ""}`} data-job-id={jobId} aria-label="Processing result"
        initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <span className="result-card__badge result-card__badge--failed result-card__badge--info"><FileVideo size={26} aria-hidden="true" /></span>
        <h2>Inspection complete</h2>
        <p className="result-card__lead">This mode only checks your video, so there’s no file to download. Upload again with “Smaller file” to get a video that’s ready to post.</p>
        {onReset ? (
          <button type="button" className="result-card__primary" onClick={onReset}><RotateCcw size={17} aria-hidden="true" />Prepare a video</button>
        ) : (
          <Link to="/" className="result-card__primary"><RotateCcw size={17} aria-hidden="true" />Prepare a video</Link>
        )}
      </motion.section>
    );
  }

  const tiles = buildTiles(job);
  const stagger = (i: number) => (reduce ? { duration: 0 } : { delay: 0.25 + i * 0.09, duration: 0.4, ease: "easeOut" as const });

  return (
    <motion.section className={`result-card${standalone ? " result-card--standalone" : ""}`} data-job-id={jobId} aria-label="Processing result"
      initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="result-card__hero">
        <span className="result-card__ring" aria-hidden="true">
          <svg viewBox="0 0 52 52" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M14 27.5 l8.5 8.5 L38 18" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.15, duration: 0.5, ease: "easeOut" }} />
          </svg>
          {!reduce && Array.from({ length: 8 }).map((_, i) => <i key={i} className="result-card__spark" style={{ ["--a" as string]: `${i * 45}deg` }} />)}
        </span>
        <h2>Your video is ready</h2>
        <p className="result-card__lead">Prepared, checked and ready to post.</p>
        <span className="result-card__file" title={fileName}><FileVideo size={14} aria-hidden="true" /><span>{fileName}</span></span>
      </div>

      {tiles.length > 0 && (
        <div className="result-card__tiles" data-testid="result-details">
          {tiles.map((t, i) => (
            <motion.div key={t.key} className={`result-card__tile${t.accent ? " is-accent" : ""}`} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={stagger(i)}>
              <span className="result-card__tile-label">{t.icon}{t.label}</span>
              <strong>{t.value}</strong>
              <small>{t.sub}</small>
            </motion.div>
          ))}
        </div>
      )}

      {job.outputExpired ? (
        <p className="result-card__notice" role="status"><AlertTriangle size={16} aria-hidden="true" />This video has passed its retention period and has been deleted.</p>
      ) : signedIn ? (
        <>
          <button type="button" className="result-card__primary" disabled={unlocking} onClick={() => void download()}>
            {unlocking ? <Loader2 size={18} className="result-card__spin" aria-hidden="true" /> : <ArrowDownToLine size={18} aria-hidden="true" />}
            {unlocking ? "Preparing download…" : "Download video"}
          </button>
          {started && !downloadError && <p className="result-card__started" role="status">Your download has started — check your downloads folder.</p>}
        </>
      ) : (
        <div className="result-card__gate">
          <p>Sign in or create a free account to download.<span className="result-card__more"> Your finished video is saved here — no need to upload it again.</span></p>
          <Link to={`/login?next=${next}`} className="result-card__primary">Sign in to download</Link>
          <Link to={`/signup?next=${next}`} className="result-card__secondary">Create free account</Link>
        </div>
      )}

      {downloadError && !limitReached && <p role="alert" className="result-card__error">{downloadError}</p>}
      {limitReached && <div className="result-card__upgrade"><UpgradeInline onPaid={() => { setLimitReached(false); setDownloadError(null); }} /></div>}

      <div className="result-card__foot">
        {onReset && <button type="button" className="result-card__link" onClick={onReset}><RotateCcw size={14} aria-hidden="true" />Prepare another video</button>}
        <small>
          Free: 1 video per day, up to 100 MB. Resets at midnight UTC.
          {job.outputRetainUntil && <> Available until {new Date(job.outputRetainUntil).toLocaleString()}.</>}
        </small>
      </div>
    </motion.section>
  );
}
