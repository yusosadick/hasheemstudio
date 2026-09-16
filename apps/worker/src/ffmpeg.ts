// Pinned-at-runtime FFmpeg/FFprobe invocation via argument arrays only — never shell interpolation
// (docs/ARCHITECTURE.md "Never execute file names as shell fragments"). Local-file arguments only;
// no remote URL/protocol is ever passed to these subprocesses.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MAX_PROBE_MS = 30_000;
const MAX_PROCESS_MS = 5 * 60_000;

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
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", inputPath],
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

export async function remux(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync(
    "ffmpeg",
    ["-y", "-i", inputPath, "-c", "copy", "-movflags", "+faststart", outputPath],
    { timeout: MAX_PROCESS_MS, maxBuffer: 16 * 1024 * 1024 },
  );
}

export async function decodeCheck(path: string): Promise<{ ok: boolean; detail: string }> {
  try {
    await execFileAsync("ffmpeg", ["-v", "error", "-i", path, "-f", "null", "-"], {
      timeout: MAX_PROCESS_MS,
      maxBuffer: 16 * 1024 * 1024,
    });
    return { ok: true, detail: "decoded cleanly, no stderr output" };
  } catch (err: any) {
    return { ok: false, detail: String(err.stderr ?? err.message).slice(0, 2000) };
  }
}
