import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { requireAuth } from "../auth.js";
import { createSignedDownloadUrl } from "../storage.js";

// Verified Free plan limits per docs/PRD.md §6 — hardcoded for this vertical slice; a real
// plans/entitlements + usage ledger lookup is Phase 5/9 (see docs/STATUS.md for the honest gap).
const MAX_JOBS_PER_DAY = 3;
const MAX_ACTIVE_JOBS = 1;
const SUPPORTED_RECIPES = new Set(["inspect", "remux"]);

export async function jobsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/jobs", { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const body = request.body as { mediaAssetId?: string; recipe?: string };
    if (!body.mediaAssetId || !body.recipe) {
      return reply.code(400).send({ error: "invalid_request" });
    }
    if (!SUPPORTED_RECIPES.has(body.recipe)) {
      return reply.code(400).send({ error: "unsupported_recipe", message: "compat_encode lands in a later phase; use inspect or remux" });
    }

    const pool = getPool();
    const assetRes = await pool.query(
      `select id, workspace_id from media_assets where id = $1`,
      [body.mediaAssetId],
    );
    if (assetRes.rows.length === 0) return reply.code(404).send({ error: "not_found" });
    const workspaceId = assetRes.rows[0].workspace_id;

    const memberRes = await pool.query(
      `select 1 from workspace_members where workspace_id = $1 and user_id = $2`,
      [workspaceId, userId],
    );
    if (memberRes.rows.length === 0) return reply.code(403).send({ error: "forbidden" });

    const todayCountRes = await pool.query(
      `select count(*)::int as n from jobs where workspace_id = $1 and created_at >= date_trunc('day', now())`,
      [workspaceId],
    );
    if (todayCountRes.rows[0].n >= MAX_JOBS_PER_DAY) {
      return reply.code(429).send({ error: "daily_quota_exceeded", limit: MAX_JOBS_PER_DAY });
    }

    const activeCountRes = await pool.query(
      `select count(*)::int as n from jobs where workspace_id = $1 and status in ('queued','processing','verifying')`,
      [workspaceId],
    );
    if (activeCountRes.rows[0].n >= MAX_ACTIVE_JOBS) {
      return reply.code(429).send({ error: "concurrent_job_limit", limit: MAX_ACTIVE_JOBS });
    }

    const jobId = randomUUID();
    await pool.query("begin");
    try {
      await pool.query(
        `insert into jobs (id, workspace_id, media_asset_id, created_by, recipe, status)
         values ($1, $2, $3, $4, $5, 'queued')`,
        [jobId, workspaceId, body.mediaAssetId, userId, body.recipe],
      );
      await pool.query(
        `insert into outbox_events (aggregate_type, aggregate_id, event_type, payload)
         values ('job', $1, 'job.queued', '{}'::jsonb)`,
        [jobId],
      );
      await pool.query("commit");
    } catch (err) {
      await pool.query("rollback");
      throw err;
    }

    return reply.code(201).send({ jobId, status: "queued" });
  });

  app.get("/v1/jobs/:id", { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const { id } = request.params as { id: string };
    const pool = getPool();

    const jobRes = await pool.query(
      `select j.*, ma.object_key as input_object_key from jobs j
       join media_assets ma on ma.id = j.media_asset_id
       where j.id = $1`,
      [id],
    );
    if (jobRes.rows.length === 0) return reply.code(404).send({ error: "not_found" });
    const job = jobRes.rows[0];

    const memberRes = await pool.query(
      `select 1 from workspace_members where workspace_id = $1 and user_id = $2`,
      [job.workspace_id, userId],
    );
    if (memberRes.rows.length === 0) return reply.code(403).send({ error: "forbidden" });

    const reportRes = await pool.query(
      `select * from verification_reports where job_id = $1 order by created_at desc limit 1`,
      [id],
    );

    let downloadUrl: string | null = null;
    if (job.status === "succeeded" && job.output_object_key) {
      downloadUrl = await createSignedDownloadUrl(job.output_object_key, 900);
    }

    return {
      id: job.id,
      status: job.status,
      recipe: job.recipe,
      attemptCount: job.attempt_count,
      errorMessage: job.error_message,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      verificationReport: reportRes.rows[0] ?? null,
      downloadUrl,
    };
  });

  app.delete("/v1/jobs/:id", { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const { id } = request.params as { id: string };
    const pool = getPool();

    const jobRes = await pool.query(`select workspace_id, status from jobs where id = $1`, [id]);
    if (jobRes.rows.length === 0) return reply.code(404).send({ error: "not_found" });
    const job = jobRes.rows[0];

    const memberRes = await pool.query(
      `select 1 from workspace_members where workspace_id = $1 and user_id = $2`,
      [job.workspace_id, userId],
    );
    if (memberRes.rows.length === 0) return reply.code(403).send({ error: "forbidden" });

    const terminal = ["succeeded", "failed", "cancelled", "expired"];
    if (terminal.includes(job.status)) {
      return reply.code(409).send({ error: "already_terminal", status: job.status });
    }

    await pool.query(
      `update jobs set status = 'cancelled', state_version = state_version + 1 where id = $1`,
      [id],
    );
    await pool.query(
      `insert into job_events (job_id, event_type, payload) values ($1, 'job.cancelled', '{}'::jsonb)`,
      [id],
    );

    return { id, status: "cancelled" };
  });
}
