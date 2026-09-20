import type { FastifyInstance } from "fastify";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { getPool } from "../db.js";
import { requireEnv } from "../env.js";
import { resolveGuest, tokenHash } from "../actor.js";

export async function guestsRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/guest-sessions", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (process.env.ENABLE_GUEST_PROCESSING === "false") {
      return reply.code(503).send({ error: "guest_processing_unavailable", message: "Guest processing is temporarily unavailable. Please sign in." });
    }
    const existing = await resolveGuest(request);
    if (existing) return { token: request.headers["x-guest-token"] };
    // Never trust arbitrary forwarded headers. Configure API_TRUST_PROXY only for the actual proxy.
    const networkHash = createHmac("sha256", requireEnv("JWT_SECRET")).update(request.ip).digest("hex");
    const client = await getPool().connect();
    try {
      await client.query("begin");
      await client.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [`guest:${networkHash}`]);
      const count = await client.query(`select count(*)::int n from guest_sessions where network_hash = $1 and created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')`, [networkHash]);
      if (count.rows[0].n >= 3) {
        await client.query("rollback");
        return reply.code(429).send({ error: "guest_limit", message: "Today's guest allowance for this network is used. Sign in to continue." });
      }
      const workspaceId = randomUUID();
      const token = randomBytes(32).toString("hex");
      await client.query(`insert into workspaces(id, name, is_personal) values ($1, 'Guest workspace', false)`, [workspaceId]);
      await client.query(`insert into workspace_entitlements(workspace_id, plan_id) values ($1, 'verified_free')`, [workspaceId]);
      await client.query(`insert into guest_sessions(workspace_id, token_hash, network_hash) values ($1, $2, $3)`, [workspaceId, tokenHash(token), networkHash]);
      await client.query("commit");
      return reply.code(201).send({ token });
    } catch (error) {
      await client.query("rollback"); throw error;
    } finally { client.release(); }
  });
}
