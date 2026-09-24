// Pure planning logic for the `platform_optimize` recipe: given what the input actually is (display
// size, frame rate, bitrate), decide the output size, frame rate and bitrate ceiling. No I/O, so it is
// unit-tested directly (platformProfile.test.ts) and reused by the offline evaluation script.
//
// Where the numbers come from (full citations + measurements: docs/ARCHITECTURE.md
// "Platform-optimize recipe" and docs/evidence/platform-optimize/):
//   - TikTok publishes only a MINIMUM (>= 516 kbps) and a 500 MB ceiling, no maximum bitrate.
//   - Instagram (Meta Graph API docs) publishes a MAXIMUM: VBR 25 Mbps video / 128 kbps audio, 23-60 fps,
//     max 1920 px horizontal, closed GOP, AAC <= 48 kHz, no edit lists, moov at the front.
//   - WhatsApp (Meta Cloud API docs): MP4, H.264 + AAC only, 16 MB max, and H.264 High profile with
//     B-frames is not supported by Android clients — Main profile without B-frames is recommended.
//   - YouTube publishes the only official per-resolution/frame-rate *recommended* bitrate table, used
//     here as the ceiling anchor: 1080p 8 Mbps (24-30 fps) / 12 Mbps (48-60 fps), 720p 5 / 7.5, 480p 2.5 / 4.
// No platform publishes a bitrate at which it will skip re-encoding, so these are ceilings chosen by
// engineering judgement and validated by measurement, never claims about platform internals.

export const PLATFORM_PROFILE_VERSION = 1;

/** Product ceiling (docs/PRD.md §6): 1080p/60. Landscape 1920x1080 or portrait 1080x1920. */
export const OUTPUT_LONG_SIDE = 1920;
export const OUTPUT_SHORT_SIDE = 1080;
export const OUTPUT_MAX_FPS = 60;
export const AUDIO_KBPS = 128;
/** TikTok's published minimum; never plan below it. */
export const MIN_VIDEO_KBPS = 516;
/** Instagram's published video maximum (VBR). Every tier stays far below it. */
export const INSTAGRAM_MAX_VIDEO_KBPS = 25_000;
/** WhatsApp Cloud API media limit for video. */
export const WHATSAPP_MAX_BYTES = 16 * 1024 * 1024;

interface Tier {
  /** Applies while the output's short side is <= this many pixels. */
  maxShortSide: number;
  /** Ceiling (kbps) for <= 30 fps, and for 60 fps; frame rates in between interpolate linearly. */
  kbps30: number;
  kbps60: number;
}

const TIERS: Tier[] = [
  { maxShortSide: 360, kbps30: 1_000, kbps60: 1_500 },
  { maxShortSide: 480, kbps30: 2_500, kbps60: 4_000 },
  { maxShortSide: 720, kbps30: 5_000, kbps60: 7_500 },
  { maxShortSide: 1080, kbps30: 8_000, kbps60: 12_000 },
];

export interface PlatformInput {
  displayWidth: number;
  displayHeight: number;
  frameRate: number | null;
  /** Source video bitrate in kbps when known — used so the output is never planned above the source. */
  sourceVideoKbps: number | null;
}

export interface PlatformPlan {
  profileVersion: number;
  outWidth: number;
  outHeight: number;
  outFps: number;
  downscaled: boolean;
  fpsCapped: boolean;
  tierShortSide: number;
  /** The published-anchored ceiling for this resolution/fps class, before source-bitrate limiting. */
  tierCeilingKbps: number;
  /** -maxrate. */
  maxrateKbps: number;
  /** -bufsize: one second of ceiling bitrate (a tighter buffer keeps short clips at/below the ceiling). */
  bufsizeKbps: number;
  /** x264 vbv-init: start the VBV buffer half full so a short clip does not open with a full-buffer burst. */
  vbvInit: number;
  crf: number;
  gopFrames: number;
  audioKbps: number;
}

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

export function planPlatformProfile(input: PlatformInput): PlatformPlan {
  const { displayWidth: w, displayHeight: h } = input;
  if (!(w > 0 && h > 0)) throw new Error("platform_optimize needs a known video size");

  // Never upscale; only shrink when the source exceeds the product ceiling. Orientation-aware: the
  // long side may use 1920 and the short side 1080 whichever way the video is held.
  const scale = Math.min(1, OUTPUT_LONG_SIDE / Math.max(w, h), OUTPUT_SHORT_SIDE / Math.min(w, h));
  const downscaled = scale < 1;
  const outWidth = downscaled ? even(w * scale) : w;
  const outHeight = downscaled ? even(h * scale) : h;

  const srcFps = input.frameRate && input.frameRate > 0 && Number.isFinite(input.frameRate) ? input.frameRate : 30;
  const fpsCapped = srcFps > OUTPUT_MAX_FPS + 0.5;
  const outFps = fpsCapped ? OUTPUT_MAX_FPS : srcFps;

  const shortSide = Math.min(outWidth, outHeight);
  const tier = TIERS.find((t) => shortSide <= t.maxShortSide) ?? TIERS[TIERS.length - 1];
  const t = Math.min(1, Math.max(0, (outFps - 30) / 30));
  const tierCeilingKbps = Math.round(tier.kbps30 + (tier.kbps60 - tier.kbps30) * t);

  // Never plan the output above what the source itself used (a re-encode must not inflate a file that
  // was already small), but never below the published TikTok minimum either.
  let maxrateKbps = tierCeilingKbps;
  if (input.sourceVideoKbps && input.sourceVideoKbps > 0) {
    maxrateKbps = Math.min(maxrateKbps, Math.round(input.sourceVideoKbps * 0.9));
  }
  maxrateKbps = Math.min(INSTAGRAM_MAX_VIDEO_KBPS, Math.max(MIN_VIDEO_KBPS, maxrateKbps));

  return {
    profileVersion: PLATFORM_PROFILE_VERSION,
    outWidth,
    outHeight,
    outFps,
    downscaled,
    fpsCapped,
    tierShortSide: tier.maxShortSide,
    tierCeilingKbps,
    maxrateKbps,
    bufsizeKbps: maxrateKbps,
    vbvInit: 0.5,
    crf: 23,
    gopFrames: Math.max(24, Math.round(outFps * 2)),
    audioKbps: AUDIO_KBPS,
  };
}

// --- Encode-time model -----------------------------------------------------------------------------
// The worker has 2 CPUs and a per-process time limit, so the preset is chosen from the predicted
// workload. Constants are throughput measured on a heavily loaded shared host with the encode pinned to
// 2 cores (docs/evidence/platform-optimize/ has the raw runs), deliberately on the conservative side:
//   decode: 4K HEVC @ ~91 Mbps 67 MP/s; 1080p H.264 81-287 MP/s   -> 60 MP/s used
//   x264 encode-only (derived from full-pipeline fps minus decode): faster 50-55 MP/s hard/typical,
//   veryfast 89-97 MP/s                                            -> 45 / 80 MP/s used
// `superfast`/`ultrafast` are excluded on purpose: on typical 1080p30 content `superfast` produced
// 7.2 Mbps vs 4.4 Mbps for `faster` (+62% size), and under a bitrate cap quality collapses (VMAF 71.6 and
// 61.7 vs 80.0 on hard 1080p50 content).
const DECODE_MPIX_PER_S = 60;
const ENCODE_MPIX_PER_S: Record<string, number> = { faster: 45, veryfast: 80 };

/** Per-process ffmpeg timeout for this recipe; must stay below the worker's 10-minute job lease. */
export const PLATFORM_OPTIMIZE_TIMEOUT_MS = 8 * 60_000;

export interface WorkloadInput {
  durationSeconds: number | null;
  inputWidth: number;
  inputHeight: number;
  inputFps: number | null;
}

export function estimateEncodeSeconds(plan: Pick<PlatformPlan, "outWidth" | "outHeight" | "outFps">, w: WorkloadInput, preset: string): number {
  const seconds = w.durationSeconds ?? 60;
  const inFps = w.inputFps && w.inputFps > 0 ? w.inputFps : 30;
  const decode = (seconds * inFps * w.inputWidth * w.inputHeight) / 1e6 / DECODE_MPIX_PER_S;
  const encode = (seconds * plan.outFps * plan.outWidth * plan.outHeight) / 1e6 / ENCODE_MPIX_PER_S[preset];
  return decode + encode;
}

export type PresetChoice = { ok: true; preset: string; predictedSeconds: number } | { ok: false; predictedSeconds: number };

/**
 * `faster` (same quality as `medium` at ~1.8x the speed, measured) while it fits in half the timeout;
 * `veryfast` when it does not; refuse early — instead of burning three 8-minute attempts — when even
 * `veryfast` is predicted to overrun the timeout by half again.
 */
export function choosePreset(plan: Pick<PlatformPlan, "outWidth" | "outHeight" | "outFps">, w: WorkloadInput): PresetChoice {
  const faster = estimateEncodeSeconds(plan, w, "faster");
  if (faster <= (PLATFORM_OPTIMIZE_TIMEOUT_MS / 1000) * 0.5) return { ok: true, preset: "faster", predictedSeconds: Math.round(faster) };
  const veryfast = estimateEncodeSeconds(plan, w, "veryfast");
  if (veryfast <= (PLATFORM_OPTIMIZE_TIMEOUT_MS / 1000) * 1.5) return { ok: true, preset: "veryfast", predictedSeconds: Math.round(veryfast) };
  return { ok: false, predictedSeconds: Math.round(veryfast) };
}
