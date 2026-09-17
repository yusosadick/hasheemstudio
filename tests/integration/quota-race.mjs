#!/usr/bin/env node
// Real concurrency test for the atomic usage-reservation fix in apps/api/src/routes/jobs.ts.
// Fires many concurrent job-creation requests for the SAME workspace and confirms the daily quota
// is enforced EXACTLY — not over-admitted — under real concurrency. This is the test that would
// have caught the pre-fix bug (pool.query("begin") not guaranteeing the begin/count/insert/commit
// sequence ran on one connection, which made the count-then-insert non-atomic under load).
//
// Uses a temporary, high-max_active_jobs test plan so the daily-quota check (not the concurrent-
// active-jobs check) is the one being isolated and tested.
//
// Usage: node tests/integration/quota-race.mjs --env local

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
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

const envName = arg("--env", "local");
const environments = JSON.parse(readFileSync(join(repoRoot, "scripts", "db", "environments.json"), "utf8"));
const envCfg = environments[envName];
const secrets = parseEnvFile(readFileSync(envCfg.secretsFile, "utf8"));
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

const suffix = Date.now();
const email = `quota-race-${suffix}@example.invalid`;
const password = `Qr1!${suffix}xx`;
const TEST_PLAN_ID = `race-test-plan-${suffix}`;
const DAILY_LIMIT = 5;
const CONCURRENT_REQUESTS = 20;
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

  const wsRes = await client.query("select workspace_id from workspace_members where user_id = $1", [userId]);
  const workspaceId = wsRes.rows[0].workspace_id;

  // A generous active-jobs ceiling isolates the daily-quota path as the thing under test.
  await client.query(
    `insert into plans (id, name, max_upload_bytes, max_duration_seconds, max_jobs_per_day, max_active_jobs, allowed_recipes)
     values ($1, 'Race Test Plan', 104857600, 120, $2, 1000, array['inspect','remux','compat_encode'])`,
    [TEST_PLAN_ID, DAILY_LIMIT],
  );
  await client.query(
    `update workspace_entitlements set plan_id = $2 where workspace_id = $1`,
    [workspaceId, TEST_PLAN_ID],
  );

  const fixtureBuffer = readFileSync(join(repoRoot, "tests", "fixtures", "media", "synthetic-remux-test.mov"));
  const uploadSession = await (await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST",
    headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "race-test.mov", declaredSizeBytes: fixtureBuffer.length, declaredMimeType: "video/quicktime" }),
  })).json();
  await tusUploadFile({ gatewayBase, tusUploadPath: uploadSession.tusUploadPath, anonKey, accessToken: session.access_token, buffer: fixtureBuffer });
  const finalized = await (await fetch(`${apiBase}/v1/uploads/sessions/${uploadSession.sessionId}/finalize`, { method: "POST", headers: authHeader })).json();

  // Fire all requests essentially simultaneously — the real race condition window.
  const responses = await Promise.all(
    Array.from({ length: CONCURRENT_REQUESTS }, () =>
      fetch(`${apiBase}/v1/jobs`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ mediaAssetId: finalized.mediaAssetId, recipe: "inspect" }),
      }),
    ),
  );

  const admitted = responses.filter((r) => r.status === 201).length;
  const rejected = responses.filter((r) => r.status === 429).length;
  const other = responses.filter((r) => r.status !== 201 && r.status !== 429);

  record(
    `exactly ${DAILY_LIMIT} of ${CONCURRENT_REQUESTS} concurrent requests admitted (no over-admission)`,
    admitted === DAILY_LIMIT,
    `admitted=${admitted} rejected=${rejected} other=${other.length}`,
  );
  record("no unexpected response codes under concurrency", other.length === 0, JSON.stringify(other.map((r) => r.status)));

  // Cross-check against the database directly — the reservations table must agree with what the
  // API told the clients, not just "looked right" from the HTTP responses alone.
  const dbCountRes = await client.query(
    `select count(*)::int as n from usage_reservations where workspace_id = $1 and status != 'released'`,
    [workspaceId],
  );
  record(
    "usage_reservations row count in the database matches the admitted count exactly",
    dbCountRes.rows[0].n === DAILY_LIMIT,
    `db count=${dbCountRes.rows[0].n}`,
  );

  const jobCountRes = await client.query(`select count(*)::int as n from jobs where workspace_id = $1`, [workspaceId]);
  record(
    "jobs table row count matches too (no orphaned reservation without a job or vice versa)",
    jobCountRes.rows[0].n === DAILY_LIMIT,
    `jobs count=${jobCountRes.rows[0].n}`,
  );
} finally {
  if (userId) {
    await fetch(`${gatewayBase}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  }
  await client.query(`delete from plans where id = $1`, [TEST_PLAN_ID]).catch(() => {});
  await client.end();
  console.log("Cleaned up test user and temporary plan.");
}

const allPass = results.every((r) => r.pass);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
process.exit(allPass ? 0 : 1);
