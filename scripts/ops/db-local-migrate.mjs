#!/usr/bin/env node
// Real `pnpm db:local:migrate`: applies pending migrations to the local environment via the same
// scripts/db/remote.mjs runner used for staging/production (docs/MIGRATIONS.md) — there is
// deliberately no separate, less-safe "local" migration path; the safety checks (clean tree,
// pushed SHA, checksum drift) apply here too.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
const runner = join(repoRoot, "scripts", "db", "remote.mjs");

console.log(`Applying migrations to 'local' at HEAD ${sha}...`);
execFileSync("node", [runner, "apply", "--env", "local", "--sha", sha], { stdio: "inherit", cwd: repoRoot });
console.log("\nVerifying...");
execFileSync("node", [runner, "verify", "--env", "local", "--sha", sha], { stdio: "inherit", cwd: repoRoot });
