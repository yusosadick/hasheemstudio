// What the browser is allowed to see about how a video was processed. The worker's verification report
// contains the exact encoder plan (quality factor, preset, per-resolution bitrate ceilings, GOP, tool
// versions, checksums) — the product's tuning. None of that is sent to clients: GET /v1/jobs/:id returns
// only this allow-listed view plus a small human-facing summary. The full report stays in the database
// for operators and tests (docs/evidence/platform-optimize/ was produced from it).

type Row = Record<string, any>;

export interface JobSummary {
  verified: boolean;
  inputBytes: number | null;
  outputBytes: number | null;
  /** Positive when the output is smaller; can be negative for tiny sources, and is then shown honestly. */
  reductionPercent: number | null;
  format: { container: "MP4"; video: string | null; audio: string | null };
  /** True only when the output demonstrably meets the published TikTok/Instagram/WhatsApp upload rules we build to. */
  platformReady: boolean;
  underWhatsAppLimit: boolean | null;
  completedAt: string | null;
}

const VIDEO_LABEL: Record<string, string> = { h264: "H.264", hevc: "HEVC (H.265)" };
const AUDIO_LABEL: Record<string, string> = { aac: "AAC" };

export function publicVerificationReport(report: Row | undefined | null) {
  if (!report) return null;
  const c: Row = report.checks ?? {};
  return {
    id: report.id,
    job_id: report.job_id,
    verification_level: report.verification_level,
    frames_re_encoded: report.frames_re_encoded,
    created_at: report.created_at,
    checks: {
      durationOk: c.durationOk === true,
      decodeCheck: { ok: c.decodeCheck?.ok === true },
      ...(c.streamsUnchanged !== undefined ? { streamsUnchanged: c.streamsUnchanged === true } : {}),
    },
  };
}

export function buildJobSummary(job: Row, report: Row | undefined | null, inputBytes: number | null): JobSummary | null {
  if (job.status !== "succeeded" || !report) return null;
  const c: Row = report.checks ?? {};
  const outputBytes = job.output_size_bytes !== null && job.output_size_bytes !== undefined ? Number(job.output_size_bytes) : null;
  const input = inputBytes !== null && Number.isFinite(inputBytes) && inputBytes > 0 ? inputBytes : null;
  const fit: Row = c.platformFit ?? {};
  const platformReady =
    job.recipe === "platform_optimize" &&
    c.outputIsH264 === true &&
    (c.outputIsAac === true || !c.outputStreams?.audio) &&
    fit.outputProfile === "Main" &&
    fit.outputHasBFrames === false &&
    fit.moovBeforeMdat === true &&
    fit.hasEditList === false;
  const video = c.outputStreams?.video ?? null;
  const audio = c.outputStreams?.audio ?? null;
  return {
    verified: c.decodeCheck?.ok === true && c.durationOk === true,
    inputBytes: input,
    outputBytes,
    reductionPercent: input !== null && outputBytes !== null ? Math.round((1 - outputBytes / input) * 1000) / 10 : null,
    format: { container: "MP4", video: video ? (VIDEO_LABEL[video] ?? String(video).toUpperCase()) : null, audio: audio ? (AUDIO_LABEL[audio] ?? String(audio).toUpperCase()) : null },
    platformReady,
    underWhatsAppLimit: typeof fit.whatsappCloudApi16MB === "boolean" ? fit.whatsappCloudApi16MB : null,
    completedAt: report.created_at ? new Date(report.created_at).toISOString() : null,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** hasheemstudio_YYYYMMDD_HHmmss.mp4 in UTC — the fallback when the client does not send its own local-time name. */
export function defaultOutputFileName(completedAt: Date | string | null | undefined): string {
  const d = completedAt ? new Date(completedAt) : new Date();
  const t = Number.isNaN(d.getTime()) ? new Date() : d;
  return `hasheemstudio_${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}_${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}.mp4`;
}

const OUTPUT_NAME_RE = /^hasheemstudio_\d{8}_\d{6}\.mp4$/;

/** The client formats the name in the user's local time; only this exact shape is ever accepted. */
export function safeOutputFileName(requested: unknown, completedAt: Date | string | null | undefined): string {
  return typeof requested === "string" && OUTPUT_NAME_RE.test(requested) ? requested : defaultOutputFileName(completedAt);
}
