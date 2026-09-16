// Repairs stale leases left behind by a killed/crashed worker (per docs/ARCHITECTURE.md
// "A reconciler repairs undispatched work and stale leases") and undispatched outbox events that
// somehow never made it to Redis. Runs on a slow poll — this is a safety net, not the primary
// dispatch path.
import { getPool } from "./db.js";
import { getQueue } from "./queue.js";

const POLL_INTERVAL_MS = 15_000;

export function startReconciler(): { stop: () => void } {
  const pool = getPool();
  const queue = getQueue();
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      const staleRes = await pool.query(
        `update jobs
         set status = 'queued', lease_token = null, lease_expires_at = null, state_version = state_version + 1
         where status = 'processing' and lease_expires_at < now()
         returning id`,
      );
      for (const row of staleRes.rows) {
        await pool.query(
          `insert into job_events (job_id, event_type, payload) values ($1, 'job.lease_expired_requeued', '{}'::jsonb)`,
          [row.id],
        );
        // Re-enqueue directly: the original outbox event was already marked dispatched, so the
        // dispatcher's own poll won't pick this back up. removeOnFail/removeOnComplete may have
        // already cleared the old BullMQ job with this id, so this add is expected to succeed.
        await queue.add(
          "process-job",
          { jobId: row.id },
          { jobId: `${row.id}-reconciled-${Date.now()}`, attempts: 3, backoff: { type: "exponential", delay: 3000 } },
        );
        console.log(`reconciler: requeued job ${row.id} after stale lease`);
      }

      const undispatchedRes = await pool.query(
        `select id, aggregate_id from outbox_events where dispatched_at is null and created_at < now() - interval '30 seconds'`,
      );
      for (const row of undispatchedRes.rows) {
        await queue.add(
          "process-job",
          { jobId: row.aggregate_id },
          { jobId: row.aggregate_id, attempts: 3, backoff: { type: "exponential", delay: 3000 } },
        );
        await pool.query(`update outbox_events set dispatched_at = now() where id = $1`, [row.id]);
        console.log(`reconciler: dispatched stuck outbox event for job ${row.aggregate_id}`);
      }
    } catch (err) {
      console.error("reconciler tick failed", err);
    } finally {
      if (!stopped) setTimeout(tick, POLL_INTERVAL_MS);
    }
  }

  tick();
  return { stop: () => { stopped = true; } };
}
