#!/usr/bin/env node
// Objective source-vs-output quality comparison (VMAF, SSIM, PSNR) for re-encoded outputs.
// Needs an ffmpeg built with libvmaf (the production worker's ffmpeg is NOT — that is why perceptual
// scores are measured here, offline, and never fabricated per job; see docs/ARCHITECTURE.md).
// A libvmaf-enabled static build: `docker create mwader/static-ffmpeg:7.1` + `docker cp <id>:/ffmpeg .`
//
// Usage: VMAF_FFMPEG=/path/to/ffmpeg VMAF_FFPROBE=/path/to/ffprobe \
//        node tests/eval/quality-compare.mjs <source> <output> [--mode norm|full] [--model vmaf_v0.6.1]
//   --mode norm (default): compare at the OUTPUT's resolution (source downscaled) — isolates compression
//                          fidelity from the deliberate 1080p-ceiling downscale.
//   --mode full:           compare at the SOURCE's resolution (output upscaled) — total loss, incl. the
//                          resolution reduction.
// Both inputs are rotation-aware (ffmpeg autorotates; display size = coded size swapped for 90/270).
// Prints one JSON line.

import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";

const FF = process.env.VMAF_FFMPEG ?? "ffmpeg";
const FP = process.env.VMAF_FFPROBE ?? "ffprobe";
const [ref, dist] = process.argv.slice(2).filter((a) => !a.startsWith("--") && !["norm", "full"].includes(a) && !a.startsWith("vmaf_"));
const opt = (name, fallback) => { const i = process.argv.indexOf(name); return i !== -1 ? process.argv[i + 1] : fallback; };
const mode = opt("--mode", "norm");
const model = opt("--model", "vmaf_v0.6.1");
if (!ref || !dist) { console.error("usage: quality-compare.mjs <source> <output> [--mode norm|full] [--model vmaf_v0.6.1]"); process.exit(2); }

function displaySize(path) {
  const j = JSON.parse(execFileSync(FP, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:stream_side_data=rotation", "-of", "json", path]).toString());
  const s = j.streams[0];
  const rot = Math.abs(Math.round(Number(s.side_data_list?.[0]?.rotation ?? 0))) % 360;
  return rot === 90 || rot === 270 ? { w: s.height, h: s.width } : { w: s.width, h: s.height };
}

const r = displaySize(ref), d = displaySize(dist);
const target = mode === "full" ? r : d;
const dir = mkdtempSync(join(tmpdir(), "vmaf-"));
const log = join(dir, "log.json");
try {
  const graph =
    `[0:v]scale=${target.w}:${target.h}:flags=bicubic,setpts=PTS-STARTPTS[d];` +
    `[1:v]scale=${target.w}:${target.h}:flags=bicubic,setpts=PTS-STARTPTS[r];` +
    `[d][r]libvmaf=model=version=${model}:feature=name=psnr|name=float_ssim:n_threads=8:log_fmt=json:log_path=${log}`;
  execFileSync(FF, ["-nostdin", "-v", "error", "-i", dist, "-i", ref, "-lavfi", graph, "-f", "null", "-"], { stdio: ["ignore", "ignore", "inherit"] });
  const data = JSON.parse(readFileSync(log, "utf8"));
  const p = data.pooled_metrics;
  const r2 = (n, k = 2) => Math.round(n * 10 ** k) / 10 ** k;
  console.log(JSON.stringify({
    source: basename(ref), output: basename(dist), mode, comparedAt: `${target.w}x${target.h}`, model, frames: data.frames.length,
    vmafMean: r2(p.vmaf.mean), vmafMin: r2(p.vmaf.min), vmafHarmonicMean: r2(p.vmaf.harmonic_mean),
    ssimMean: r2(p.float_ssim.mean, 4), ssimMin: r2(p.float_ssim.min, 4), psnrYMean: r2(p.psnr_y.mean),
  }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
