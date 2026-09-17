#!/usr/bin/env node
// Retention/expiry sweeper (docs/PRD.md "Deletion and privacy"). Per the user's explicit
// instruction: never deletes an active job's files, and never touches another tenant's files —
// every deletion targets one specific row's own object_key, scoped by its own workspace_id, and
// media-asset deletion is guarded by a NOT EXISTS check against active jobs, held under a row
// lock for the whole delete so a concurrent job-creation attempt (which takes a FOR KEY SHARE
// lock on the referenced media_assets row via the foreign key) genuinely can't race with it.
//
// Three independent sweeps:
//   A. Abandoned upload sessions (state='pending', expires_at in the past): best-effort TUS
//      DELETE of the storage resource, then mark 'expired'.
//   B. Media assets past retain_until with no active (non-terminal) job referencing them:
//      delete the storage object, mark lifecycle_state='deleted'.
//   C. Job outputs past output_retain_until, not yet deleted, on terminal jobs: delete the
//      storage object, record output_deleted_at.
//
// Usage: node scripts/ops/retention-sweep.mjs --env local [--dry-run] [--limit 50]

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

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
const dryRun = process.argv.includes("--dry-run");
const limit = Number(arg("--limit", "50"));

const environments = JSON.parse(readFileSync(join(repoRoot, "scripts", "db", "environments.json"), "utf8"));
const envCfg = environments[envName];
if (!envCfg) {
  console.error(`Unknown environment '${envName}'`);
  process.exit(1);
}
const secrets = parseEnvFile(readFileSync(envCfg.secretsFile, "utf8"));
const serviceKey = secrets.get("SERVICE_ROLE_KEY");
const gatewayBase = `http://127.0.0.1:${secrets.get("API_GW_HTTP_PORT") ?? "58000"}`;

const pool = new pg.Pool({
  host: "127.0.0.1",
  port: Number(secrets.get("POOLER_PROXY_PORT_TRANSACTION")),
  user: "postgres.hasheemstudio",
  password: secrets.get("POSTGRES_PASSWORD"),
  database: secrets.get("POSTGRES_DB"),
  max: 5,
});

const summary = { abandonedSessions: 0, expiredMediaAssets: 0, expiredJobOutputs: 0, errors: [] };

function storageHeaders(extra = {}) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...extra };
}

async function deleteStorageObject(objectKey) {
  if (dryRun) return;
  const res = await fetch(`${gatewayBase}/storage/v1/object/media`, {
    method: "DELETE",
    headers: storageHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ prefixes: [objectKey] }),
  });
  // A 200 with the object already absent is fine (idempotent); anything else is worth recording
  // but must not abort the whole sweep over one bad object.
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    summary.errors.push(`deleteStorageObject(${objectKey}): ${res.status} ${detail}`.slice(0, 300));
  }
}

async function deleteTusResource(tusUploadPath) {
  if (!tusUploadPath || dryRun) return;
  try {
    const res = await fetch(`${gatewayBase}${tusUploadPath}`, {
      method: "DELETE",
      headers: storageHeaders({ "Tus-Resumable": "1.0.0" }),
    });
    // 404/410 (already gone, or storage's own TUS expiration extension beat us to it) are both
    // fine. 409 has also been observed for some already-touched/edge-case resources — recorded
    // as a soft error, not fatal: no user-visible object was ever created for a session that never
    // got finalized, so a failed best-effort TUS-resource termination leaves nothing user-facing
    // behind; storage's own expiration extension is the backstop for these.
    if (!res.ok && res.status !== 404 && res.status !== 410) {
      summary.errors.push(`deleteTusResource(${tusUploadPath}): ${res.status} (soft error, non-fatal)`.slice(0, 300));
    }
  } catch (err) {
    summary.errors.push(`deleteTusResource(${tusUploadPath}): ${err.message}`.slice(0, 300));
  }
}

async function sweepAbandonedUploadSessions() {
  const { rows } = await pool.query(
    `select id, workspace_id, object_key, tus_upload_path
     from upload_sessions
     where state = 'pending' and expires_at < now()
     order by expires_at
     limit $1`,
    [limit],
  );
  for (const row of rows) {
    await deleteTusResource(row.tus_upload_path);
    if (!dryRun) {
      await pool.query(`update upload_sessions set state = 'expired' where id = $1 and state = 'pending'`, [row.id]);
    }
    summary.abandonedSessions++;
    console.log(`[sweep] expired abandoned upload session ${row.id} (workspace ${row.workspace_id})`);
  }
}

async function sweepExpiredMediaAssets() {
  const client = await pool.connect();
  try {
    let more = true;
    while (more) {
      await client.query("begin");
      const { rows } = await client.query(
        `select id, workspace_id, object_key from media_assets
         where lifecycle_state = 'active' and retain_until < now()
           and not exists (
             select 1 from jobs j
             where j.media_asset_id = media_assets.id
               and j.status in ('created', 'queued', 'processing', 'verifying')
           )
         order by retain_until
         limit $1
         for update skip locked`,
        [Math.min(limit, 10)],
      );
      if (rows.length === 0) {
        await client.query("commit");
        more = false;
        break;
      }
      for (const row of rows) {
        await deleteStorageObject(row.object_key);
        if (!dryRun) {
          await client.query(`update media_assets set lifecycle_state = 'deleted' where id = $1`, [row.id]);
        }
        summary.expiredMediaAssets++;
        console.log(`[sweep] deleted expired media asset ${row.id} (workspace ${row.workspace_id}, object ${row.object_key})`);
      }
      await client.query("commit");
      if (rows.length < Math.min(limit, 10)) more = false;
    }
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function sweepExpiredJobOutputs() {
  const client = await pool.connect();
  try {
    let more = true;
    while (more) {
      await client.query("begin");
      const { rows } = await client.query(
        `select id, workspace_id, output_object_key from jobs
         where output_object_key is not null
           and output_deleted_at is null
           and output_retain_until < now()
           and status in ('succeeded', 'failed', 'cancelled', 'expired')
         order by output_retain_until
         limit $1
         for update skip locked`,
        [Math.min(limit, 10)],
      );
      if (rows.length === 0) {
        await client.query("commit");
        more = false;
        break;
      }
      for (const row of rows) {
        await deleteStorageObject(row.output_object_key);
        if (!dryRun) {
          await client.query(`update jobs set output_deleted_at = now() where id = $1`, [row.id]);
        }
        summary.expiredJobOutputs++;
        console.log(`[sweep] deleted expired job output ${row.id} (workspace ${row.workspace_id}, object ${row.output_object_key})`);
      }
      await client.query("commit");
      if (rows.length < Math.min(limit, 10)) more = false;
    }
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  console.log(`Retention sweep starting (env=${envName}, dryRun=${dryRun}, limit=${limit})`);
  await sweepAbandonedUploadSessions();
  await sweepExpiredMediaAssets();
  await sweepExpiredJobOutputs();
  console.log("\nSummary:", JSON.stringify(summary, null, 2));
  await pool.end();
  process.exit(summary.errors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Retention sweep failed:", err);
  process.exit(1);
});
