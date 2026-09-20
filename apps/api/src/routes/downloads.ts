import type { FastifyInstance } from "fastify";
import { requireActor, canAccessJob } from "../actor.js";
import { getPool } from "../db.js";
import { resolvePersonalWorkspaceId } from "../workspace.js";
import { createSignedDownloadUrl } from "../storage.js";

export async function downloadsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/jobs/:id/download", { preHandler: requireActor }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!request.userId) return reply.code(401).send({ error: "login_required", message: "Sign in to download your video. Your processed file will be kept here." });
    const { id } = request.params as { id: string };
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: "invalid_job_id" });
    const pool = getPool();
    const result = await pool.query(`select j.*, ma.size_bytes from jobs j join media_assets ma on ma.id=j.media_asset_id where j.id=$1`, [id]);
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
        await client.query("rollback"); return reply.code(409).send({ error: "output_not_ready" });
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
        const used = await client.query(`select count(*)::int n from download_grants where user_id=$1 and granted_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')`, [request.userId]);
        if (used.rows[0].n >= plan.max_downloads_per_day) {
          const resetAt = new Date(); resetAt.setUTCHours(24, 0, 0, 0);
          await client.query("rollback");
          return reply.code(429).send({ error: "daily_download_limit", limit: plan.max_downloads_per_day, resetAt: resetAt.toISOString(), checkoutAvailable: false, message: "Your daily video allowance is used. Return after the reset to download this video. Paid upgrades are not available yet." });
        }
        await client.query(`insert into download_grants(job_id,user_id) values ($1,$2)`, [id, request.userId]);
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
      const signed = new URL(await createSignedDownloadUrl(output.output_object_key, 300));
      signed.searchParams.set("download", "hasheem-video.mp4");
      const downloadUrl = signed.toString();
      await client.query("commit");
      return { downloadUrl, expiresIn: 300, guestClaimed: request.guestWorkspaceId === job.workspace_id };
    } catch (error) {
      await client.query("rollback"); throw error;
    } finally { client.release(); }
  });
}
