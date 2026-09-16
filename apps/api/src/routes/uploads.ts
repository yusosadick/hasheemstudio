import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { requireAuth } from "../auth.js";
import { resolvePersonalWorkspaceId } from "../workspace.js";
import { createSignedUploadUrl, objectInfo } from "../storage.js";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

async function getPlanForWorkspace(pool: ReturnType<typeof getPool>, workspaceId: string) {
  const res = await pool.query<{ max_upload_bytes: string }>(
    `select p.max_upload_bytes from workspace_entitlements we join plans p on p.id = we.plan_id where we.workspace_id = $1`,
    [workspaceId],
  );
  return res.rows[0] ?? null;
}

export async function uploadsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/uploads/sessions", { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const body = request.body as { filename?: string; declaredSizeBytes?: number; declaredMimeType?: string };

    if (!body.filename || !body.declaredSizeBytes || body.declaredSizeBytes <= 0) {
      return reply.code(400).send({ error: "invalid_request", message: "filename and declaredSizeBytes are required" });
    }

    const pool = getPool();
    const workspaceId = await resolvePersonalWorkspaceId(pool, userId);

    const plan = await getPlanForWorkspace(pool, workspaceId);
    if (!plan) return reply.code(500).send({ error: "no_entitlement" });
    const maxUploadBytes = Number(plan.max_upload_bytes);

    // Advisory only — the client's declared size is not trusted. The authoritative check is
    // against the real object size in storage at finalize time below.
    if (body.declaredSizeBytes > maxUploadBytes) {
      return reply.code(413).send({ error: "file_too_large", limitBytes: maxUploadBytes });
    }

    const sessionId = randomUUID();
    const objectKey = `${workspaceId}/uploads/${sessionId}-${sanitizeFilename(body.filename)}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await pool.query(
      `insert into upload_sessions (id, workspace_id, created_by, object_key, declared_filename, declared_size_bytes, declared_mime_type, expires_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sessionId, workspaceId, userId, objectKey, body.filename, body.declaredSizeBytes, body.declaredMimeType ?? null, expiresAt],
    );

    const { url, token } = await createSignedUploadUrl(objectKey);
    return { sessionId, objectKey, uploadUrl: url, uploadToken: token, expiresAt };
  });

  app.post("/v1/uploads/sessions/:id/finalize", { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const { id } = request.params as { id: string };
    const pool = getPool();

    const preCheckRes = await pool.query(`select workspace_id from upload_sessions where id = $1`, [id]);
    if (preCheckRes.rows.length === 0) return reply.code(404).send({ error: "not_found" });
    const memberRes = await pool.query(
      `select 1 from workspace_members where workspace_id = $1 and user_id = $2`,
      [preCheckRes.rows[0].workspace_id, userId],
    );
    if (memberRes.rows.length === 0) return reply.code(403).send({ error: "forbidden" });

    // Lock the session row for the whole finalize so two concurrent finalize calls for the same
    // session (e.g. a double-submitted request) can't both pass the state check and both insert a
    // media_assets row — the second one serializes behind the first and then correctly sees
    // state != 'pending'.
    const client = await pool.connect();
    let mediaAssetId: string;
    try {
      await client.query("begin");
      const sessionRes = await client.query(
        `select id, workspace_id, object_key, state, expires_at, declared_size_bytes
         from upload_sessions where id = $1 for update`,
        [id],
      );
      const session = sessionRes.rows[0];

      if (session.state !== "pending") {
        await client.query("rollback");
        return reply.code(409).send({ error: "session_not_pending", state: session.state });
      }
      if (new Date(session.expires_at).getTime() < Date.now()) {
        await client.query(`update upload_sessions set state = 'expired' where id = $1`, [id]);
        await client.query("commit");
        return reply.code(410).send({ error: "session_expired" });
      }

      const info = await objectInfo(session.object_key);
      if (!info.exists || !info.sizeBytes) {
        await client.query("rollback");
        return reply.code(422).send({ error: "object_not_found", message: "Upload was not completed to storage" });
      }

      // Authoritative size check: a client could declare a small size to pass the pre-check in
      // POST /sessions, then PUT a much larger file directly to storage (which doesn't know about
      // plan limits). This is the real enforcement point, against the actual stored object size.
      const plan = await getPlanForWorkspace(pool, session.workspace_id);
      if (!plan) {
        await client.query("rollback");
        return reply.code(500).send({ error: "no_entitlement" });
      }
      const maxUploadBytes = Number(plan.max_upload_bytes);
      if (info.sizeBytes > maxUploadBytes) {
        await client.query(`update upload_sessions set state = 'aborted' where id = $1`, [id]);
        await client.query("commit");
        return reply.code(413).send({ error: "file_too_large", limitBytes: maxUploadBytes, actualBytes: info.sizeBytes });
      }
      if (info.sizeBytes > session.declared_size_bytes * 2) {
        await client.query("rollback");
        return reply.code(422).send({ error: "size_mismatch", declared: session.declared_size_bytes, actual: info.sizeBytes });
      }

      mediaAssetId = randomUUID();
      const retainUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await client.query(
        `insert into media_assets (id, workspace_id, upload_session_id, created_by, object_key, size_bytes, retain_until)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [mediaAssetId, session.workspace_id, session.id, userId, session.object_key, info.sizeBytes, retainUntil],
      );
      await client.query(`update upload_sessions set state = 'completed' where id = $1`, [id]);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    return { mediaAssetId };
  });
}
