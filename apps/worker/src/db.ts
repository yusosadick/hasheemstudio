import pg from "pg";
import { requireEnv } from "./env.js";

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;
  pool = new pg.Pool({
    host: "127.0.0.1",
    port: Number(requireEnv("POOLER_PROXY_PORT_TRANSACTION")),
    user: "postgres.hasheemstudio",
    password: requireEnv("POSTGRES_PASSWORD"),
    database: requireEnv("POSTGRES_DB"),
    max: 5,
  });
  return pool;
}
