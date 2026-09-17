#!/usr/bin/env node
// Real `pnpm dev`: starts apps/api (bare Node process — not containerized yet, see
// docs/STATUS.md) and apps/web (Vite dev server) together, forwarding both processes' output and
// shutting both down cleanly on Ctrl+C. Assumes `pnpm dev:up` has already brought up the
// Supabase/Redis/worker stack (checked below, not assumed).
import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

const secretsFile = process.env.HASHEEMSTUDIO_ENV_FILE ?? "/etc/hasheemstudio/local.env";
if (!existsSync(secretsFile)) {
  console.error(`No secrets file at ${secretsFile}. Run \`pnpm dev:up\` first.`);
  process.exit(1);
}

try {
  const health = execFileSync("docker", ["inspect", "-f", "{{.State.Health.Status}}", "hasheemstudio-envoy"]).toString().trim();
  if (health !== "healthy") {
    console.error(`Supabase gateway is not healthy (status: ${health}). Run \`pnpm dev:up\` first.`);
    process.exit(1);
  }
} catch {
  console.error("Supabase gateway container not found. Run `pnpm dev:up` first.");
  process.exit(1);
}

const children = [];

function startProcess(name, cmd, args, cwd, extraEnv = {}) {
  const proc = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = `[${name}]`;
  proc.stdout.on("data", (d) => process.stdout.write(`${prefix} ${d}`));
  proc.stderr.on("data", (d) => process.stderr.write(`${prefix} ${d}`));
  proc.on("exit", (code) => {
    console.log(`${prefix} exited with code ${code}`);
  });
  children.push(proc);
  return proc;
}

console.log("Starting apps/api (http://127.0.0.1:8787) and apps/web (http://127.0.0.1:5173)...\n");

startProcess("api", "node", ["--import", "tsx/esm", "src/index.ts"], join(repoRoot, "apps", "api"));
startProcess("web", "npx", ["vite", "--port", "5173", "--host", "127.0.0.1"], join(repoRoot, "apps", "web"));

function shutdown() {
  console.log("\nShutting down dev processes...");
  for (const c of children) {
    try {
      c.kill("SIGTERM");
    } catch {
      // already dead
    }
  }
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
