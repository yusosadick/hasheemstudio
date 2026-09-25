// Runs inside the worker every 30 s so retention is actually enforced (the standalone sweep script was never
// scheduled). Processed results live for 5 minutes (jobs.output_retain_until, set when the job succeeds); this loop
// deletes the file 60 s after that moment so a download that started right before expiry can finish. Source uploads
// are removed once they pass retain_until and no job still needs them.
import type { Pool } from "pg";
import { getPool } from "./db.js";
import { deleteObject } from "./storage.js";

export const OUTPUT_DELETE_GRACE_SECONDS = 60;
const INTERVAL_MS = 30_000;
const BATCH = 20;

export interface SweepResult { outputs: number; sources: number; sessions: number }

export async function sweepOnce(pool: Pool = getPool(), del: (key: string) => Promise<void> = deleteObject): Promise<SweepResult> {
  const result: SweepResult = { outputs: 0, sources: 0, sessions: 0 };

  const outputs = await pool.query(
    `select id, output_object_key from jobs
     where output_object_key is not null and output_deleted_at is null
       and output_retain_until < now() - make_interval(secs => $1)
       and status in ('succeeded', 'failed', 'cancelled', 'expired')
     order by output_retain_until limit $2`,
    [OUTPUT_DELETE_GRACE_SECONDS, BATCH],
  );
  for (const row of outputs.rows) {
    try {
      await del(row.output_object_key);
      await pool.query(`update jobs set output_deleted_at = now() where id = $1 and output_deleted_at is null`, [row.id]);
      result.outputs++;
    } catch (err) {
      console.error(`retention: could not delete output of job ${row.id}, will retry:`, (err as Error).message);
    }
  }

  const sources = await pool.query(
    `select id, object_key from media_assets
     where lifecycle_state = 'active' and retain_until < now()
       and not exists (select 1 from jobs j where j.media_asset_id = media_assets.id and j.status in ('created', 'queued', 'processing', 'verifying'))
     order by retain_until limit $1`,
    [BATCH],
  );
  for (const row of sources.rows) {
    try {
      await del(row.object_key);
      await pool.query(`update media_assets set lifecycle_state = 'deleted' where id = $1`, [row.id]);
      result.sources++;
    } catch (err) {
      console.error(`retention: could not delete source ${row.id}, will retry:`, (err as Error).message);
    }
  }

  const sessions = await pool.query(`update upload_sessions set state = 'expired' where state = 'pending' and expires_at < now() returning id`);
  result.sessions = sessions.rowCount ?? 0;
  return result;
}

export function startRetentionSweeper(): { stop: () => void } {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const r = await sweepOnce();
      if (r.outputs || r.sources || r.sessions) console.log(`retention: deleted ${r.outputs} result(s), ${r.sources} source(s); expired ${r.sessions} abandoned upload(s)`);
    } catch (err) {
      console.error("retention sweep failed:", (err as Error).message);
    } finally {
      running = false;
    }
  }, INTERVAL_MS);
  timer.unref?.();
  return { stop: () => clearInterval(timer) };
}
