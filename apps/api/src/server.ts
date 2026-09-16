import Fastify from "fastify";
import { uploadsRoutes } from "./routes/uploads.js";
import { jobsRoutes } from "./routes/jobs.js";

export function buildServer() {
  const app = Fastify({ logger: true });

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

  app.register(uploadsRoutes);
  app.register(jobsRoutes);

  return app;
}
