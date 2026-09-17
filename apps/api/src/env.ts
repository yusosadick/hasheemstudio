// Loads the protected, non-repo env file for this environment into process.env. Never logs
// values. Path defaults to the "local" environment used throughout docs/STATUS.md's Phase 2-4
// work; override with HASHEEMSTUDIO_ENV_FILE for other environments once they're provisioned.
import { existsSync, readFileSync } from "node:fs";

const path = process.env.HASHEEMSTUDIO_ENV_FILE ?? "/etc/hasheemstudio/local.env";

export function loadEnv(): void {
  // In the containerized deployment (infra/compose/docker-compose.yml "api" service), no secrets
  // file is mounted at all — every value is injected directly as a container environment variable
  // by Compose. This is expected there, not an error (same pattern as apps/worker/src/env.ts).
  if (!existsSync(path)) {
    console.log(`No env file at ${path}; using process environment as-is (expected inside a container).`);
    return;
  }
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var ${key} (loaded from ${path})`);
  return value;
}
