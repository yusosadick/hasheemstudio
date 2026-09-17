#!/usr/bin/env node
// Real API read-path latency measurement against the live stack, per docs/PRD.md §8: "API p95
// under 300 ms for normal indexed metadata reads ... excluding auth providers, uploads and media
// work; error rate below 1%." Runs at increasing concurrency levels on this shared VPS with a
// conservative ceiling (default max 50 concurrent) so it doesn't starve the other projects
// sharing this host — see docs/CAPACITY.md for the host-impact numbers this run also records.
//
// Usage: node tests/load/api-latency.mjs --env local [--requests 500] [--concurrency 10,25,50]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

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

const envName = arg("--env", "local");
const totalRequests = Number(arg("--requests", "500"));
const concurrencyLevels = (arg("--concurrency", "10,25,50")).split(",").map(Number);

const environments = JSON.parse(readFileSync(join(repoRoot, "scripts", "db", "environments.json"), "utf8"));
const envCfg = environments[envName];
const secrets = parseEnvFile(readFileSync(envCfg.secretsFile, "utf8"));
const anonKey = secrets.get("ANON_KEY");
const serviceKey = secrets.get("SERVICE_ROLE_KEY");
const gatewayBase = `http://127.0.0.1:${secrets.get("API_GW_HTTP_PORT") ?? "58000"}`;
const apiBase = `http://127.0.0.1:${process.env.API_PORT ?? 8787}`;

function hostSnapshot() {
  try {
    const load = execSync("cat /proc/loadavg").toString().trim();
    const mem = execSync("free -m | awk '/^Mem:/{print $3\"MB used / \"$2\"MB total\"}'").toString().trim();
    return { load, mem };
  } catch {
    return { load: "unavailable", mem: "unavailable" };
  }
}

async function runLevel(url, headers, concurrency, requestsForLevel) {
  const latencies = [];
  let errors = 0;
  let inFlight = 0;
  let completed = 0;

  await new Promise((resolve) => {
    function launch() {
      if (completed >= requestsForLevel) return;
      if (completed + inFlight >= requestsForLevel) return;
      inFlight++;
      const start = performance.now();
      fetch(url, { headers })
        .then((res) => {
          const elapsed = performance.now() - start;
          latencies.push(elapsed);
          if (!res.ok) errors++;
        })
        .catch(() => {
          errors++;
          latencies.push(performance.now() - start);
        })
        .finally(() => {
          inFlight--;
          completed++;
          if (completed >= requestsForLevel) {
            if (inFlight === 0) resolve();
          } else {
            launch();
          }
        });
    }
    for (let i = 0; i < concurrency; i++) launch();
  });

  latencies.sort((a, b) => a - b);
  return {
    concurrency,
    requests: requestsForLevel,
    errors,
    errorRate: errors / requestsForLevel,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies[latencies.length - 1],
    min: latencies[0],
  };
}

async function main() {
  // Real authenticated user + a real job to read repeatedly — matches the "normal indexed
  // metadata read" scenario in the PRD target, not an unauthenticated static route.
  const email = `load-test-${Date.now()}@example.invalid`;
  const password = `Lt1!${Date.now()}xx`;
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
  const authHeader = { Authorization: `Bearer ${session.access_token}` };

  const fixtureBuffer = readFileSync(join(repoRoot, "tests", "fixtures", "media", "synthetic-remux-test.mov"));
  const { tusUploadFile } = await import("../lib/tus-client.mjs");
  const uploadSession = await (await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST", headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "load-test.mov", declaredSizeBytes: fixtureBuffer.length, declaredMimeType: "video/quicktime" }),
  })).json();
  await tusUploadFile({ gatewayBase, tusUploadPath: uploadSession.tusUploadPath, anonKey, accessToken: session.access_token, buffer: fixtureBuffer });
  const finalized = await (await fetch(`${apiBase}/v1/uploads/sessions/${uploadSession.sessionId}/finalize`, { method: "POST", headers: authHeader })).json();
  const job = await (await fetch(`${apiBase}/v1/jobs`, {
    method: "POST", headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ mediaAssetId: finalized.mediaAssetId, recipe: "inspect" }),
  })).json();
  await new Promise((r) => setTimeout(r, 2000)); // let it settle to 'succeeded' so reads are steady-state

  console.log(`Target: GET /v1/jobs/${job.jobId} (authenticated, indexed lookup + join)\n`);
  const before = hostSnapshot();
  console.log("Host before:", before);

  const results = [];
  for (const c of concurrencyLevels) {
    const requestsForLevel = Math.min(totalRequests, c * 10);
    console.log(`\nRunning concurrency=${c}, requests=${requestsForLevel}...`);
    const result = await runLevel(`${apiBase}/v1/jobs/${job.jobId}`, authHeader, c, requestsForLevel);
    results.push(result);
    console.log(`  p50=${result.p50.toFixed(1)}ms p95=${result.p95.toFixed(1)}ms p99=${result.p99.toFixed(1)}ms max=${result.max.toFixed(1)}ms errorRate=${(result.errorRate * 100).toFixed(2)}%`);
  }

  const after = hostSnapshot();
  console.log("\nHost after:", after);

  // Cleanup
  await fetch(`${gatewayBase}/auth/v1/admin/users/${created.id}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });

  const report = {
    timestamp: new Date().toISOString(),
    target: "GET /v1/jobs/:id (authenticated, indexed lookup + join)",
    hostBefore: before,
    hostAfter: after,
    results,
    prdTarget: "p95 < 300ms, error rate < 1%, excluding auth providers/uploads/media work",
    verdict: results.every((r) => r.p95 < 300 && r.errorRate < 0.01) ? "MEETS PRD TARGET at tested concurrency levels" : "DOES NOT MEET PRD TARGET at all tested concurrency levels — see per-level results",
  };

  const evidenceDir = join(repoRoot, "docs", "evidence", "phase7-capacity");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(join(evidenceDir, "api-latency-report.json"), JSON.stringify(report, null, 2));
  console.log(`\nSaved docs/evidence/phase7-capacity/api-latency-report.json`);
  console.log(`\nVerdict: ${report.verdict}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
