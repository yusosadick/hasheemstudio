// Pinned-at-runtime FFmpeg/FFprobe invocation via argument arrays only — never shell interpolation
// (docs/ARCHITECTURE.md "Never execute file names as shell fragments"). Local-file arguments only.
//
// Hardening added in Phase 5 (docs/SECURITY.md "Media processing sandbox"):
// - `-protocol_whitelist file` on every invocation: even if a malicious input embeds references to
//   other protocols (a concat playlist, an HLS manifest, an "avi" index pointing at a URL), FFmpeg
//   will refuse to open anything but plain local files. This is the concrete defence against SSRF
//   via crafted media containers, independent of the container-level network restrictions in
//   infra/compose/docker-compose.worker.yml.
// - `-nostdin`: prevents FFmpeg from blocking on stdin if invoked in a context where it's a TTY.
// - `-threads`: bounds CPU fan-out per job so one job can't consume the whole container's CPU
//   quota (which is also hard-limited at the container level).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";
import type { PlatformPlan } from "./platformProfile.js";

const execFileAsync = promisify(execFile);

const MAX_PROBE_MS = 30_000;
const MAX_PROCESS_MS = 5 * 60_000;
const FFMPEG_THREADS = process.env.WORKER_FFMPEG_THREADS ?? "2";
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB hard ceiling on any single output file

// Safety net against path traversal: every path FFmpeg touches must resolve inside the caller's
// declared scratch directory. The worker only ever constructs these paths itself (never from
// user-controlled strings) but this is cheap, load-bearing insurance against a future regression.
export function assertWithinScratch(path: string, scratchDir: string): void {
  const resolvedPath = resolve(path);
  const resolvedScratch = resolve(scratchDir);
  if (resolvedPath !== resolvedScratch && !resolvedPath.startsWith(resolvedScratch + "/")) {
    throw new Error(`Refusing to touch path outside scratch dir: ${path} (scratch: ${scratchDir})`);
  }
}

export interface ProbeResult {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  container: string | null;
  frameRate: number | null;
  isVfr: boolean;
  rotationDegrees: number;
  // Size as a viewer sees it: coded width/height swapped when the display matrix rotates the video
  // 90/270 degrees (typical phone/drone portrait clips are stored landscape + a rotation flag).
  displayWidth: number | null;
  displayHeight: number | null;
  videoProfile: string | null;
  hasBFrames: boolean;
  pixFmt: string | null;
  colorTransfer: string | null;
  // PQ (HDR10/Dolby Vision base) or HLG transfer — colours would be washed out by a plain SDR encode.
  isHdr: boolean;
  videoBitRate: number | null;
  formatBitRate: number | null;
}

export function displayDimensions(width: number | null, height: number | null, rotationDegrees: number): { width: number | null; height: number | null } {
  const r = ((Math.abs(Math.round(rotationDegrees)) % 360) + 360) % 360;
  return r === 90 || r === 270 ? { width: height, height: width } : { width, height };
}

function parseFrameRate(rate: string | undefined): number | null {
  if (!rate) return null;
  const [num, den] = rate.split("/").map(Number);
  if (!den) return num || null;
  return num / den;
}

export async function probe(inputPath: string): Promise<ProbeResult> {
  assertWithinScratch(inputPath, dirname(inputPath));
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v", "error",
      "-protocol_whitelist", "file",
      "-print_format", "json",
      "-show_format", "-show_streams",
      inputPath,
    ],
    { timeout: MAX_PROBE_MS, maxBuffer: 16 * 1024 * 1024 },
  );
  const data = JSON.parse(stdout);
  const videoStream = data.streams?.find((s: any) => s.codec_type === "video");
  const audioStream = data.streams?.find((s: any) => s.codec_type === "audio");

  const avgFrameRate = parseFrameRate(videoStream?.avg_frame_rate);
  const rFrameRate = parseFrameRate(videoStream?.r_frame_rate);
  const isVfr = avgFrameRate !== null && rFrameRate !== null && Math.abs(avgFrameRate - rFrameRate) > 0.01;

  let rotation = 0;
  const rotateTag = videoStream?.tags?.rotate;
  if (rotateTag) rotation = parseInt(rotateTag, 10) || 0;
  const sideData = videoStream?.side_data_list?.find((s: any) => "rotation" in s);
  if (sideData) rotation = sideData.rotation;

  const display = displayDimensions(videoStream?.width ?? null, videoStream?.height ?? null, rotation);
  const colorTransfer: string | null = videoStream?.color_transfer ?? null;
  const num = (v: unknown): number | null => (v !== undefined && v !== null && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);

  return {
    durationSeconds: data.format?.duration ? parseFloat(data.format.duration) : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    displayWidth: display.width,
    displayHeight: display.height,
    videoProfile: videoStream?.profile ?? null,
    hasBFrames: Number(videoStream?.has_b_frames ?? 0) > 0,
    pixFmt: videoStream?.pix_fmt ?? null,
    colorTransfer,
    isHdr: colorTransfer === "smpte2084" || colorTransfer === "arib-std-b67",
    videoBitRate: num(videoStream?.bit_rate),
    formatBitRate: num(data.format?.bit_rate),
    videoCodec: videoStream?.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
    container: data.format?.format_name ?? null,
    frameRate: avgFrameRate,
    isVfr,
    rotationDegrees: rotation,
  };
}

// Markers FFmpeg's own demuxer/decoder emit on stderr when the SOURCE file itself is truncated or
// has an internal index/sample-table inconsistency — as opposed to a merely-unusual-but-intact
// file. `-c copy` in particular has no error resilience: it stops at the first bad packet instead
// of skipping it, silently producing a truncated (but individually decodable, hence
// `decodeCheck.ok === true`) output. Real case seen in production: a 3840x2160 HEVC file that
// stream-copied to only 1.03s of a real 5.14s recording, ffmpeg logging "Packet corrupt (stream =
// 0, dts = 31031)" then "EOF while reading input" — not an edit-list/negative-timestamp issue at
// all, the container's own sample table was inconsistent past that point. A full decode+re-encode
// (compat_encode) hits the exact same wall for this class of failure (the corruption is at the
// demux/index level, upstream of decoding), so this is used only to give an honest, specific
// reason — not to decide whether to retry.
const CORRUPTION_MARKERS = [/corrupt/i, /eof while reading input/i, /invalid data found when processing input/i];

export function looksLikeSourceCorruption(ffmpegStderr: string): boolean {
  return CORRUPTION_MARKERS.some((re) => re.test(ffmpegStderr));
}

export async function remux(inputPath: string, outputPath: string): Promise<{ stderr: string }> {
  assertWithinScratch(inputPath, dirname(inputPath));
  assertWithinScratch(outputPath, dirname(outputPath));
  const { stderr } = await execFileAsync(
    "ffmpeg",
    [
      "-nostdin",
      "-y",
      "-v", "warning",
      "-protocol_whitelist", "file",
      "-i", inputPath,
      "-map", "0:v:0",
      "-map", "0:a:0?", // ignore data/attachment streams that cannot be muxed into MP4
      "-c", "copy",
      // Very common on phone-recorded MOV/MP4: video and audio don't both start at PTS 0 (an
      // edit-list-trimmed lead-in, or a few ms of audio before the first video frame). A plain
      // stream copy without this reproduces that raw offset in a container that no longer carries
      // the edit list explaining it, which can both mis-report the output container's duration
      // metadata and make strict players show corrupted/frozen frames at the start even though a
      // permissive decoder (like the ffmpeg decode check below) plays through it fine.
      "-avoid_negative_ts", "make_zero",
      "-movflags", "+faststart",
      "-fs", String(MAX_OUTPUT_BYTES),
      "-threads", FFMPEG_THREADS,
      outputPath,
    ],
    { timeout: MAX_PROCESS_MS, maxBuffer: 16 * 1024 * 1024 },
  );
  return { stderr: stderr ?? "" };
}

export interface CompatEncodeOptions {
  // Preserve source dimensions/orientation by default — no upscale, no forced resize, per
  // docs/ARCHITECTURE.md "Do not upscale ... by default."
  maxWidth?: number;
  maxHeight?: number;
  // Source frame rate (from probe()), used only to size the GOP below. Falls back to a
  // conservative 30fps assumption if unknown so the GOP math still produces a sane interval.
  sourceFrameRate?: number | null;
}

export async function compatEncode(inputPath: string, outputPath: string, opts: CompatEncodeOptions = {}): Promise<{ stderr: string }> {
  assertWithinScratch(inputPath, dirname(inputPath));
  assertWithinScratch(outputPath, dirname(outputPath));

  const args = [
    "-nostdin",
    "-y",
    "-v", "warning",
    "-protocol_whitelist", "file",
    "-i", inputPath,
    "-map", "0:v:0",
    "-map", "0:a:0?", // optional audio track — absent audio is handled, not an error
  ];

  // A ~2 second closed GOP with scene-cut detection disabled: predictable, seekable segment
  // boundaries every platform's ingest/transcode pipeline (YouTube, TikTok, Instagram, etc.)
  // expects, instead of libx264's default ~250-frame GOP (8+ seconds at typical frame rates).
  const fps = opts.sourceFrameRate && opts.sourceFrameRate > 0 ? opts.sourceFrameRate : 30;
  const gopSize = Math.max(24, Math.round(fps * 2));

  // Explicit H.264/AAC compatibility policy per docs/ARCHITECTURE.md "Recipe semantics". Level
  // 4.2 (not 4.1): the product advertises 1080p60 support, but Level 4.1's MaxMBPS constraint
  // (245,760 macroblocks/sec) only covers 1080p up to ~30fps — a 1080p60 source would produce a
  // stream that claims a level it doesn't actually conform to, which is exactly the kind of thing
  // strict hardware decoders and platform ingest validators reject or mis-decode (visible as
  // corrupted/"scratchy" playback). Level 4.2 (MaxMBPS 522,240) comfortably covers 1080p60 and has
  // the same essentially-universal device support as 4.1.
  args.push(
    "-c:v", "libx264",
    "-profile:v", "high",
    "-level", "4.2",
    "-pix_fmt", "yuv420p", // sensible pixel format for broad player/platform compatibility
    "-preset", "medium",
    "-crf", "20",
    "-g", String(gopSize),
    "-keyint_min", String(gopSize),
    "-sc_threshold", "0",
    "-avoid_negative_ts", "make_zero",
    "-c:a", "aac",
    "-b:a", "160k",
    "-ar", "48000", // standardize to a universally-supported rate rather than passing through an
                     // odd source sample rate some platforms' ingest validators reject
    "-ac", "2",
  );

  // Never upscale: only apply a downscale filter if the source exceeds the requested bound.
  if (opts.maxWidth && opts.maxHeight) {
    args.push(
      "-vf",
      `scale='min(${opts.maxWidth},iw)':'min(${opts.maxHeight},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`,
    );
  }

  args.push(
    "-movflags", "+faststart",
    "-fs", String(MAX_OUTPUT_BYTES),
    "-threads", FFMPEG_THREADS,
    outputPath,
  );

  const { stderr } = await execFileAsync("ffmpeg", args, { timeout: MAX_PROCESS_MS, maxBuffer: 16 * 1024 * 1024 });
  return { stderr: stderr ?? "" };
}

// platform_optimize: a re-encode whose rate control is a *capped CRF* (constant quality, but never above
// the per-resolution/fps ceiling from planPlatformProfile). Every choice below maps to a documented
// platform constraint (sources in platformProfile.ts / docs/ARCHITECTURE.md):
//   - H.264 Main profile, no B-frames  -> WhatsApp (Android clients reject High + B-frames)
//   - closed GOP, keyframe every ~2 s  -> Instagram ("closed GOP"); predictable seek/segment points
//   - yuv420p 8-bit, progressive       -> Instagram / TikTok / WhatsApp
//   - AAC-LC stereo 48 kHz, 128 kbps   -> Instagram (AAC <= 48 kHz, 1-2 channels, 128 kbps)
//   - moov first + no edit list        -> Instagram ("no edit lists, moov atom at the front")
export async function platformOptimize(
  inputPath: string,
  outputPath: string,
  plan: PlatformPlan,
  preset: string,
  timeoutMs: number = MAX_PROCESS_MS,
): Promise<{ stderr: string }> {
  assertWithinScratch(inputPath, dirname(inputPath));
  assertWithinScratch(outputPath, dirname(outputPath));

  // Filters run after ffmpeg's automatic rotation, so plan.outWidth/outHeight are display dimensions.
  const filters: string[] = [];
  if (plan.downscaled) filters.push(`scale=${plan.outWidth}:${plan.outHeight}`);
  if (plan.fpsCapped) filters.push(`fps=${plan.outFps}`);
  filters.push("format=yuv420p");

  const args = [
    "-nostdin", "-y", "-v", "warning",
    "-protocol_whitelist", "file",
    "-i", inputPath,
    "-map", "0:v:0",
    "-map", "0:a:0?",
    "-vf", filters.join(","),
    "-c:v", "libx264",
    "-preset", preset,
    "-profile:v", "main",
    "-level", "4.2",
    "-bf", "0",
    "-pix_fmt", "yuv420p",
    "-crf", String(plan.crf),
    "-maxrate", `${plan.maxrateKbps}k`,
    "-bufsize", `${plan.bufsizeKbps}k`,
    "-x264-params", `vbv-init=${plan.vbvInit}`,
    "-g", String(plan.gopFrames),
    "-keyint_min", String(plan.gopFrames),
    "-sc_threshold", "0",
    "-c:a", "aac",
    "-b:a", `${plan.audioKbps}k`,
    "-ar", "48000",
    "-ac", "2",
    "-movflags", "+faststart",
    "-use_editlist", "0",
    "-fs", String(MAX_OUTPUT_BYTES),
    "-threads", FFMPEG_THREADS,
    outputPath,
  ];
  const { stderr } = await execFileAsync("ffmpeg", args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
  return { stderr: stderr ?? "" };
}

// FFmpeg does not reliably map a mid-stream decode error to a non-zero process exit code: for a
// single-frame or single-packet corruption inside an otherwise-parseable container, `-f null -`
// has been observed to print real decoder errors ("Invalid NAL unit size", "Error splitting the
// input into NAL units", "Decoding error: Invalid data found when processing input") to stderr and
// still exit 0. Catching only a thrown exception (non-zero exit) therefore misses this whole class
// of corruption and reports `decodeCheck.ok: true` on a file that real players (VLC, WhatsApp's
// ingest validator) correctly reject. Any stderr output at `-v error` severity from a clean decode
// should be empty — so treat non-empty stderr as a decode failure regardless of exit code, and
// additionally use the same corruption-marker patterns already defined above for a specific,
// user-facing reason when they match.
export async function decodeCheck(path: string): Promise<{ ok: boolean; detail: string }> {
  let stdout = "";
  let stderr = "";
  let thrown: any = null;
  try {
    const result = await execFileAsync(
      "ffmpeg",
      ["-nostdin", "-v", "error", "-protocol_whitelist", "file", "-i", path, "-f", "null", "-"],
      { timeout: MAX_PROCESS_MS, maxBuffer: 16 * 1024 * 1024 },
    );
    stdout = result.stdout ?? "";
    stderr = result.stderr ?? "";
  } catch (err: any) {
    thrown = err;
    stdout = err.stdout ?? "";
    stderr = err.stderr ?? "";
  }

  const combined = `${stdout}${stderr}`.trim();
  if (thrown || combined.length > 0) {
    const detail = combined.length > 0 ? combined : String(thrown?.message ?? "ffmpeg exited non-zero with no stderr output");
    return { ok: false, detail: detail.slice(0, 2000) };
  }
  return { ok: true, detail: "decoded cleanly, no stderr output" };
}
