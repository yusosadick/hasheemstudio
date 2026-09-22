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

  return {
    durationSeconds: data.format?.duration ? parseFloat(data.format.duration) : null,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
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

export async function decodeCheck(path: string): Promise<{ ok: boolean; detail: string }> {
  try {
    await execFileAsync(
      "ffmpeg",
      ["-nostdin", "-v", "error", "-protocol_whitelist", "file", "-i", path, "-f", "null", "-"],
      { timeout: MAX_PROCESS_MS, maxBuffer: 16 * 1024 * 1024 },
    );
    return { ok: true, detail: "decoded cleanly, no stderr output" };
  } catch (err: any) {
    return { ok: false, detail: String(err.stderr ?? err.message).slice(0, 2000) };
  }
}
