import test from "node:test";
import assert from "node:assert/strict";
import { publicVerificationReport, buildJobSummary, defaultOutputFileName, safeOutputFileName } from "./publicReport.js";

const fullReport = {
  id: "r1", job_id: "j1", verification_level: "platform_optimize_full_decode_check", frames_re_encoded: true,
  created_at: "2026-09-25T02:02:33.579Z",
  input_checksum_sha256: "aa", output_checksum_sha256: "bb", tool_versions: { ffmpeg: "system", worker: "w-1" },
  checks: {
    plan: { crf: 23, preset: "faster", vbvInit: 0.5, maxrateKbps: 8000, tierCeilingKbps: 8000, gopFrames: 60, profileVersion: 1 },
    sizes: { inputBytes: 61839849, outputBytes: 5133418, reductionPercent: 91.7, achievedVideoKbps: 7991, targetCeilingKbps: 8000 },
    timings: { encodeSeconds: 28.9, predictedSeconds: 28 },
    durationOk: true, decodeCheck: { ok: true, detail: "decoded cleanly, no stderr output" },
    outputIsAac: true, outputIsH264: true, toneMappedFromHdr: false, qualityMetric: "not_computed",
    outputStreams: { audio: null, video: "h264" }, inputStreams: { audio: null, video: "hevc" },
    platformFit: { hasEditList: false, outputProfile: "Main", moovBeforeMdat: true, outputHasBFrames: false, whatsappCloudApi16MB: true },
  },
};
const job = { status: "succeeded", recipe: "platform_optimize", output_size_bytes: "5133418" };

test("public report never carries encoder tuning, timings, tool versions or checksums", () => {
  const json = JSON.stringify(publicVerificationReport(fullReport));
  for (const secret of ["crf", "preset", "vbv", "maxrate", "tierCeiling", "gop", "profileVersion", "achievedVideoKbps", "encodeSeconds", "predicted", "ffmpeg", "worker", "checksum", "sha", "toneMapped", "plan", "timings", "sizes", "platformFit", "inputStreams", "outputStreams"]) {
    assert.ok(!json.toLowerCase().includes(secret.toLowerCase()), `leaked: ${secret}`);
  }
  assert.deepEqual(publicVerificationReport(fullReport)?.checks, { durationOk: true, decodeCheck: { ok: true } });
});

test("summary carries only the four user-facing facts and is not a superset of the report", () => {
  const s = buildJobSummary(job, fullReport, 61839849)!;
  assert.deepEqual(Object.keys(s).sort(), ["completedAt", "format", "inputBytes", "outputBytes", "platformReady", "reductionPercent", "underWhatsAppLimit", "verified"]);
  assert.equal(s.reductionPercent, 91.7);
  assert.deepEqual(s.format, { container: "MP4", video: "H.264", audio: null });
  assert.equal(s.verified, true);
  assert.equal(s.platformReady, true);
  assert.equal(s.underWhatsAppLimit, true);
});

test("platformReady is false for other recipes and when any required property fails", () => {
  assert.equal(buildJobSummary({ ...job, recipe: "remux" }, fullReport, 1)!.platformReady, false);
  const bf = structuredClone(fullReport); bf.checks.platformFit.outputHasBFrames = true;
  assert.equal(buildJobSummary(job, bf, 61839849)!.platformReady, false);
  const el = structuredClone(fullReport); el.checks.platformFit.hasEditList = true;
  assert.equal(buildJobSummary(job, el, 61839849)!.platformReady, false);
});

test("verified requires both decode and duration checks", () => {
  const bad = structuredClone(fullReport); bad.checks.durationOk = false;
  assert.equal(buildJobSummary(job, bad, 1)!.verified, false);
});

test("a tiny source that grew is reported honestly as a negative reduction", () => {
  assert.equal(buildJobSummary({ ...job, output_size_bytes: "154875" }, fullReport, 82239)!.reductionPercent, -88.3);
});

test("no summary until the job has succeeded and a report exists", () => {
  assert.equal(buildJobSummary({ ...job, status: "processing" }, fullReport, 1), null);
  assert.equal(buildJobSummary(job, null, 1), null);
});

test("default output name is hasheemstudio_YYYYMMDD_HHmmss.mp4 from the completion time", () => {
  assert.equal(defaultOutputFileName("2026-09-25T02:02:33.579Z"), "hasheemstudio_20260925_020233.mp4");
  assert.match(defaultOutputFileName(null), /^hasheemstudio_\d{8}_\d{6}\.mp4$/);
  assert.match(defaultOutputFileName("garbage"), /^hasheemstudio_\d{8}_\d{6}\.mp4$/);
});

test("client-supplied names are accepted only in the exact shape; everything else falls back", () => {
  const at = "2026-09-25T02:02:33.579Z";
  assert.equal(safeOutputFileName("hasheemstudio_20260925_050233.mp4", at), "hasheemstudio_20260925_050233.mp4");
  for (const bad of ["../evil.mp4", 'x"; filename="evil', "hasheemstudio_20260925_050233.mp4\r\nX: y", "hasheemstudio_2026_1.mp4", "hasheem-video.mp4", "", null, undefined, 42, {}]) {
    assert.equal(safeOutputFileName(bad, at), "hasheemstudio_20260925_020233.mp4");
  }
});
