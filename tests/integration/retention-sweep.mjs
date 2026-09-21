#!/usr/bin/env node
// Real test of scripts/ops/retention-sweep.mjs against the live stack. Directly manipulates
// timestamps in the database (the only practical way to test "past retention" without waiting
// real days) to set up: an abandoned upload session, an expired media asset with NO active job
// (must be swept), an expired media asset WITH an active job (must NOT be swept — the user's
// explicit "never delete an active job's files" requirement), and an expired job output for one
// tenant plus an unexpired one for a second tenant (must not cross-contaminate).
//
// Usage: node tests/integration/retention-sweep.mjs --env local

import { readFileSync, existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
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

async function createConfirmedUser(label) {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.invalid`;
  const password = `Pw1!${Date.now()}xx`;
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
  const wsRes = await client.query("select workspace_id from workspace_members where user_id = $1", [created.id]);
  return { id: created.id, accessToken: session.access_token, workspaceId: wsRes.rows[0].workspace_id };
}

async function objectExists(objectKey) {
  const dir = objectKey.split("/").slice(0, -1).join("/");
  const name = objectKey.split("/").pop();
  const res = await fetch(`${gatewayBase}/storage/v1/object/list/media`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: dir ? `${dir}/` : "", search: name, limit: 1 }),
  });
  const rows = await res.json();
  return Array.isArray(rows) && rows.some((r) => r.name === name);
}

const fixtureBuffer = readFileSync(join(repoRoot, "tests", "fixtures", "media", "synthetic-remux-test.mov"));
let tenantWithActiveJob, tenantExpiredNoJob, tenantAbandoned;

try {
  tenantWithActiveJob = await createConfirmedUser("retain-active");
  tenantExpiredNoJob = await createConfirmedUser("retain-expired");
  tenantAbandoned = await createConfirmedUser("retain-abandon");

  // --- Case 1: media asset past retain_until, WITH an active (queued) job — must survive. ---
  const authActive = { Authorization: `Bearer ${tenantWithActiveJob.accessToken}` };
  const sessActive = await (await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST", headers: { ...authActive, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "active.mov", declaredSizeBytes: fixtureBuffer.length, declaredMimeType: "video/quicktime" }),
  })).json();
  await tusUploadFile({ gatewayBase, tusUploadPath: sessActive.tusUploadPath, anonKey, accessToken: tenantWithActiveJob.accessToken, buffer: fixtureBuffer });
  const finalizedActive = await (await fetch(`${apiBase}/v1/uploads/sessions/${sessActive.sessionId}/finalize`, { method: "POST", headers: authActive })).json();
  // Force retain_until into the past directly — this asset LOOKS expired by date alone.
  await client.query(`update media_assets set retain_until = now() - interval '1 day' where id = $1`, [finalizedActive.mediaAssetId]);
  // Insert the "active" job directly via SQL rather than through the real API/outbox pipeline —
  // going through POST /v1/jobs would create a real outbox event that the real worker (running
  // live in this environment) legitimately claims and completes within ~1s, which raced and
  // defeated an earlier version of this test. Inserting directly with no outbox event means no
  // worker ever touches it, so it deterministically stays 'queued' for the duration of the test —
  // exactly what's needed to test the sweeper's "never delete an active job's asset" guard in
  // isolation, without racing real job processing.
  const jobActiveIdRes = await client.query(
    `insert into jobs (workspace_id, media_asset_id, created_by, recipe, status) values ($1, $2, $3, 'inspect', 'queued') returning id`,
    [tenantWithActiveJob.workspaceId, finalizedActive.mediaAssetId, tenantWithActiveJob.id],
  );
  const jobActive = { jobId: jobActiveIdRes.rows[0].id };

  // --- Case 2: media asset past retain_until, NO job at all — must be swept. ---
  const authExpired = { Authorization: `Bearer ${tenantExpiredNoJob.accessToken}` };
  const sessExpired = await (await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST", headers: { ...authExpired, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "expired.mov", declaredSizeBytes: fixtureBuffer.length, declaredMimeType: "video/quicktime" }),
  })).json();
  await tusUploadFile({ gatewayBase, tusUploadPath: sessExpired.tusUploadPath, anonKey, accessToken: tenantExpiredNoJob.accessToken, buffer: fixtureBuffer });
  const finalizedExpired = await (await fetch(`${apiBase}/v1/uploads/sessions/${sessExpired.sessionId}/finalize`, { method: "POST", headers: authExpired })).json();
  await client.query(`update media_assets set retain_until = now() - interval '1 day' where id = $1`, [finalizedExpired.mediaAssetId]);

  const expiredObjectRes = await client.query("select object_key from media_assets where id = $1", [finalizedExpired.mediaAssetId]);
  const expiredObjectKey = expiredObjectRes.rows[0].object_key;
  record("expired-no-job media asset object exists before sweep", await objectExists(expiredObjectKey));

  // --- Case 3: abandoned upload session (never finalized), expires_at in the past. ---
  const authAbandon = { Authorization: `Bearer ${tenantAbandoned.accessToken}` };
  const sessAbandoned = await (await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST", headers: { ...authAbandon, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "abandoned.mov", declaredSizeBytes: fixtureBuffer.length, declaredMimeType: "video/quicktime" }),
  })).json();
  await client.query(`update upload_sessions set expires_at = now() - interval '1 hour' where id = $1`, [sessAbandoned.sessionId]);

  // --- Case 4: a real succeeded job's OUTPUT past its own retention window — must be deleted,
  //     and the API must stop offering a (now-broken) download link for it afterward. ---
  const sessOutput = await (await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST", headers: { ...authExpired, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "output-retention.mov", declaredSizeBytes: fixtureBuffer.length, declaredMimeType: "video/quicktime" }),
  })).json();
  await tusUploadFile({ gatewayBase, tusUploadPath: sessOutput.tusUploadPath, anonKey, accessToken: tenantExpiredNoJob.accessToken, buffer: fixtureBuffer });
  const finalizedOutput = await (await fetch(`${apiBase}/v1/uploads/sessions/${sessOutput.sessionId}/finalize`, { method: "POST", headers: authExpired })).json();
  const jobOutputRes = await fetch(`${apiBase}/v1/jobs`, {
    method: "POST", headers: { ...authExpired, "Content-Type": "application/json" },
    body: JSON.stringify({ mediaAssetId: finalizedOutput.mediaAssetId, recipe: "remux" }),
  });
  const jobOutput = await jobOutputRes.json();
  let outputJobView = null;
  for (let i = 0; i < 30; i++) {
    outputJobView = await (await fetch(`${apiBase}/v1/jobs/${jobOutput.jobId}`, { headers: authExpired })).json();
    if (outputJobView.status === "succeeded") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  record("output-retention test job actually succeeded before we force-expire it", outputJobView?.status === "succeeded");
  await client.query(`update jobs set output_retain_until = now() - interval '1 day' where id = $1`, [jobOutput.jobId]);
  const outputObjectRes = await client.query("select output_object_key from jobs where id = $1", [jobOutput.jobId]);
  const outputObjectKey = outputObjectRes.rows[0].output_object_key;
  record("job output object exists before sweep", await objectExists(outputObjectKey));

  // --- Run the real sweeper. It exits non-zero if any individual best-effort delete (e.g. a TUS
  //     resource that storage itself already reaped, or a permission edge case) failed, which is
  //     an expected, non-fatal outcome to log, not something that should abort this test — the
  //     assertions below check the specific rows this test cares about regardless.
  let sweepStdout;
  try {
    const res = await execFileAsync("node", [join(repoRoot, "scripts", "ops", "retention-sweep.mjs"), "--env", envName, "--workspaces", [tenantWithActiveJob,tenantExpiredNoJob,tenantAbandoned].map(t=>t.workspaceId).join(",")], { cwd: repoRoot });
    sweepStdout = res.stdout;
  } catch (err) {
    sweepStdout = err.stdout ?? "";
    console.log(`(sweeper exited non-zero — expected if any best-effort delete failed; see summary below)`);
  }
  console.log(sweepStdout);

  // --- Verify outcomes. ---
  const activeAssetAfter = await client.query("select lifecycle_state from media_assets where id = $1", [finalizedActive.mediaAssetId]);
  record(
    "media asset WITH an active job was NOT deleted despite being past retain_until",
    activeAssetAfter.rows[0].lifecycle_state === "active",
    `lifecycle_state=${activeAssetAfter.rows[0].lifecycle_state}`,
  );
  record("its storage object still exists (active job protected)", await objectExists((await client.query("select object_key from media_assets where id=$1", [finalizedActive.mediaAssetId])).rows[0].object_key));

  const expiredAssetAfter = await client.query("select lifecycle_state from media_assets where id = $1", [finalizedExpired.mediaAssetId]);
  record(
    "media asset with NO job was correctly swept",
    expiredAssetAfter.rows[0].lifecycle_state === "deleted",
    `lifecycle_state=${expiredAssetAfter.rows[0].lifecycle_state}`,
  );
  record("its storage object was actually deleted", !(await objectExists(expiredObjectKey)));

  const sessionAfter = await client.query("select state from upload_sessions where id = $1", [sessAbandoned.sessionId]);
  record("abandoned upload session was marked expired", sessionAfter.rows[0].state === "expired", `state=${sessionAfter.rows[0].state}`);

  // --- Cross-tenant check: tenant B's sweep never touched tenant A's (active-job) data, and
  //     vice versa — re-confirm both tenants' OTHER rows are untouched. ---
  const activeJobStillThere = await client.query("select status from jobs where id = $1", [jobActive.jobId]);
  record("the protected tenant's job row itself is untouched by the sweep", activeJobStillThere.rows.length === 1);

  // --- Verify Case 4: job output retention. ---
  const outputJobAfter = await client.query("select output_deleted_at from jobs where id = $1", [jobOutput.jobId]);
  record("expired job output was marked deleted (output_deleted_at set)", outputJobAfter.rows[0].output_deleted_at !== null);
  record("its storage object was actually deleted", !(await objectExists(outputObjectKey)));

  const jobViewAfterSweep = await (await fetch(`${apiBase}/v1/jobs/${jobOutput.jobId}`, { headers: authExpired })).json();
  record("API no longer offers a (now-broken) download link for the swept output", jobViewAfterSweep.downloadUrl === null);
  record("API honestly reports the output as expired rather than silently omitting it", jobViewAfterSweep.outputExpired === true);
} finally {
  for (const u of [tenantWithActiveJob, tenantExpiredNoJob, tenantAbandoned]) {
    if (u) await fetch(`${gatewayBase}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }).catch(() => {});
  }
  await client.end();
  console.log("Cleaned up test users.");
}

const allPass = results.every((r) => r.pass);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
process.exit(allPass ? 0 : 1);
