// Duplicated from apps/api/src/env.ts — see docs/STATUS.md "known gaps" for the note about
// consolidating this into packages/config once that package is built out.
import { existsSync, readFileSync } from "node:fs";

const path = process.env.HASHEEMSTUDIO_ENV_FILE ?? "/etc/hasheemstudio/local.env";

export function loadEnv(): void {
  // In the containerized deployment (infra/compose/docker-compose.yml "worker" service), no
  // secrets file is mounted at all — every value is injected directly as a container environment
  // variable by Compose. This is expected there, not an error.
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
  if (!value) throw new Error(`Missing required env var ${key} (checked process.env, then ${path})`);
  return value;
}
