import type { Pool } from "pg";

export interface StartBlock { code: "free_limit_used" | "video_waiting" | "video_in_progress"; message: string; jobId?: string; resetAt?: string }

/**
 * Decides whether an account/guest may start preparing another video right now. Paid quota (a plan with videos left)
 * always allows it. Otherwise the free plan applies: one video a day — so once today's free video has been downloaded,
 * or while another video is still being prepared or is waiting to be downloaded, we say so up front, before the user
 * spends time uploading a file that could never be downloaded.
 */
export async function checkCanStartVideo(
  pool: Pool,
  opts: { userId: string | null; workspaceIds: string[]; freePerDay: number },
): Promise<StartBlock | null> {
  const { userId, workspaceIds, freePerDay } = opts;

  if (userId) {
    const paid = (await pool.query(
      `select 1 from paid_entitlements e join payment_intents p on p.id = e.payment_intent_id
       where e.user_id = $1 and e.revoked_at is null and e.downloads_total is not null and e.starts_at <= now() and e.expires_at > now()
         and p.status = 'completed' and (select count(*) from download_grants g where g.entitlement_id = e.id) < e.downloads_total limit 1`,
      [userId],
    )).rows[0];
    if (paid) return null;
  }

  const inFlight = (await pool.query(
    `select id from jobs where workspace_id = any($1::uuid[]) and status in ('created', 'queued', 'processing', 'verifying') order by created_at desc limit 1`,
    [workspaceIds],
  )).rows[0];
  if (inFlight) return { code: "video_in_progress", message: "Your video is still being prepared. Please wait for it to finish before adding another.", jobId: inFlight.id };

  const waiting = (await pool.query(
    `select j.id from jobs j
     where j.workspace_id = any($1::uuid[]) and j.status = 'succeeded' and j.output_object_key is not null
       and j.output_deleted_at is null and j.output_retain_until > now()
       and not exists (select 1 from download_grants g where g.job_id = j.id)
     order by j.created_at desc limit 1`,
    [workspaceIds],
  )).rows[0];
  if (waiting) return { code: "video_waiting", message: "You already have a prepared video waiting. Download it first — the free plan includes 1 video a day.", jobId: waiting.id };

  if (userId) {
    const used = (await pool.query(
      `select count(*)::int n from download_grants where user_id = $1 and entitlement_id is null and granted_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')`,
      [userId],
    )).rows[0].n;
    if (used >= freePerDay) {
      const resetAt = new Date(); resetAt.setUTCHours(24, 0, 0, 0);
      return { code: "free_limit_used", message: "You’ve used today’s free video. The free plan includes 1 video a day — choose a plan for more, or come back after midnight UTC.", resetAt: resetAt.toISOString() };
    }
  }
  return null;
}
