#!/usr/bin/env node
// Real hostile-input tests: a truncated/corrupt "video" and a file that is just random bytes with
// a .mov extension. Confirms the pipeline never crashes, never fakes success, and always ends in
// an honest 'failed' state with a real error — per docs/ARCHITECTURE.md "Decode failures are
// errors, not success with a broken file" and the user's instruction to test malicious inputs, not
// just the happy path.
//
// Usage: node tests/integration/hostile-media-inputs.mjs --env local

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tusUploadFile } from "../lib/tus-client.mjs";

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

async function runHostileCase(label, buffer, recipe, authHeader, accessToken) {
  const session = await (await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST", headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: `${label}.mov`, declaredSizeBytes: buffer.length, declaredMimeType: "video/quicktime" }),
  })).json();
  await tusUploadFile({ gatewayBase, tusUploadPath: session.tusUploadPath, anonKey, accessToken, buffer });
  const finalized = await (await fetch(`${apiBase}/v1/uploads/sessions/${session.sessionId}/finalize`, { method: "POST", headers: authHeader })).json();
  record(`${label}: finalize accepts the file (server can't know it's hostile until probed)`, !!finalized.mediaAssetId, JSON.stringify(finalized));
  if (!finalized.mediaAssetId) return null;

  const jobRes = await fetch(`${apiBase}/v1/jobs`, {
    method: "POST", headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ mediaAssetId: finalized.mediaAssetId, recipe }),
  });
  const job = await jobRes.json();
  record(`${label}: job creation accepted`, jobRes.ok, JSON.stringify(job));
  if (!jobRes.ok) return null;

  let view = null;
  for (let i = 0; i < 30; i++) {
    view = await (await fetch(`${apiBase}/v1/jobs/${job.jobId}`, { headers: authHeader })).json();
    if (["succeeded", "failed", "cancelled"].includes(view.status)) break;
    await sleep(1000);
  }
  return view;
}

const suffix = Date.now();
const email = `hostile-media-${suffix}@example.invalid`;
const password = `Hm1!${suffix}xx`;
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

  // Case 1: truncated real video (valid header, cut off mid-stream).
  const truncated = readFileSync(join(repoRoot, "tests", "fixtures", "media", "synthetic-remux-test.mov")).subarray(0, 2000);
  const truncatedView = await runHostileCase("truncated", truncated, "remux", authHeader, session.access_token);
  record(
    "truncated video: job ends in 'failed', not a fake success",
    truncatedView?.status === "failed",
    `status=${truncatedView?.status} error=${truncatedView?.errorMessage}`,
  );

  // Case 2: pure random bytes with a .mov extension — not a video container at all.
  const garbage = randomBytes(50 * 1024);
  const garbageView = await runHostileCase("garbage", garbage, "inspect", authHeader, session.access_token);
  record(
    "random-bytes '.mov': job ends in 'failed', not a fake success",
    garbageView?.status === "failed",
    `status=${garbageView?.status} error=${garbageView?.errorMessage}`,
  );

  // Case 3: worker/API is still healthy after processing two hostile inputs — nothing crashed.
  const healthRes = await fetch(`${apiBase}/health/ready`);
  record("API is still healthy after processing hostile inputs", healthRes.ok);
  const workerStillUp = (await import("node:child_process")).execSync("docker inspect -f '{{.State.Status}}' hasheemstudio-worker").toString().trim();
  record("worker container is still running (didn't crash) after hostile inputs", workerStillUp === "running", workerStillUp);
} finally {
  if (userId) {
    await fetch(`${gatewayBase}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  }
  console.log("Cleaned up test user.");
}

const allPass = results.every((r) => r.pass);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
process.exit(allPass ? 0 : 1);
