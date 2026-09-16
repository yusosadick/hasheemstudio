#!/usr/bin/env node
// Real cross-tenant RLS negative test against the live dedicated hasheemstudio stack — per
// docs/IMPLEMENTATION-PLAN.md Phase 3 gate: "user A cannot read/write user B's resources; cannot
// self-promote." Creates two throwaway users via the GoTrue admin API, signs each in for a real
// access token, and exercises PostgREST directly. Cleans up the users it creates on exit.
//
// Usage: node tests/security/rls.cross-tenant.mjs --env local

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

function parseEnvFile(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const envName = arg("--env", "local");
const environments = JSON.parse(readFileSync(join(repoRoot, "scripts", "db", "environments.json"), "utf8"));
const envCfg = environments[envName];
if (!envCfg || !existsSync(envCfg.secretsFile)) {
  console.error(`Environment '${envName}' not provisioned.`);
  process.exit(1);
}
const secrets = parseEnvFile(readFileSync(envCfg.secretsFile, "utf8"));
const anonKey = secrets.get("ANON_KEY");
const serviceKey = secrets.get("SERVICE_ROLE_KEY");
const gatewayPort = secrets.get("API_GW_HTTP_PORT") ?? "58000";
const base = `http://127.0.0.1:${gatewayPort}`;

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

async function adminCreateUser(email, password) {
  const res = await fetch(`${base}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`admin create user failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function adminDeleteUser(id) {
  await fetch(`${base}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
}

async function signIn(email, password) {
  const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`sign in failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function rest(path, token, init = {}) {
  return fetch(`${base}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

const suffix = Date.now();
const userA = { email: `rls-test-a-${suffix}@example.invalid`, password: `Aa1!${suffix}xx` };
const userB = { email: `rls-test-b-${suffix}@example.invalid`, password: `Bb1!${suffix}xx` };
let createdA, createdB;

try {
  createdA = await adminCreateUser(userA.email, userA.password);
  createdB = await adminCreateUser(userB.email, userB.password);
  record("admin can create test users", true, `${createdA.id}, ${createdB.id}`);

  const sessionA = await signIn(userA.email, userA.password);
  const sessionB = await signIn(userB.email, userB.password);
  record("both test users can sign in", true);

  // Each user's personal workspace should have been created atomically by the 0002 migration's trigger.
  const workspacesA = await (await rest("/workspaces?select=id,name", sessionA.access_token)).json();
  const workspacesB = await (await rest("/workspaces?select=id,name", sessionB.access_token)).json();
  record(
    "registration trigger created exactly one personal workspace per user",
    Array.isArray(workspacesA) && workspacesA.length === 1 && Array.isArray(workspacesB) && workspacesB.length === 1,
    `A has ${workspacesA.length}, B has ${workspacesB.length}`,
  );

  const workspaceBId = workspacesB[0]?.id;

  // Cross-tenant read: A queries B's specific workspace id. RLS must silently filter it out (empty
  // result), not error and not leak the row.
  const crossRead = await (await rest(`/workspaces?id=eq.${workspaceBId}`, sessionA.access_token)).json();
  record("user A cannot read user B's workspace by id", Array.isArray(crossRead) && crossRead.length === 0, JSON.stringify(crossRead));

  // Cross-tenant profile read: A queries B's profile by id.
  const crossProfile = await (await rest(`/profiles?id=eq.${createdB.id}`, sessionA.access_token)).json();
  record("user A cannot read user B's profile", Array.isArray(crossProfile) && crossProfile.length === 0, JSON.stringify(crossProfile));

  // Privilege escalation: A tries to add themselves to B's workspace as owner. No INSERT policy on
  // workspace_members exists, so RLS must deny this outright.
  const escalate = await rest("/workspace_members", sessionA.access_token, {
    method: "POST",
    body: JSON.stringify({ workspace_id: workspaceBId, user_id: createdA.id, role: "owner" }),
  });
  record(
    "user A cannot insert themselves into user B's workspace_members",
    escalate.status === 401 || escalate.status === 403,
    `status=${escalate.status}`,
  );

  // Self-promotion to platform_admins: platform_admins has RLS enabled with zero policies, so any
  // client-side attempt must be denied regardless of role.
  const selfPromote = await rest("/platform_admins", sessionA.access_token, {
    method: "POST",
    body: JSON.stringify({ user_id: createdA.id }),
  });
  record(
    "user A cannot self-promote into platform_admins",
    selfPromote.status === 401 || selfPromote.status === 403,
    `status=${selfPromote.status}`,
  );
} finally {
  if (createdA) await adminDeleteUser(createdA.id);
  if (createdB) await adminDeleteUser(createdB.id);
  console.log(`Cleaned up ${createdA ? 1 : 0}${createdB ? "+1" : ""} test user(s).`);
}

const allPass = results.every((r) => r.pass);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
process.exit(allPass ? 0 : 1);
