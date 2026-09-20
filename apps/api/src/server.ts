import Fastify from "fastify";
import cors from "@fastify/cors";
import { uploadsRoutes } from "./routes/uploads.js";
import { jobsRoutes } from "./routes/jobs.js";
import { guestsRoutes } from "./routes/guests.js";
import { downloadsRoutes } from "./routes/downloads.js";

export function buildServer() {
  const app = Fastify({ logger: { redact: ["req.headers.authorization", "req.headers.x-guest-token"] }, trustProxy: process.env.API_TRUST_PROXY?.split(",").filter(Boolean) ?? false });

  // Explicit allowlist, not a wildcard — per docs/SECURITY.md "explicit CORS origins."
  // apps/web's dev server origin only, for this vertical-slice proof; production origins are
  // added once hasheemstudio.com DNS exists (docs/DECISIONS.md item 1).
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? "http://127.0.0.1:5173,http://localhost:5173").split(",");
  app.register(cors, {
    origin: allowedOrigins,
    credentials: false,
  });

  app.get("/health/live", async () => ({ status: "ok" }));

  app.get("/health/ready", async (_request, reply) => {
    try {
      const { getPool } = await import("./db.js");
      await getPool().query("select 1");
      return { status: "ok" };
    } catch {
      reply.code(503);
      return { status: "unavailable" };
    }
  });

  app.addHook("onSend", async (_request, reply, payload) => { reply.header("Cache-Control", "no-store"); return payload; });
  app.register(guestsRoutes);
  app.register(downloadsRoutes);
  app.register(uploadsRoutes);
  app.register(jobsRoutes);

  return app;
}
