#!/usr/bin/env node
// Real test of the H.264/AAC compatibility-encode recipe (docs/ARCHITECTURE.md "Recipe
// semantics") — deliberately distinct from remux: this recipe re-encodes and must say so.
// Verifies actual output codecs, playback, and audio/video sync using tools independent of the
// worker's own verification code (a fresh ffprobe/ffmpeg run against the downloaded file), per the
// user's instruction not to just trust the worker's self-report.
//
// Usage: node tests/e2e/compat-encode.mjs --env local --fixture tests/fixtures/media/synthetic-remux-test.mov

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
function parseEnvFile(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    map.set(t.slice(0, eq), t.slice(eq + 1));
  }
  return map;
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const envName = arg("--env", "local");
const fixturePath = arg("--fixture", join(repoRoot, "tests", "fixtures", "media", "synthetic-remux-test.mov"));
if (!existsSync(fixturePath)) {
  console.error(`Fixture not found: ${fixturePath}`);
  process.exit(1);
}

const environments = JSON.parse(readFileSync(join(repoRoot, "scripts", "db", "environments.json"), "utf8"));
const envCfg = environments[envName];
const secrets = parseEnvFile(readFileSync(envCfg.secretsFile, "utf8"));
const anonKey = secrets.get("ANON_KEY");
const serviceKey = secrets.get("SERVICE_ROLE_KEY");
const gatewayBase = `http://127.0.0.1:${secrets.get("API_GW_HTTP_PORT") ?? "58000"}`;
const apiBase = `http://127.0.0.1:${process.env.API_PORT ?? 8787}`;

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

const suffix = Date.now();
const email = `compat-encode-test-${suffix}@example.invalid`;
const password = `Ce1!${suffix}xx`;
let userId;

try {
  const created = await (await fetch(`${gatewayBase}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })).json();
  userId = created.id;
  const session = await (await fetch(`${gatewayBase}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })).json();
  const authHeader = { Authorization: `Bearer ${session.access_token}` };

  const fixtureBuffer = readFileSync(fixturePath);
  const uploadSession = await (await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "compat-test.mov", declaredSizeBytes: fixtureBuffer.length, declaredMimeType: "video/quicktime" }),
  })).json();
  await fetch(uploadSession.uploadUrl, { method: "PUT", headers: { apikey: anonKey, "Content-Type": "video/quicktime" }, body: fixtureBuffer });
  const finalized = await (await fetch(`${apiBase}/v1/uploads/sessions/${uploadSession.sessionId}/finalize`, { method: "POST", headers: authHeader })).json();

  const jobRes = await fetch(`${apiBase}/v1/jobs`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ mediaAssetId: finalized.mediaAssetId, recipe: "compat_encode" }),
  });
  const job = await jobRes.json();
  record("compat_encode job accepted by the real API", jobRes.ok, JSON.stringify(job));

  let jobView = null;
  for (let i = 0; i < 60; i++) {
    jobView = await (await fetch(`${apiBase}/v1/jobs/${job.jobId}`, { headers: authHeader })).json();
    if (["succeeded", "failed", "cancelled"].includes(jobView.status)) break;
    await sleep(1000);
  }
  record("compat_encode job reaches 'succeeded'", jobView.status === "succeeded", `status=${jobView.status} error=${jobView.errorMessage}`);
  record("verification report honestly reports frames_re_encoded=true (distinct from remux)", jobView.verificationReport?.frames_re_encoded === true);

  const outputPath = "/tmp/hasheemstudio-compat-encode-output.mp4";
  const buf = Buffer.from(await (await fetch(jobView.downloadUrl)).arrayBuffer());
  writeFileSync(outputPath, buf);
  record("downloaded real encoded bytes", buf.length > 10_000, `${buf.length} bytes`);

  // Independent verification — a fresh ffprobe/ffmpeg run against the downloaded file, not just
  // trusting the worker's own self-reported verification_report.
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-print_format", "json", outputPath]);
  const probed = JSON.parse(stdout);
  const v = probed.streams.find((s) => s.codec_type === "video");
  const a = probed.streams.find((s) => s.codec_type === "audio");
  record("independent ffprobe confirms real H.264 video codec", v?.codec_name === "h264", `video=${v?.codec_name}`);
  record("independent ffprobe confirms real AAC audio codec", a?.codec_name === "aac", `audio=${a?.codec_name}`);

  const durDelta = Math.abs(parseFloat(v.duration ?? probed.format.duration) - parseFloat(a.duration ?? probed.format.duration));
  record("audio/video stream durations match (sync sanity check)", durDelta < 0.5, `delta=${durDelta.toFixed(3)}s`);

  try {
    await execFileAsync("ffmpeg", ["-v", "error", "-i", outputPath, "-f", "null", "-"]);
    record("independent full playback decode of the downloaded file succeeds", true);
  } catch (e) {
    record("independent full playback decode of the downloaded file succeeds", false, e.message);
  }
} finally {
  if (userId) {
    await fetch(`${gatewayBase}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  }
}

const allPass = results.every((r) => r.pass);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
process.exit(allPass ? 0 : 1);
