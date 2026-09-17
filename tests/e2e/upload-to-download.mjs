#!/usr/bin/env node
// Real end-to-end test: real user, real HTTP calls to the real API (localhost:8787), a real
// synthetic fixture uploaded directly to Supabase Storage via the real resumable (TUS) upload
// path, real worker processing, and a real downloaded+decoded output file. No mocks, no stubbed
// responses. Per docs/IMPLEMENTATION-PLAN.md Phase 4 gate. Cleans up the test user it creates on
// exit. See tests/e2e/resumable-upload-interruption.mjs for the actual interrupt/resume test.
//
// Usage: node tests/e2e/upload-to-download.mjs --env local --fixture <path/to/video>

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tusUploadFile } from "../lib/tus-client.mjs";

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
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

const envName = arg("--env", "local");
const fixturePath = arg("--fixture");
if (!fixturePath || !existsSync(fixturePath)) {
  console.error("Usage: node tests/e2e/upload-to-download.mjs --env local --fixture <path>");
  process.exit(1);
}

const environments = JSON.parse(readFileSync(join(repoRoot, "scripts", "db", "environments.json"), "utf8"));
const envCfg = environments[envName];
const secrets = parseEnvFile(readFileSync(envCfg.secretsFile, "utf8"));
const anonKey = secrets.get("ANON_KEY");
const serviceKey = secrets.get("SERVICE_ROLE_KEY");
const gatewayPort = secrets.get("API_GW_HTTP_PORT") ?? "58000";
const gatewayBase = `http://127.0.0.1:${gatewayPort}`;
const apiBase = `http://127.0.0.1:${process.env.API_PORT ?? 8787}`;

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!pass) throw new Error(`Step failed: ${name}${detail ? " — " + detail : ""}`);
}

async function adminCreateUser(email, password) {
  const res = await fetch(`${gatewayBase}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`admin create user failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function adminDeleteUser(id) {
  await fetch(`${gatewayBase}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
}

async function signIn(email, password) {
  const res = await fetch(`${gatewayBase}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign in failed: ${res.status} ${await res.text()}`);
  return res.json();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const suffix = Date.now();
const user = { email: `e2e-upload-${suffix}@example.invalid`, password: `Ee2e!${suffix}xx` };
let created;

try {
  created = await adminCreateUser(user.email, user.password);
  const session = await signIn(user.email, user.password);
  record("real user created and signed in", true, created.id);
  const authHeader = { Authorization: `Bearer ${session.access_token}` };

  // 1. Create an upload session through the real API.
  const fixtureBuffer = readFileSync(fixturePath);
  const createSessionRes = await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "synthetic-test.mov",
      declaredSizeBytes: fixtureBuffer.length,
      declaredMimeType: "video/quicktime",
    }),
  });
  const uploadSession = await createSessionRes.json();
  record("upload session created via real API", createSessionRes.ok, JSON.stringify(uploadSession));

  // 2. Upload the real fixture directly to storage via the real resumable (TUS) upload path —
  //    bypassing the API's own body, matching docs/ARCHITECTURE.md "upload media directly to the
  //    media/storage path." See tests/e2e/resumable-upload-interruption.mjs for the actual
  //    interruption/resume test; this is just a normal, uninterrupted upload.
  const finalOffset = await tusUploadFile({
    gatewayBase, tusUploadPath: uploadSession.tusUploadPath, anonKey, accessToken: session.access_token, buffer: fixtureBuffer,
  });
  record("real fixture uploaded directly to storage via TUS", finalOffset === fixtureBuffer.length, `offset=${finalOffset}`);

  // 3. Finalize.
  const finalizeRes = await fetch(`${apiBase}/v1/uploads/sessions/${uploadSession.sessionId}/finalize`, {
    method: "POST",
    headers: authHeader,
  });
  const finalized = await finalizeRes.json();
  record("upload finalized, media asset created", finalizeRes.ok, JSON.stringify(finalized));

  // 4. Create a remux job.
  const createJobRes = await fetch(`${apiBase}/v1/jobs`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ mediaAssetId: finalized.mediaAssetId, recipe: "remux" }),
  });
  const job = await createJobRes.json();
  record("remux job created via real API", createJobRes.ok, JSON.stringify(job));

  // 5. Poll for completion — the real worker processes this asynchronously.
  let finalStatus = null;
  let jobView = null;
  for (let i = 0; i < 60; i++) {
    const res = await fetch(`${apiBase}/v1/jobs/${job.jobId}`, { headers: authHeader });
    jobView = await res.json();
    if (["succeeded", "failed", "cancelled"].includes(jobView.status)) {
      finalStatus = jobView.status;
      break;
    }
    await sleep(1000);
  }
  record("worker processed the job to a terminal state", finalStatus === "succeeded", `status=${finalStatus}, error=${jobView?.errorMessage ?? "none"}`);
  record("verification report is present and shows no re-encoding for a remux", jobView.verificationReport && jobView.verificationReport.frames_re_encoded === false, JSON.stringify(jobView.verificationReport));
  record("job response includes a real signed download URL", typeof jobView.downloadUrl === "string" && jobView.downloadUrl.length > 0);

  // 6. Download the real output and decode it — proving it's a genuinely playable file, not a stub.
  const downloadRes = await fetch(jobView.downloadUrl);
  const outputBuffer = Buffer.from(await downloadRes.arrayBuffer());
  const outputPath = "/tmp/hasheemstudio-e2e-output.mp4";
  writeFileSync(outputPath, outputBuffer);
  record("downloaded output is non-trivial in size", outputBuffer.length > 10_000, `${outputBuffer.length} bytes`);

  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-print_format", "json", outputPath]);
  const probed = JSON.parse(stdout);
  const hasVideo = probed.streams?.some((s) => s.codec_type === "video");
  const hasAudio = probed.streams?.some((s) => s.codec_type === "audio");
  record("downloaded output decodes with real video+audio streams", hasVideo && hasAudio, JSON.stringify({ hasVideo, hasAudio, duration: probed.format?.duration }));

  // 7. Cancellation path: create a second job and cancel it immediately.
  const secondFixtureUploadSession = await (
    await fetch(`${apiBase}/v1/uploads/sessions`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "cancel-test.mov", declaredSizeBytes: fixtureBuffer.length, declaredMimeType: "video/quicktime" }),
    })
  ).json();
  await tusUploadFile({ gatewayBase, tusUploadPath: secondFixtureUploadSession.tusUploadPath, anonKey, accessToken: session.access_token, buffer: fixtureBuffer });
  const secondFinalized = await (
    await fetch(`${apiBase}/v1/uploads/sessions/${secondFixtureUploadSession.sessionId}/finalize`, { method: "POST", headers: authHeader })
  ).json();
  const secondJob = await (
    await fetch(`${apiBase}/v1/jobs`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ mediaAssetId: secondFinalized.mediaAssetId, recipe: "remux" }),
    })
  ).json();
  const cancelRes = await fetch(`${apiBase}/v1/jobs/${secondJob.jobId}`, { method: "DELETE", headers: authHeader });
  const cancelBody = await cancelRes.json();
  record("job cancellation via real API succeeds", cancelRes.ok && cancelBody.status === "cancelled", JSON.stringify(cancelBody));

  await sleep(2000);
  const afterCancel = await (await fetch(`${apiBase}/v1/jobs/${secondJob.jobId}`, { headers: authHeader })).json();
  record("cancelled job never later reports success", afterCancel.status === "cancelled", `status=${afterCancel.status}`);

  // 8. Quota: a 4th job today (3 already: the first succeeded one + the cancelled one = 2 so far
  //    in this run, but other test runs today may have added more — check the limit is enforced
  //    generically by hammering until we see a 429).
  let sawQuotaLimit = false;
  for (let i = 0; i < 5; i++) {
    const extraSession = await (
      await fetch(`${apiBase}/v1/uploads/sessions`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ filename: `quota-${i}.mov`, declaredSizeBytes: fixtureBuffer.length, declaredMimeType: "video/quicktime" }),
      })
    ).json();
    await tusUploadFile({ gatewayBase, tusUploadPath: extraSession.tusUploadPath, anonKey, accessToken: session.access_token, buffer: fixtureBuffer });
    const extraFinalized = await (
      await fetch(`${apiBase}/v1/uploads/sessions/${extraSession.sessionId}/finalize`, { method: "POST", headers: authHeader })
    ).json();
    const extraJobRes = await fetch(`${apiBase}/v1/jobs`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ mediaAssetId: extraFinalized.mediaAssetId, recipe: "inspect" }),
    });
    if (extraJobRes.status === 429) {
      sawQuotaLimit = true;
      break;
    }
    // inspect jobs finish fast and don't count against the "1 active job" concurrency limit for long
    await sleep(1500);
  }
  record("server-enforced daily job quota is real, not just documented", sawQuotaLimit);
} finally {
  if (created) await adminDeleteUser(created.id);
  console.log("Cleaned up test user.");
}

const allPass = results.every((r) => r.pass);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
process.exit(allPass ? 0 : 1);
