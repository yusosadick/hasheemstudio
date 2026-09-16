#!/usr/bin/env node
// Real worker-crash-recovery test: creates a job, SIGKILLs the worker process while it's
// mid-flight, force-expires the lease (so the test doesn't have to sleep for the real ~10 minute
// lease TTL), restarts the worker, and confirms the reconciler requeues it and it completes
// successfully — per docs/IMPLEMENTATION-PLAN.md Phase 5 acceptance: "a killed worker leads to
// bounded retry/recovery, not endless processing." Requires the API to already be running; starts
// and stops its own worker process.

import { readFileSync, existsSync } from "node:fs";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

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

const secrets = parseEnvFile(readFileSync("/etc/hasheemstudio/local.env", "utf8"));
const anonKey = secrets.get("ANON_KEY");
const serviceKey = secrets.get("SERVICE_ROLE_KEY");
const gatewayBase = `http://127.0.0.1:${secrets.get("API_GW_HTTP_PORT") ?? "58000"}`;
const apiBase = `http://127.0.0.1:${process.env.API_PORT ?? 8787}`;

const client = new pg.Client({
  host: "127.0.0.1",
  port: Number(secrets.get("POSTGRES_PORT")),
  user: "postgres.hasheemstudio",
  password: secrets.get("POSTGRES_PASSWORD"),
  database: secrets.get("POSTGRES_DB"),
});
await client.connect();

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function adminCreateUser(email, password) {
  const res = await fetch(`${gatewayBase}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
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
  return res.json();
}

const suffix = Date.now();
const user = { email: `crash-test-${suffix}@example.invalid`, password: `Cc1!${suffix}xx` };
let created;
let workerProc;

// Use Node's native --import flag to load tsx's ESM loader directly, rather than running tsx's
// own CLI (`tsx src/index.ts` / `npx tsx ...`) — the tsx CLI forks a child process internally to
// run the actual code, which left an unkillable orphan behind when this test only killed the CLI
// parent. `node --import tsx/esm` runs everything in one process with no forking, so a single
// SIGKILL to this PID is guaranteed to be the whole thing.
function spawnWorker() {
  const workerDir = join(repoRoot, "apps", "worker");
  return spawn("node", ["--import", "tsx/esm", "src/index.ts"], {
    cwd: workerDir,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, WORKER_TEST_ARTIFICIAL_DELAY_MS: "8000" },
  });
}
function killWorkerGroup(proc) {
  try {
    proc.kill("SIGKILL");
  } catch {
    // already dead
  }
}

try {
  created = await adminCreateUser(user.email, user.password);
  const session = await signIn(user.email, user.password);
  const authHeader = { Authorization: `Bearer ${session.access_token}` };

  const fixturePath = process.argv[process.argv.indexOf("--fixture") + 1];
  const fixtureBuffer = readFileSync(fixturePath);

  const uploadSession = await (
    await fetch(`${apiBase}/v1/uploads/sessions`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ filename: "crash-test.mov", declaredSizeBytes: fixtureBuffer.length, declaredMimeType: "video/quicktime" }),
    })
  ).json();
  await fetch(uploadSession.uploadUrl, { method: "PUT", headers: { apikey: anonKey, "Content-Type": "video/quicktime" }, body: fixtureBuffer });
  const finalized = await (
    await fetch(`${apiBase}/v1/uploads/sessions/${uploadSession.sessionId}/finalize`, { method: "POST", headers: authHeader })
  ).json();

  workerProc = spawnWorker();
  await sleep(2000);

  const job = await (
    await fetch(`${apiBase}/v1/jobs`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ mediaAssetId: finalized.mediaAssetId, recipe: "remux" }),
    })
  ).json();

  let sawProcessing = false;
  for (let i = 0; i < 20; i++) {
    const res = await client.query("select status from jobs where id = $1", [job.jobId]);
    if (res.rows[0]?.status === "processing") {
      sawProcessing = true;
      break;
    }
    await sleep(200);
  }
  record("job reached 'processing' before we kill the worker", sawProcessing);

  killWorkerGroup(workerProc);
  await sleep(1000);
  let processStillAlive = false;
  try {
    process.kill(workerProc.pid, 0);
    processStillAlive = true;
  } catch {
    processStillAlive = false;
  }
  record("worker process group is actually dead", !processStillAlive);

  // Force-expire the lease so the test doesn't wait the real ~10 minute TTL — documented shortcut,
  // the reconciler logic itself (docs/ARCHITECTURE.md "stale leases") is exercised for real below.
  await client.query("update jobs set lease_expires_at = now() - interval '1 second' where id = $1", [job.jobId]);
  const stillProcessing = await client.query("select status from jobs where id = $1", [job.jobId]);
  record("job is stuck in 'processing' with an expired lease after the kill", stillProcessing.rows[0]?.status === "processing");

  // Restart the worker — its reconciler should notice the stale lease within ~15s and requeue it.
  workerProc = spawnWorker();

  let finalStatus = null;
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${apiBase}/v1/jobs/${job.jobId}`, { headers: authHeader });
    const view = await res.json();
    if (["succeeded", "failed", "cancelled"].includes(view.status)) {
      finalStatus = view.status;
      break;
    }
    await sleep(1000);
  }
  record("job recovered to 'succeeded' after worker restart, not stuck forever", finalStatus === "succeeded", `status=${finalStatus}`);

  const eventsRes = await client.query(
    "select event_type from job_events where job_id = $1 order by created_at",
    [job.jobId],
  );
  const eventTypes = eventsRes.rows.map((r) => r.event_type);
  record("reconciler's lease-expiry event is actually present in job_events", eventTypes.includes("job.lease_expired_requeued"), eventTypes.join(", "));

  const attemptsRes = await client.query("select attempt_number, outcome from job_attempts where job_id = $1 order by attempt_number", [job.jobId]);
  record("job was retried as a new attempt, not silently resumed", attemptsRes.rows.length >= 2, JSON.stringify(attemptsRes.rows));
} finally {
  if (workerProc) killWorkerGroup(workerProc);
  if (created) await adminDeleteUser(created.id);
  await client.end();
  console.log("Cleaned up test user and worker process.");
}

const allPass = results.every((r) => r.pass);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
process.exit(allPass ? 0 : 1);
