import { loadEnv } from "./env.js";
loadEnv();

import { buildServer } from "./server.js";
import { ensureBucket } from "./storage.js";

const port = Number(process.env.API_PORT ?? 8787);

async function main() {
  await ensureBucket();
  const app = buildServer();
  await app.listen({ port, host: "127.0.0.1" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
