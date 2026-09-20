import type { FastifyRequest, FastifyReply } from "fastify";
import { createHash } from "node:crypto";
import { requireAuth } from "./auth.js";
import { getPool } from "./db.js";

declare module "fastify" {
  interface FastifyRequest { userId?: string; guestWorkspaceId?: string; }
}
export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export async function resolveGuest(request: FastifyRequest): Promise<string | undefined> {
  const token = request.headers["x-guest-token"];
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return;
  const res = await getPool().query(
    `select g.workspace_id from guest_sessions g join workspaces w on w.id=g.workspace_id where g.token_hash = $1 and g.expires_at > now() and w.created_by is null`, [tokenHash(token)],
  );
  return res.rows[0]?.workspace_id;
}
export async function requireActor(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.headers.authorization) {
    await requireAuth(request, reply);
    if (reply.sent) return;
  }
  request.guestWorkspaceId = await resolveGuest(request);
  if (!request.userId && !request.guestWorkspaceId) {
    reply.code(401).send({ error: "session_required", message: "Your guest session expired. Please choose your video again." });
  }
}
export async function canAccessWorkspace(request: FastifyRequest, workspaceId: string): Promise<boolean> {
  if (request.guestWorkspaceId === workspaceId) return true;
  if (!request.userId) return false;
  const res = await getPool().query(`select 1 from workspace_members where workspace_id = $1 and user_id = $2`, [workspaceId, request.userId]);
  return res.rows.length > 0;
}
export async function canAccessJob(request: FastifyRequest, job: { id: string; workspace_id: string }): Promise<boolean> {
  // Once claimed, a guest output belongs exclusively to the account that unlocked it.
  const grant = await getPool().query(`select user_id from download_grants where job_id = $1`, [job.id]);
  if (grant.rows.length) return grant.rows[0].user_id === request.userId;
  return canAccessWorkspace(request, job.workspace_id);
}
