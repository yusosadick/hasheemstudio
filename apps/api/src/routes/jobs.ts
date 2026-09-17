import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { requireAuth } from "../auth.js";
import { createSignedDownloadUrl } from "../storage.js";

interface Plan {
  id: string;
  max_upload_bytes: string;
  max_duration_seconds: number;
  max_jobs_per_day: number;
  max_active_jobs: number;
  allowed_recipes: string[];
}

async function getWorkspacePlan(pool: ReturnType<typeof getPool>, workspaceId: string): Promise<Plan | null> {
  const res = await pool.query<Plan>(
    `select p.* from workspace_entitlements we join plans p on p.id = we.plan_id where we.workspace_id = $1`,
    [workspaceId],
  );
  return res.rows[0] ?? null;
}

export async function jobsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/jobs", { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const body = request.body as { mediaAssetId?: string; recipe?: string };
    if (!body.mediaAssetId || !body.recipe) {
      return reply.code(400).send({ error: "invalid_request" });
    }

    const pool = getPool();
    const assetRes = await pool.query(
      `select id, workspace_id, duration_seconds from media_assets where id = $1`,
      [body.mediaAssetId],
    );
    if (assetRes.rows.length === 0) return reply.code(404).send({ error: "not_found" });
    const asset = assetRes.rows[0];
    const workspaceId = asset.workspace_id;

    const memberRes = await pool.query(
      `select 1 from workspace_members where workspace_id = $1 and user_id = $2`,
      [workspaceId, userId],
    );
    if (memberRes.rows.length === 0) return reply.code(403).send({ error: "forbidden" });

    const plan = await getWorkspacePlan(pool, workspaceId);
    if (!plan) return reply.code(500).send({ error: "no_entitlement", message: "Workspace has no assigned plan" });

    if (!plan.allowed_recipes.includes(body.recipe)) {
      return reply.code(403).send({ error: "recipe_not_allowed", plan: plan.id, allowed: plan.allowed_recipes });
    }
    // Duration is only known after upload (probing happens in the worker), but if we already have
    // it (a prior job already probed this asset), reject obviously-over-limit requests early
    // rather than wasting a worker slot on a foregone conclusion. The worker still enforces this
    // authoritatively after a fresh probe (see apps/worker/src/processor.ts).
    if (asset.duration_seconds && Number(asset.duration_seconds) > plan.max_duration_seconds) {
      return reply.code(422).send({
        error: "duration_exceeds_plan",
        limitSeconds: plan.max_duration_seconds,
        actualSeconds: asset.duration_seconds,
      });
    }

    // Atomicity: lock the workspace row for the duration of this transaction. Concurrent job
    // creation requests for the SAME workspace serialize on this lock, so the count-then-insert
    // below can never over-admit under a race (docs/STATUS.md flagged this as a real gap in the
    // Phase 4 hardcoded-constant version — this replaces it with a genuinely atomic check).
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(`select id from workspaces where id = $1 for update`, [workspaceId]);

      const dailyRes = await client.query(
        `select count(*)::int as n from usage_reservations
         where workspace_id = $1 and status != 'released' and created_at >= date_trunc('day', now())`,
        [workspaceId],
      );
      if (dailyRes.rows[0].n >= plan.max_jobs_per_day) {
        await client.query("rollback");
        return reply.code(429).send({ error: "daily_quota_exceeded", limit: plan.max_jobs_per_day });
      }

      const activeRes = await client.query(
        `select count(*)::int as n from jobs where workspace_id = $1 and status in ('queued','processing','verifying')`,
        [workspaceId],
      );
      if (activeRes.rows[0].n >= plan.max_active_jobs) {
        await client.query("rollback");
        return reply.code(429).send({ error: "concurrent_job_limit", limit: plan.max_active_jobs });
      }

      const jobId = randomUUID();
      await client.query(
        `insert into jobs (id, workspace_id, media_asset_id, created_by, recipe, status)
         values ($1, $2, $3, $4, $5, 'queued')`,
        [jobId, workspaceId, body.mediaAssetId, userId, body.recipe],
      );
      await client.query(
        `insert into usage_reservations (workspace_id, job_id, kind, status) values ($1, $2, 'job_slot', 'reserved')`,
        [workspaceId, jobId],
      );
      await client.query(
        `insert into outbox_events (aggregate_type, aggregate_id, event_type, payload)
         values ('job', $1, 'job.queued', '{}'::jsonb)`,
        [jobId],
      );
      await client.query("commit");
      return reply.code(201).send({ jobId, status: "queued" });
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
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

    // Never offer a download link for an output the retention sweeper has already deleted
    // (scripts/ops/retention-sweep.mjs sets output_deleted_at) — the object genuinely no longer
    // exists in storage, so a signed URL for it would be a broken link, not an honest state.
    let downloadUrl: string | null = null;
    let outputExpired = false;
    if (job.status === "succeeded" && job.output_object_key) {
      if (job.output_deleted_at) {
        outputExpired = true;
      } else {
        downloadUrl = await createSignedDownloadUrl(job.output_object_key, 900);
      }
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
      outputExpired,
      outputRetainUntil: job.output_retain_until,
    };
  });

  app.delete("/v1/jobs/:id", { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const { id } = request.params as { id: string };
    const pool = getPool();

    const preCheckRes = await pool.query(`select workspace_id from jobs where id = $1`, [id]);
    if (preCheckRes.rows.length === 0) return reply.code(404).send({ error: "not_found" });
    const memberRes = await pool.query(
      `select 1 from workspace_members where workspace_id = $1 and user_id = $2`,
      [preCheckRes.rows[0].workspace_id, userId],
    );
    if (memberRes.rows.length === 0) return reply.code(403).send({ error: "forbidden" });

    // Lock the job row for the whole cancel so a concurrent cancel and worker claim (or two
    // concurrent cancel calls) can't race: whichever gets the lock first decides the outcome, and
    // the other serializes behind it and then correctly sees a terminal/changed status.
    const terminal = ["succeeded", "failed", "cancelled", "expired"];
    const client = await pool.connect();
    let shouldRefund = false;
    try {
      await client.query("begin");
      const jobRes = await client.query(`select status from jobs where id = $1 for update`, [id]);
      const status = jobRes.rows[0].status;

      if (terminal.includes(status)) {
        await client.query("rollback");
        return reply.code(409).send({ error: "already_terminal", status });
      }

      // Cancelling before/while queued refunds the daily-quota reservation; a job already being
      // processed still counts as a real attempt (docs/PRD.md "Meter ... job attempts") — the
      // reservation for that case gets settled (not released) by the worker instead.
      shouldRefund = status === "queued";

      await client.query(
        `update jobs set status = 'cancelled', state_version = state_version + 1 where id = $1`,
        [id],
      );
      await client.query(
        `update usage_reservations set status = $2, resolved_at = now() where job_id = $1`,
        [id, shouldRefund ? "released" : "settled"],
      );
      await client.query(
        `insert into job_events (job_id, event_type, payload) values ($1, 'job.cancelled', jsonb_build_object('refunded', $2::boolean))`,
        [id, shouldRefund],
      );
      await client.query("commit");
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    return { id, status: "cancelled", refunded: shouldRefund };
  });
}
