#!/usr/bin/env node
// Real `pnpm dev:up`: brings up the dedicated local Supabase+Redis+worker stack
// (infra/compose/docker-compose.yml), generating secrets on first run if they don't exist yet.
// Safe to re-run — idempotent, never touches any other project's containers/networks/volumes
// (everything here is prefixed `hasheemstudio`).
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const composeDir = join(repoRoot, "infra", "compose");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const envName = arg("--env", "local");
const defaultSecretsDir = process.platform === "darwin"
  ? join(homedir(), ".config", "hasheemstudio")
  : "/etc/hasheemstudio";
const secretsFile = process.env.HASHEEMSTUDIO_ENV_FILE ?? join(defaultSecretsDir, `${envName}.env`);

function run(cmd, args, opts = {}) {
  console.log(`+ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
}

// Real bug found and fixed 2026-09-17: running `pnpm dev:up` from a second clone of this repo
// (a different absolute path) while the stack is already running from a first clone causes Docker
// Compose to see a different resolved config-file path for the same project name, decide the
// config changed, and try to recreate shared containers — which briefly took hasheemstudio-pooler
// and hasheemstudio-worker down and crashed the API (a related pg.Pool bug, also fixed, see
// apps/api/src/db.ts) mid-test. Guard against repeating that: refuse if a hasheemstudio container
// is already running from a different checkout path.
const composeFilePath = join(composeDir, "docker-compose.yml");
const composeFiles = ["-f", composeFilePath];
if (process.platform === "darwin") {
  composeFiles.push("-f", join(composeDir, "docker-compose.mac.yml"));
}
try {
  const existingLabel = execFileSync("docker", [
    "inspect", "-f", "{{ index .Config.Labels \"com.docker.compose.project.config_files\" }}", "hasheemstudio-db",
  ], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  if (existingLabel && existingLabel !== composeFilePath) {
    console.error(`The hasheemstudio stack is already running from a different checkout:\n  ${existingLabel}\nThis checkout is:\n  ${composeFilePath}\nRunning dev:up from here would make Compose try to recreate shared containers and can cause a disruptive restart (found the hard way — see this script's comments). Use the checkout at the path above, or stop that stack first if you really mean to switch checkouts.`);
    process.exit(1);
  }
} catch {
  // hasheemstudio-db doesn't exist yet — nothing running to conflict with, proceed normally.
}

if (!existsSync(secretsFile)) {
  console.log(`No secrets file at ${secretsFile} yet — generating (first run for this environment).`);
  run("node", [join(repoRoot, "scripts", "ops", "generate-supabase-secrets.mjs"), "--env", envName]);
} else {
  console.log(`Using existing secrets file at ${secretsFile}.`);
}

console.log("\nBringing up the hasheemstudio Compose stack (Supabase + Redis + sandboxed worker)...");
run("docker", [
  "compose",
  "--env-file", secretsFile,
  ...composeFiles,
  "-p", "hasheemstudio",
  "up", "-d", "--build",
]);

console.log("\nWaiting for services to report healthy (up to 90s)...");
const deadline = Date.now() + 90_000;
let allHealthy = false;
while (Date.now() < deadline) {
  const psOut = execFileSync("docker", [
    "compose", "--env-file", secretsFile, ...composeFiles, "-p", "hasheemstudio", "ps", "--format", "json",
  ]).toString();
  const services = psOut.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const unhealthy = services.filter((s) => s.Health && s.Health !== "healthy");
  if (unhealthy.length === 0) {
    allHealthy = true;
    break;
  }
  await new Promise((r) => setTimeout(r, 3000));
}

if (!allHealthy) {
  console.error("\nSome services did not report healthy within 90s. Check with:");
  console.error(`  docker compose --env-file ${secretsFile} ${composeFiles.join(" ")} -p hasheemstudio ps`);
  process.exit(1);
}

console.log("\nAll services healthy. Stack is up:");
console.log("  - Supabase gateway:  http://127.0.0.1:<API_GW_HTTP_PORT> (see the env file for the port)");
console.log("  - Redis:             127.0.0.1:<REDIS_PORT>");
console.log("  - Worker:            running in a sandboxed container (hasheemstudio-worker)");
console.log("\nNext: pnpm db:local:migrate, then pnpm dev");
