// Polls the transactional outbox and enqueues into BullMQ. This is the ONLY thing that ever
// writes to Redis on behalf of a job — the jobs table (Postgres) stays authoritative regardless
// of Redis state, per docs/ARCHITECTURE.md "Redis loss must not erase the list of accepted jobs."
// Polling, not LISTEN/NOTIFY yet — an honest simplification, see docs/STATUS.md.
import { getPool } from "./db.js";
import { getQueue } from "./queue.js";

const POLL_INTERVAL_MS = 1000;

export function startDispatcher(): { stop: () => void } {
  const pool = getPool();
  const queue = getQueue();
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      const res = await pool.query(
        `select id, aggregate_id from outbox_events where dispatched_at is null order by created_at limit 20`,
      );
      for (const row of res.rows) {
        await queue.add(
          "process-job",
          { jobId: row.aggregate_id },
          {
            jobId: row.aggregate_id,
            removeOnComplete: 100,
            removeOnFail: 100,
            attempts: 3,
            backoff: { type: "exponential", delay: 3000 },
          },
        );
        await pool.query(`update outbox_events set dispatched_at = now() where id = $1`, [row.id]);
      }
    } catch (err) {
      console.error("dispatcher tick failed", err);
    } finally {
      if (!stopped) setTimeout(tick, POLL_INTERVAL_MS);
    }
  }

  tick();
  return { stop: () => { stopped = true; } };
}
