import { loadEnv } from "./env.js";
loadEnv();

import { buildServer } from "./server.js";
import { ensureBucket } from "./storage.js";

const port = Number(process.env.API_PORT ?? 8787);
// 127.0.0.1 for a bare host process (only the host's own reverse proxy can reach it); overridden
// to 0.0.0.0 in infra/compose/docker-compose.yml's "api" service, where the container's own
// network namespace already provides the isolation and other containers need to reach it by name.
const host = process.env.API_HOST ?? "127.0.0.1";

async function main() {
  await ensureBucket();
  const app = buildServer();
  await app.listen({ port, host });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
