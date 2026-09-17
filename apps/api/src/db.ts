// Server-side Postgres pool using the service-role database role, connected via the Supavisor
// TRANSACTION pooler (ordinary API request/response traffic) per docs/ARCHITECTURE.md. The API
// never trusts a client-submitted workspace_id alone — every route re-checks membership itself.
import pg from "pg";
import { requireEnv } from "./env.js";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  pool = new pg.Pool({
    // Host-run default: 127.0.0.1 + the published Supavisor port. In-container
    // (infra/compose/docker-compose.yml "api" service), these are overridden to the internal
    // Docker service name/port, same pattern as apps/worker/src/db.ts.
    host: process.env.API_DB_HOST ?? "127.0.0.1",
    port: Number(process.env.API_DB_PORT ?? requireEnv("POOLER_PROXY_PORT_TRANSACTION")),
    user: "postgres.hasheemstudio",
    password: requireEnv("POSTGRES_PASSWORD"),
    database: requireEnv("POSTGRES_DB"),
    max: 10,
  });
  // Real bug found and fixed 2026-09-17: node-postgres emits 'error' on the pool when an IDLE
  // client's connection is dropped out from under it (e.g. the Supavisor pooler container
  // restarting) — with no listener, that's an unhandled EventEmitter error, which crashes the
  // whole Node process. A transient pooler restart should not take the API down.
  pool.on("error", (err) => {
    console.error("Postgres pool error on an idle client (connection likely dropped externally):", err.message);
  });
  return pool;
}
