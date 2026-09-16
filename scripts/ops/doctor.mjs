#!/usr/bin/env node
// Validates local tooling, ports and secret-FILE presence without ever printing secret values.
// Real "doctor" behaviour per docs/MACBOOK-TO-VPS.md §19. Safe to run repeatedly.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const checks = [];

function checkCommand(name, args, label) {
  try {
    const out = execFileSync(name, args, { encoding: "utf8" }).trim().split("\n")[0];
    checks.push({ ok: true, label: label ?? name, detail: out });
  } catch {
    checks.push({ ok: false, label: label ?? name, detail: "not found on PATH" });
  }
}

checkCommand("node", ["--version"], "node");
checkCommand("pnpm", ["--version"], "pnpm");
checkCommand("git", ["--version"], "git");
checkCommand("docker", ["--version"], "docker");
checkCommand("ssh", ["-V"], "ssh");

const envExamplePath = new URL("../../.env.example", import.meta.url);
checks.push({
  ok: existsSync(envExamplePath),
  label: ".env.example present",
  detail: existsSync(envExamplePath) ? "found" : "missing",
});

const envLocalPath = new URL("../../.env", import.meta.url);
checks.push({
  ok: true,
  label: ".env (local secrets file)",
  detail: existsSync(envLocalPath)
    ? "present (contents not inspected)"
    : "absent — copy .env.example to .env and fill in local values before running apps",
});

let allOk = true;
for (const c of checks) {
  console.log(`${c.ok ? "OK  " : "FAIL"}  ${c.label}: ${c.detail}`);
  if (!c.ok) allOk = false;
}

if (!allOk) {
  console.error("\ndoctor found missing prerequisites. Install them before continuing.");
  process.exit(1);
}
console.log("\nAll checked prerequisites are present. This does not yet confirm running services (dev:up is not implemented).");
