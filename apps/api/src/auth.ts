import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken, TokenError } from "./jwt.js";
import { requireEnv } from "./env.js";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "missing_authorization" });
    return reply;
  }
  try {
    const payload = verifyAccessToken(header.slice(7), requireEnv("JWT_SECRET"));
    (request as FastifyRequest & { userId: string }).userId = payload.sub;
  } catch (err) {
    if (err instanceof TokenError) {
      reply.code(401).send({ error: "invalid_token", message: err.message });
      return reply;
    }
    throw err;
  }
}
