#!/usr/bin/env node
// Real regression test for a serious bug found and fixed this session: deleting a user via the
// GoTrue admin API — the only account-deletion mechanism that exists today, and a P0
// docs/PRD.md requirement ("Delete individual files/jobs or request account deletion") — failed
// for EVERY user with a real Postgres foreign-key violation, because several tables referencing
// auth.users(id) were missing ON DELETE CASCADE (supabase/migrations/0011, 0012). This test builds
// a real user with a real workspace, a real uploaded asset, and a real completed job, then deletes
// the user and confirms every dependent row is actually gone — not just that the API call
// returned 200.
//
// Usage: node tests/integration/account-deletion.mjs --env local

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { tusUploadFile } from "../lib/tus-client.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

function arg(name, fallback) {
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
const email = `deletion-test-${suffix}@example.invalid`;
const password = `Dt1!${suffix}xx`;

try {
  const created = await (await fetch(`${gatewayBase}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })).json();
  const userId = created.id;
  const session = await (await fetch(`${gatewayBase}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })).json();
  const authHeader = { Authorization: `Bearer ${session.access_token}` };

  const wsRes = await client.query("select workspace_id from workspace_members where user_id = $1", [userId]);
  const workspaceId = wsRes.rows[0].workspace_id;

  // Build real dependent data: an uploaded asset and a completed job.
  const fixtureBuffer = readFileSync(join(repoRoot, "tests", "fixtures", "media", "synthetic-remux-test.mov"));
  const uploadSession = await (await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST", headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "deletion-test.mov", declaredSizeBytes: fixtureBuffer.length, declaredMimeType: "video/quicktime" }),
  })).json();
  await tusUploadFile({ gatewayBase, tusUploadPath: uploadSession.tusUploadPath, anonKey, accessToken: session.access_token, buffer: fixtureBuffer });
  const finalized = await (await fetch(`${apiBase}/v1/uploads/sessions/${uploadSession.sessionId}/finalize`, { method: "POST", headers: authHeader })).json();
  const job = await (await fetch(`${apiBase}/v1/jobs`, {
    method: "POST", headers: { ...authHeader, "Content-Type": "application/json" },
    body: JSON.stringify({ mediaAssetId: finalized.mediaAssetId, recipe: "inspect" }),
  })).json();

  let terminal = false;
  for (let i = 0; i < 30; i++) {
    const view = await (await fetch(`${apiBase}/v1/jobs/${job.jobId}`, { headers: authHeader })).json();
    if (["succeeded", "failed"].includes(view.status)) { terminal = true; break; }
    await sleep(1000);
  }
  record("test setup: job reached a terminal state before deletion", terminal);

  // Confirm all the dependent rows genuinely exist before deletion.
  const before = await client.query(
    `select
       (select count(*) from workspaces where id = $1) as workspaces,
       (select count(*) from workspace_members where workspace_id = $1) as members,
       (select count(*) from media_assets where workspace_id = $1) as assets,
       (select count(*) from upload_sessions where workspace_id = $1) as sessions,
       (select count(*) from jobs where workspace_id = $1) as jobs,
       (select count(*) from usage_reservations where workspace_id = $1) as reservations,
       (select count(*) from profiles where id = $2) as profile`,
    [workspaceId, userId],
  );
  record(
    "all dependent rows exist before deletion (real setup, not a no-op test)",
    Object.values(before.rows[0]).every((n) => Number(n) > 0),
    JSON.stringify(before.rows[0]),
  );

  // The actual regression check: delete the user via the real admin API.
  const deleteRes = await fetch(`${gatewayBase}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  record("DELETE /auth/v1/admin/users/:id returns 200 (was a real 500/23503 before the fix)", deleteRes.ok, `status=${deleteRes.status}`);

  const after = await client.query(
    `select
       (select count(*) from auth.users where id = $2) as user_row,
       (select count(*) from workspaces where id = $1) as workspaces,
       (select count(*) from workspace_members where workspace_id = $1) as members,
       (select count(*) from media_assets where workspace_id = $1) as assets,
       (select count(*) from upload_sessions where workspace_id = $1) as sessions,
       (select count(*) from jobs where workspace_id = $1) as jobs,
       (select count(*) from usage_reservations where workspace_id = $1) as reservations,
       (select count(*) from profiles where id = $2) as profile`,
    [workspaceId, userId],
  );
  record(
    "every dependent row is actually gone after deletion, not just the auth.users row",
    Object.values(after.rows[0]).every((n) => Number(n) === 0),
    JSON.stringify(after.rows[0]),
  );
} finally {
  await client.end();
}

const allPass = results.every((r) => r.pass);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
process.exit(allPass ? 0 : 1);
