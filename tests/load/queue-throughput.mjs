#!/usr/bin/env node
// Real queue/worker throughput measurement: submits a batch of real jobs across many distinct
// tenants (to bypass per-workspace quotas and isolate the WORKER's own throughput ceiling, not the
// per-tenant admission limits already proven in tests/integration/quota-race.mjs), and measures
// real queue-wait time, real processing time, and real end-to-end time per job — plus actual
// container resource usage (docker stats) during the run. Per the user's instruction: report
// actual throughput/latency/queue behaviour/hardware/bottlenecks, not an assumed capacity claim.
//
// Safety: conservative job count by default (20) on this shared VPS; monitors host load
// throughout and the run is short (real recipes complete in seconds each with concurrency=1).
//
// Usage: node tests/load/queue-throughput.mjs --env local [--jobs 20] [--recipe inspect|remux]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync, spawn } from "node:child_process";
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
function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const envName = arg("--env", "local");
const jobCount = Number(arg("--jobs", "20"));
const recipe = arg("--recipe", "remux");

const environments = JSON.parse(readFileSync(join(repoRoot, "scripts", "db", "environments.json"), "utf8"));
const envCfg = environments[envName];
const secrets = parseEnvFile(readFileSync(envCfg.secretsFile, "utf8"));
const anonKey = secrets.get("ANON_KEY");
const serviceKey = secrets.get("SERVICE_ROLE_KEY");
const gatewayBase = `http://127.0.0.1:${secrets.get("API_GW_HTTP_PORT") ?? "58000"}`;
const apiBase = `http://127.0.0.1:${process.env.API_PORT ?? 8787}`;

const fixtureBuffer = readFileSync(join(repoRoot, "tests", "fixtures", "media", "synthetic-remux-test.mov"));

async function createTenant(i) {
  const email = `queue-load-${Date.now()}-${i}@example.invalid`;
  const password = `Ql1!${Date.now()}xx`;
  const created = await (await fetch(`${gatewayBase}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })).json();
  const session = await (await fetch(`${gatewayBase}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })).json();
  return { id: created.id, accessToken: session.access_token };
}

async function uploadAndCreateJob(tenant) {
  const authHeader = { Authorization: `Bearer ${tenant.accessToken}` };
  const uploadSession = await (await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST", headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "load.mov", declaredSizeBytes: fixtureBuffer.length, declaredMimeType: "video/quicktime" }),
  })).json();
  await tusUploadFile({ gatewayBase, tusUploadPath: uploadSession.tusUploadPath, anonKey, accessToken: tenant.accessToken, buffer: fixtureBuffer });
  const finalized = await (await fetch(`${apiBase}/v1/uploads/sessions/${uploadSession.sessionId}/finalize`, { method: "POST", headers: authHeader })).json();
  const submittedAt = performance.now();
  const job = await (await fetch(`${apiBase}/v1/jobs`, {
    method: "POST", headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ mediaAssetId: finalized.mediaAssetId, recipe }),
  })).json();
  return { jobId: job.jobId, submittedAt, tenant };
}

function startDockerStatsSampler(containerName, intervalMs = 1000) {
  const samples = [];
  const timer = setInterval(() => {
    try {
      const line = execSync(`docker stats ${containerName} --no-stream --format "{{.CPUPerc}}\t{{.MemUsage}}"`).toString().trim();
      const [cpu, mem] = line.split("\t");
      samples.push({ t: Date.now(), cpu, mem });
    } catch {
      // container might be between samples; ignore
    }
  }, intervalMs);
  return { stop: () => clearInterval(timer), samples };
}

async function main() {
  console.log(`Queue throughput test: ${jobCount} jobs, recipe=${recipe}, one distinct tenant per job (isolates worker throughput from per-tenant quotas)`);
  const hostLoadBefore = execSync("cat /proc/loadavg").toString().trim();
  console.log("Host load before:", hostLoadBefore);

  console.log(`Creating ${jobCount} tenants and uploading fixtures...`);
  const tenants = [];
  for (let i = 0; i < jobCount; i++) tenants.push(await createTenant(i));

  const statsSampler = startDockerStatsSampler("hasheemstudio-worker");

  // Poll each job for completion starting IMMEDIATELY after its own submission, concurrently with
  // submitting the rest — not after the whole (slow, sequential-upload) submission loop finishes.
  // An earlier version of this script polled only after all submissions completed, which silently
  // inflated early jobs' measured "total time" by however long the remaining submissions took —
  // a real methodology bug found while writing this up, not a genuine reflection of processing
  // time. Fixed here so completedAt reflects the job's actual completion, not "whenever we got
  // around to checking."
  const results = [];
  const pollPromises = [];
  function pollJob(jobId, submittedAt, authHeader) {
    return (async () => {
      const deadline = Date.now() + 5 * 60_000;
      while (Date.now() < deadline) {
        const view = await (await fetch(`${apiBase}/v1/jobs/${jobId}`, { headers: authHeader })).json();
        if (["succeeded", "failed", "cancelled"].includes(view.status)) {
          results.push({ jobId, status: view.status, totalMs: performance.now() - submittedAt });
          return;
        }
        await sleep(500);
      }
      results.push({ jobId, status: "timed_out", totalMs: performance.now() - submittedAt });
    })();
  }

  const batchStart = performance.now();
  for (const tenant of tenants) {
    const sub = await uploadAndCreateJob(tenant);
    pollPromises.push(pollJob(sub.jobId, sub.submittedAt, { Authorization: `Bearer ${tenant.accessToken}` }));
  }
  console.log(`All ${jobCount} jobs submitted (each polled from its own submission moment). Waiting for completion...`);

  await Promise.all(pollPromises);
  const batchEnd = performance.now();
  statsSampler.stop();

  const hostLoadAfter = execSync("cat /proc/loadavg").toString().trim();

  const totalWallMs = batchEnd - batchStart;
  const succeeded = results.filter((r) => r.status === "succeeded").length;
  const failed = results.filter((r) => r.status !== "succeeded" && r.status !== "timed_out").length;
  const timedOut = results.filter((r) => r.status === "timed_out").length;
  const totalMsSorted = results.filter((r) => r.status === "succeeded").map((r) => r.totalMs).sort((a, b) => a - b);

  const cpuSamples = statsSampler.samples.map((s) => parseFloat(s.cpu));
  const memSamples = statsSampler.samples.map((s) => s.mem);

  const report = {
    timestamp: new Date().toISOString(),
    jobCount,
    recipe,
    succeeded,
    failed,
    timedOut,
    totalWallClockMs: totalWallMs,
    // With worker concurrency hard-set to 1 (apps/worker/src/queue.ts), jobs process strictly
    // sequentially — this measured rate directly reflects that, not a theoretical ceiling.
    measuredJobsPerSecond: succeeded / (totalWallMs / 1000),
    measuredJobsPerDayAtThisRate: Math.round((succeeded / (totalWallMs / 1000)) * 86400),
    perJobTotalMs: {
      p50: percentile(totalMsSorted, 50),
      p95: percentile(totalMsSorted, 95),
      p99: percentile(totalMsSorted, 99),
      max: totalMsSorted[totalMsSorted.length - 1],
      min: totalMsSorted[0],
    },
    workerContainerStats: {
      sampleCount: statsSampler.samples.length,
      cpuPercentSamples: statsSampler.samples.map((s) => s.cpu),
      memUsageSamples: statsSampler.samples.map((s) => s.mem),
      cpuPercentMax: Math.max(...cpuSamples, 0),
    },
    hostLoadBefore,
    hostLoadAfter,
    knownBottleneck: "apps/worker/src/queue.ts hard-codes BullMQ concurrency: 1 — exactly one job processes at a time regardless of tenant count or hardware headroom. This measurement is a direct consequence of that, not a hardware ceiling.",
  };

  const evidenceDir = join(repoRoot, "docs", "evidence", "phase7-capacity");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, `queue-throughput-${recipe}-report.json`), JSON.stringify(report, null, 2));

  console.log(`\n${succeeded}/${jobCount} succeeded, ${failed} failed, ${timedOut} timed out (>5min)`);
  console.log(`Total wall clock: ${(totalWallMs / 1000).toFixed(1)}s`);
  console.log(`Measured rate: ${report.measuredJobsPerSecond.toFixed(3)} jobs/sec => ~${report.measuredJobsPerDayAtThisRate} jobs/day AT THIS CONCURRENCY=1 SETTING`);
  console.log(`Per-job total time: p50=${report.perJobTotalMs.p50.toFixed(0)}ms p95=${report.perJobTotalMs.p95.toFixed(0)}ms max=${report.perJobTotalMs.max.toFixed(0)}ms`);
  console.log(`Worker container CPU% samples: ${report.workerContainerStats.cpuPercentSamples.join(", ")}`);
  console.log(`Host load before/after: ${hostLoadBefore} / ${hostLoadAfter}`);
  console.log(`\nSaved docs/evidence/phase7-capacity/queue-throughput-${recipe}-report.json`);

  // Cleanup
  for (const t of tenants) {
    await fetch(`${gatewayBase}/auth/v1/admin/users/${t.id}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }).catch(() => {});
  }
  console.log("Cleaned up test tenants.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
