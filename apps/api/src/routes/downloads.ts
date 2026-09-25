import { checkoutEnabled } from "../payments/snippe.js";
import type { FastifyInstance } from "fastify";
import { requireActor, canAccessJob } from "../actor.js";
import { getPool } from "../db.js";
import { resolvePersonalWorkspaceId } from "../workspace.js";
import { createSignedDownloadUrl } from "../storage.js";
import { safeOutputFileName } from "../publicReport.js";

export async function downloadsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/jobs/:id/download", { preHandler: requireActor }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!request.userId) return reply.code(401).send({ error: "login_required", message: "Sign in to download your video. Your processed file will be kept here." });
    const { id } = request.params as { id: string };
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: "invalid_job_id" });
    const pool = getPool();
    const result = await pool.query(`select j.*, ma.size_bytes, (select vr.created_at from verification_reports vr where vr.job_id=j.id order by vr.created_at desc limit 1) as completed_at from jobs j join media_assets ma on ma.id=j.media_asset_id where j.id=$1`, [id]);
    const job = result.rows[0];
    if (!job) return reply.code(404).send({ error: "not_found" });
    if (!await canAccessJob(request, job)) return reply.code(403).send({ error: "forbidden" });
    const workspaceId = await resolvePersonalWorkspaceId(pool, request.userId);
    const client = await pool.connect();
    try {
      await client.query("begin");
      // Account lock serializes different jobs; job lock serializes competing account claims.
      await client.query(`select id from profiles where id=$1 for update`, [request.userId]);
      const owner = (await client.query(`select w.created_by, exists(select 1 from guest_sessions g where g.workspace_id=w.id) is_guest from workspaces w where w.id=$1 for update`, [job.workspace_id])).rows[0];
      if (owner.is_guest && owner.created_by && owner.created_by !== request.userId) {
        await client.query("rollback"); return reply.code(403).send({error:"already_claimed"});
      }
      const current = await client.query(`select * from jobs where id=$1 for update`, [id]);
      const output = current.rows[0];
      if (output.status !== "succeeded" || !output.output_object_key) {
        await client.query("rollback");
        if (output.status === "succeeded") return reply.code(409).send({ error: "no_output", message: "This job didn't create a video file, so there is nothing to download. Upload again and choose “Smaller file”." });
        return reply.code(409).send({ error: "output_not_ready", message: "Your video isn't ready yet. Please wait a moment and try again." });
      }
      if (output.output_deleted_at || (output.output_retain_until && new Date(output.output_retain_until).getTime() <= Date.now())) {
        await client.query("rollback"); return reply.code(410).send({ error: "output_expired", message: "This video has expired. Please upload it again." });
      }
      const existing = await client.query(`select user_id from download_grants where job_id=$1`, [id]);
      if (existing.rows.length && existing.rows[0].user_id !== request.userId) {
        await client.query("rollback"); return reply.code(403).send({ error: "already_claimed" });
      }
      if (!existing.rows.length) {
        const plan = (await client.query(`select p.* from workspace_entitlements e join plans p on p.id=e.plan_id where e.workspace_id=$1`, [workspaceId])).rows[0];
        if (!plan || Number(job.size_bytes) > Number(plan.max_upload_bytes)) {
          await client.query("rollback"); return reply.code(403).send({ error: "plan_size_limit", message: "This file exceeds your plan's file size limit." });
        }
        // Free daily allowance first; once it is used, a paid plan's video quota is charged (earliest-expiring first).
        const used = await client.query(`select count(*)::int n from download_grants where user_id=$1 and entitlement_id is null and granted_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')`, [request.userId]);
        let entitlementId: string | null = null;
        if (used.rows[0].n >= plan.max_downloads_per_day) {
          const paid = (await client.query(`select e.id from paid_entitlements e join payment_intents p on p.id=e.payment_intent_id where e.user_id=$1 and e.revoked_at is null and e.downloads_total is not null and e.starts_at<=now() and e.expires_at>now() and p.status='completed' and (select count(*) from download_grants g where g.entitlement_id=e.id) < e.downloads_total order by e.expires_at asc limit 1`, [request.userId])).rows[0];
          if (!paid) {
            const resetAt = new Date(); resetAt.setUTCHours(24, 0, 0, 0);
            await client.query("rollback");
            return reply.code(429).send({ error: "daily_download_limit", limit: plan.max_downloads_per_day, resetAt: resetAt.toISOString(), checkoutAvailable: checkoutEnabled(), message: "You've used today's free video. Pick a plan to keep going, or come back after the reset." });
          }
          entitlementId = paid.id;
        }
        await client.query(`insert into download_grants(job_id,user_id,entitlement_id) values ($1,$2,$3)`, [id, request.userId, entitlementId]);
      }
      if (owner.is_guest && !owner.created_by) {
        // Claim the complete workspace once; the old guest capability no longer resolves.
        // These owner references also preserve existing account-deletion cascades.
        await client.query(`update workspaces set created_by=$2 where id=$1`, [job.workspace_id, request.userId]);
        await client.query(`insert into workspace_members(workspace_id,user_id,role) values ($1,$2,'owner') on conflict do nothing`, [job.workspace_id, request.userId]);
        for (const table of ["upload_sessions", "media_assets", "jobs"]) {
          await client.query(`update ${table} set created_by=$2 where workspace_id=$1`, [job.workspace_id,request.userId]);
        }
      }
      // Signing before commit means a signing failure never consumes the daily allowance.
      //
      // Expiry must comfortably outlast the actual download, not just the time-to-click. Storage
      // supports HTTP Range requests (`accept-ranges: bytes`), and browsers/OS download managers
      // commonly split a large file into multiple range-request chunks — especially over a slow or
      // unstable connection. A short expiry here does not fail loudly: once the token expires
      // mid-download, later range requests are silently rejected and the browser finalizes
      // whatever partial bytes it already has as if the download were complete, with no error
      // shown to the user. Real case: a 3840x2160 HEVC output (58.6 MB) truncated to 9.6 MB when a
      // user's connection took longer than the previous 300s window — the resulting file was
      // rejected by VLC and WhatsApp, but nothing on the download UI indicated a failure. 7200s (2
      // hours) gives even a very slow connection enough headroom to complete a 100 MB guest-tier
      // file; this is still a single-use, per-job, auth-gated grant, not a public/indefinite link.
      const DOWNLOAD_URL_EXPIRY_SECONDS = 7200;
      const signed = new URL(await createSignedDownloadUrl(output.output_object_key, DOWNLOAD_URL_EXPIRY_SECONDS));
      // hasheemstudio_YYYYMMDD_HHmmss.mp4 — the client sends the completion time in the user's local time zone;
      // anything not matching that exact shape is replaced by a UTC name from the same completion time.
      const requestedName = (request.body as { fileName?: unknown } | undefined | null)?.fileName;
      signed.searchParams.set("download", safeOutputFileName(requestedName, job.completed_at));
      const downloadUrl = signed.toString();
      await client.query("commit");
      return { downloadUrl, expiresIn: DOWNLOAD_URL_EXPIRY_SECONDS, guestClaimed: request.guestWorkspaceId === job.workspace_id };
    } catch (error) {
      await client.query("rollback"); throw error;
    } finally { client.release(); }
  });
}
