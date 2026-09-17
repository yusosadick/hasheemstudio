#!/usr/bin/env node
// Real `pnpm dev:up`: brings up the dedicated local Supabase+Redis+worker stack
// (infra/compose/docker-compose.yml), generating secrets on first run if they don't exist yet.
// Safe to re-run — idempotent, never touches any other project's containers/networks/volumes
// (everything here is prefixed `hasheemstudio`).
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const composeDir = join(repoRoot, "infra", "compose");

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const envName = arg("--env", "local");
const secretsFile = `/etc/hasheemstudio/${envName}.env`;

function run(cmd, args, opts = {}) {
  console.log(`+ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
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
  "-f", join(composeDir, "docker-compose.yml"),
  "-p", "hasheemstudio",
  "up", "-d", "--build",
]);

console.log("\nWaiting for services to report healthy (up to 90s)...");
const deadline = Date.now() + 90_000;
let allHealthy = false;
while (Date.now() < deadline) {
  const psOut = execFileSync("docker", [
    "compose", "--env-file", secretsFile, "-f", join(composeDir, "docker-compose.yml"), "-p", "hasheemstudio", "ps", "--format", "json",
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
  console.error(`  docker compose --env-file ${secretsFile} -f ${join(composeDir, "docker-compose.yml")} -p hasheemstudio ps`);
  process.exit(1);
}

console.log("\nAll services healthy. Stack is up:");
console.log("  - Supabase gateway:  http://127.0.0.1:<API_GW_HTTP_PORT> (see the env file for the port)");
console.log("  - Redis:             127.0.0.1:<REDIS_PORT>");
console.log("  - Worker:            running in a sandboxed container (hasheemstudio-worker)");
console.log("\nNext: pnpm db:local:migrate, then pnpm dev");
