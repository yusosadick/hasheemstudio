#!/usr/bin/env node
// Real end-to-end run of ONE recipe on ONE real input file through the real API, queue, worker and
// download gate, then saves the real output for independent analysis (ffprobe/VMAF/SSIM). Used both
// as the regression test for the platform_optimize recipe and as the evidence collector for
// docs/evidence/platform-optimize/ — every number in that table comes from files this script
// downloaded from the real stack, not from the worker's own self-report.
//
// Usage:
//   node tests/e2e/platform-optimize.mjs --input <file> [--recipe platform_optimize] [--out <path>]
//        [--expect-status succeeded|failed] [--timeout-min 25]
// Env: TEST_API_URL (default http://127.0.0.1:8787), HASHEEMSTUDIO_ENV_FILE (default /etc/hasheemstudio/local.env)
// Prints exactly one JSON line prefixed "RESULT " so callers can parse it.

import { readFileSync, writeFileSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import pg from "pg";
import { tusUploadFile } from "../lib/tus-client.mjs";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const input = arg("--input");
if (!input) { console.error("--input <file> is required"); process.exit(2); }
const recipe = arg("--recipe", "platform_optimize");
const outPath = arg("--out");
const expectStatus = arg("--expect-status", "succeeded");
const timeoutMin = Number(arg("--timeout-min", "25"));

const envFile = process.env.HASHEEMSTUDIO_ENV_FILE ?? "/etc/hasheemstudio/local.env";
const env = Object.fromEntries(readFileSync(envFile, "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#") && l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const gatewayBase = `http://127.0.0.1:${env.API_GW_HTTP_PORT}`;
const apiBase = process.env.TEST_API_URL ?? "http://127.0.0.1:8787";
const adminHeaders = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };

const email = `po-e2e-${randomUUID()}@example.invalid`;
const password = `Po1!${randomUUID()}`;
let userId = null;
try {
  const created = await (await fetch(`${gatewayBase}/auth/v1/admin/users`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  userId = created.id;
  const session = await (await fetch(`${gatewayBase}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: env.ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })).json();
  const auth = { Authorization: `Bearer ${session.access_token}` };

  const buffer = readFileSync(input);
  const up = await (await fetch(`${apiBase}/v1/uploads/sessions`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ filename: basename(input), declaredSizeBytes: buffer.length, declaredMimeType: "video/mp4" }) })).json();
  if (!up.tusUploadPath) throw new Error(`upload session refused: ${JSON.stringify(up)}`);
  await tusUploadFile({ gatewayBase, tusUploadPath: up.tusUploadPath, anonKey: env.ANON_KEY, accessToken: session.access_token, buffer });
  const fin = await (await fetch(`${apiBase}/v1/uploads/sessions/${up.sessionId}/finalize`, { method: "POST", headers: auth })).json();
  const jobRes = await fetch(`${apiBase}/v1/jobs`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ mediaAssetId: fin.mediaAssetId, recipe }) });
  const job = await jobRes.json();
  if (!jobRes.ok) throw new Error(`job creation refused (${jobRes.status}): ${JSON.stringify(job)}`);

  const started = Date.now();
  let view;
  while (Date.now() - started < timeoutMin * 60_000) {
    view = await (await fetch(`${apiBase}/v1/jobs/${job.jobId}`, { headers: auth })).json();
    if (["succeeded", "failed", "cancelled"].includes(view.status)) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  const processingSeconds = Math.round((Date.now() - started) / 1000);

  let outputBytes = null;
  if (view.status === "succeeded" && outPath) {
    const grant = await fetch(`${apiBase}/v1/jobs/${job.jobId}/download`, { method: "POST", headers: auth });
    const g = await grant.json();
    if (!grant.ok) throw new Error(`download gate refused: ${JSON.stringify(g)}`);
    const bytes = Buffer.from(await (await fetch(g.downloadUrl)).arrayBuffer());
    writeFileSync(outPath, bytes);
    outputBytes = bytes.length;
  }
  // The API deliberately redacts the report; the full checks (plan, sizes, timings) are read from the DB.
  const dbc = new pg.Client({ host: "127.0.0.1", port: Number(env.POSTGRES_PORT), user: "postgres.hasheemstudio", password: env.POSTGRES_PASSWORD, database: env.POSTGRES_DB });
  await dbc.connect();
  const rep = (await dbc.query("select verification_level, checks from verification_reports where job_id=$1 order by created_at desc limit 1", [job.jobId])).rows[0] ?? null;
  await dbc.end();
  const result = {
    input: basename(input), inputBytes: statSync(input).size, recipe, jobId: job.jobId,
    status: view.status, errorMessage: view.errorMessage, processingSeconds, outputBytes,
    verificationChecks: rep?.checks ?? null,
    verificationLevel: rep?.verification_level ?? null,
  };
  console.log("RESULT " + JSON.stringify(result));
  if (view.status !== expectStatus) { console.error(`FAIL: expected status ${expectStatus}, got ${view.status} (${view.errorMessage})`); process.exitCode = 1; }
} finally {
  if (userId) await fetch(`${gatewayBase}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: adminHeaders });
}
