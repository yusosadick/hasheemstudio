import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { getPool } from "../db.js";
import { requireActor, canAccessWorkspace } from "../actor.js";
import { resolvePersonalWorkspaceId } from "../workspace.js";
import { createResumableUpload, objectInfo, proxyTus } from "../storage.js";

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
  app.addContentTypeParser("application/offset+octet-stream", { parseAs: "buffer", bodyLimit: 262144 }, (_request, body, done) => done(null, body));
  app.route({
    method: ["HEAD", "PATCH"], url: "/v1/uploads/sessions/:id/data", preHandler: requireActor, bodyLimit: 262144,
    handler: async (request, reply) => {
      const { id } = request.params as {id: string};
      if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({error:"invalid_session_id"});
      const result = await getPool().query(`select * from upload_sessions where id=$1`, [id]);
      const session = result.rows[0];
      if (!session) return reply.code(404).send({error:"not_found"});
      if (!await canAccessWorkspace(request, session.workspace_id)) return reply.code(403).send({error:"forbidden"});
      if (session.state !== "pending" || new Date(session.expires_at).getTime() <= Date.now()) return reply.code(410).send({error:"session_expired"});
      const offset = request.headers["upload-offset"];
      if (request.method === "PATCH" && (typeof offset !== "string" || !/^\d+$/.test(offset) || !Buffer.isBuffer(request.body) || Number(offset) + request.body.length > Number(session.declared_size_bytes))) return reply.code(400).send({error:"invalid_upload_chunk"});
      const response = await proxyTus(session.tus_upload_path, request.method as "HEAD" | "PATCH", offset as string, request.body as Buffer);
      for (const name of ["upload-offset", "upload-length", "tus-resumable"]) {
        const value = response.headers.get(name); if (value) reply.header(name, value);
      }
      reply.header("Access-Control-Expose-Headers", "Upload-Offset, Upload-Length, Tus-Resumable");
      return reply.code(response.status).send(request.method === "HEAD" || response.ok ? undefined : {error:"upload_chunk_failed"});
    },
  });

  app.post("/v1/uploads/sessions", { preHandler: requireActor }, async (request, reply) => {
    const userId = request.userId ?? null;
    const body = request.body as { filename?: string; declaredSizeBytes?: number; declaredMimeType?: string };

    if (!body?.filename || typeof body.filename !== "string" || !Number.isSafeInteger(body.declaredSizeBytes) || body.declaredSizeBytes! <= 0) {
      return reply.code(400).send({ error: "invalid_request", message: "filename and declaredSizeBytes are required" });
    }

    const pool = getPool();
    const workspaceId = userId ? await resolvePersonalWorkspaceId(pool, userId) : request.guestWorkspaceId!;

    const plan = await getPlanForWorkspace(pool, workspaceId);
    if (!plan) return reply.code(500).send({ error: "no_entitlement" });
    const maxUploadBytes = Number(plan.max_upload_bytes);

    // Advisory only — the client's declared size is not trusted. The authoritative check is
    // against the real object size in storage at finalize time below.
    if (body.declaredSizeBytes! > maxUploadBytes) {
      return reply.code(413).send({ error: "file_too_large", limitBytes: maxUploadBytes });
    }

    const admission = await pool.connect();
    try {
      await admission.query("begin");
      await admission.query(`select id from workspaces where id=$1 for update`, [workspaceId]);
      if (!userId) {
        const count = await admission.query(`select count(*)::int n from upload_sessions where workspace_id=$1`, [workspaceId]);
        if (count.rows[0].n >= 3) { await admission.query("rollback"); return reply.code(429).send({error:"guest_upload_limit", message:"Your guest upload allowance is used. Please sign in."}); }
      }
    const sessionId = randomUUID();
    const objectKey = `${workspaceId}/uploads/${sessionId}-${sanitizeFilename(body.filename)}`;
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const tusUploadPath = await createResumableUpload(
      objectKey,
      body.declaredSizeBytes!,
      body.declaredMimeType ?? "application/octet-stream",
    );

    await admission.query(
      `insert into upload_sessions (id, workspace_id, created_by, object_key, declared_filename, declared_size_bytes, declared_mime_type, expires_at, tus_upload_path)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [sessionId, workspaceId, userId, objectKey, body.filename, body.declaredSizeBytes, body.declaredMimeType ?? null, expiresAt, tusUploadPath],
    );

    await admission.query("commit");
    return { sessionId, objectKey, tusUploadPath: userId ? tusUploadPath : `/v1/uploads/sessions/${sessionId}/data`, expiresAt };
    } catch(error) { await admission.query("rollback"); throw error; }
    finally { admission.release(); }
  });

  // Lets the client resume against an existing session after a reload — it may have lost the
  // in-memory tusUploadPath from the original POST response. Ownership-checked like every other
  // route here; never trusts the session id alone.
  app.get("/v1/uploads/sessions/:id", { preHandler: requireActor }, async (request, reply) => {
    const userId = request.userId ?? null;
    const { id } = request.params as { id: string };
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: "invalid_session_id" });
    const pool = getPool();

    const sessionRes = await pool.query(
      `select workspace_id, created_by, state, expires_at, tus_upload_path, declared_size_bytes, declared_filename
       from upload_sessions where id = $1`,
      [id],
    );
    if (sessionRes.rows.length === 0) return reply.code(404).send({ error: "not_found" });
    const session = sessionRes.rows[0];

    if (!await canAccessWorkspace(request, session.workspace_id)) return reply.code(403).send({ error: "forbidden" });

    return {
      sessionId: id,
      state: session.state,
      expiresAt: session.expires_at,
      tusUploadPath: session.created_by ? session.tus_upload_path : `/v1/uploads/sessions/${id}/data`,
      declaredSizeBytes: session.declared_size_bytes,
      declaredFilename: session.declared_filename,
    };
  });

  app.post("/v1/uploads/sessions/:id/finalize", { preHandler: requireActor }, async (request, reply) => {
    const userId = request.userId ?? null;
    const { id } = request.params as { id: string };
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reply.code(400).send({ error: "invalid_session_id" });
    const pool = getPool();

    const preCheckRes = await pool.query(`select workspace_id from upload_sessions where id = $1`, [id]);
    if (preCheckRes.rows.length === 0) return reply.code(404).send({ error: "not_found" });
    if (!await canAccessWorkspace(request, preCheckRes.rows[0].workspace_id)) return reply.code(403).send({ error: "forbidden" });

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

      if (session.state === "completed") {
        const asset = await client.query(`select id from media_assets where upload_session_id=$1`, [id]);
        await client.query("rollback");
        return { mediaAssetId: asset.rows[0].id };
      }
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
      const retainUntil = new Date(Date.now() + (userId ? 7 : 1) * 24 * 60 * 60 * 1000).toISOString();
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
