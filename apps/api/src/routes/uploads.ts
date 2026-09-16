import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { requireAuth } from "../auth.js";
import { resolvePersonalWorkspaceId } from "../workspace.js";
import { createSignedUploadUrl, objectInfo } from "../storage.js";

// Verified Free plan limits per docs/PRD.md §6 — hardcoded for this vertical slice.
// A real plans/entitlements lookup (per docs/ARCHITECTURE.md "Data model and RLS") is Phase 5/9.
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

export async function uploadsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/uploads/sessions", { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as any).userId as string;
    const body = request.body as { filename?: string; declaredSizeBytes?: number; declaredMimeType?: string };

    if (!body.filename || !body.declaredSizeBytes || body.declaredSizeBytes <= 0) {
      return reply.code(400).send({ error: "invalid_request", message: "filename and declaredSizeBytes are required" });
    }
    if (body.declaredSizeBytes > MAX_UPLOAD_BYTES) {
      return reply.code(413).send({ error: "file_too_large", limitBytes: MAX_UPLOAD_BYTES });
    }

    const pool = getPool();
    const workspaceId = await resolvePersonalWorkspaceId(pool, userId);

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

    const sessionRes = await pool.query(
      `select id, workspace_id, object_key, state, expires_at, declared_size_bytes
       from upload_sessions where id = $1`,
      [id],
    );
    if (sessionRes.rows.length === 0) return reply.code(404).send({ error: "not_found" });
    const session = sessionRes.rows[0];

    const memberRes = await pool.query(
      `select 1 from workspace_members where workspace_id = $1 and user_id = $2`,
      [session.workspace_id, userId],
    );
    if (memberRes.rows.length === 0) return reply.code(403).send({ error: "forbidden" });

    if (session.state !== "pending") return reply.code(409).send({ error: "session_not_pending", state: session.state });
    if (new Date(session.expires_at).getTime() < Date.now()) {
      await pool.query(`update upload_sessions set state = 'expired' where id = $1`, [id]);
      return reply.code(410).send({ error: "session_expired" });
    }

    const info = await objectInfo(session.object_key);
    if (!info.exists || !info.sizeBytes) {
      return reply.code(422).send({ error: "object_not_found", message: "Upload was not completed to storage" });
    }
    if (info.sizeBytes > session.declared_size_bytes * 2) {
      return reply.code(422).send({ error: "size_mismatch", declared: session.declared_size_bytes, actual: info.sizeBytes });
    }

    const mediaAssetId = randomUUID();
    const retainUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await pool.query("begin");
    try {
      await pool.query(
        `insert into media_assets (id, workspace_id, upload_session_id, created_by, object_key, size_bytes, retain_until)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [mediaAssetId, session.workspace_id, session.id, userId, session.object_key, info.sizeBytes, retainUntil],
      );
      await pool.query(`update upload_sessions set state = 'completed' where id = $1`, [id]);
      await pool.query("commit");
    } catch (err) {
      await pool.query("rollback");
      throw err;
    }

    return { mediaAssetId };
  });
}
