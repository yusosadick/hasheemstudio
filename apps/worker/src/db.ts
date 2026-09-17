import pg from "pg";
import { requireEnv } from "./env.js";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  pool = new pg.Pool({
    // Host-run default: 127.0.0.1 + the published Supavisor port. In-container
    // (infra/compose/docker-compose.yml "worker" service), these are overridden to the internal
    // Docker service name/port so the container never needs a published host port at all.
    host: process.env.WORKER_DB_HOST ?? "127.0.0.1",
    port: Number(process.env.WORKER_DB_PORT ?? requireEnv("POOLER_PROXY_PORT_TRANSACTION")),
    user: "postgres.hasheemstudio",
    password: requireEnv("POSTGRES_PASSWORD"),
    database: requireEnv("POSTGRES_DB"),
    max: 5,
  });
  // Same fix as apps/api/src/db.ts: an unhandled pool 'error' event (e.g. the pooler container
  // restarting) would otherwise crash the whole worker process instead of just logging it.
  pool.on("error", (err) => {
    console.error("Postgres pool error on an idle client (connection likely dropped externally):", err.message);
  });
  return pool;
}
