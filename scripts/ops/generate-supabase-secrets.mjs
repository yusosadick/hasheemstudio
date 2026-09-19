#!/usr/bin/env node
// Generates real, random secrets for the dedicated Hasheem Studio Supabase + Redis stack
// (infra/compose/docker-compose.yml) and writes them to a protected env file — never to stdout,
// never into the repo. Safe to re-run: refuses to overwrite an existing target file unless
// --force is passed, so it can't silently rotate secrets a running stack depends on.
//
// Usage:
//   node scripts/ops/generate-supabase-secrets.mjs --env local
//   node scripts/ops/generate-supabase-secrets.mjs --env staging --force
//
// Writes: /etc/hasheemstudio/<env>.env (mode 0600). Merges generated secrets over the
// non-secret template at infra/compose/.env.example, so the output is a complete env file
// docker compose can be pointed at with --env-file.

import { randomBytes } from "node:crypto";
import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

function parseArgs(argv) {
  const out = { env: null, force: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--env") out.env = argv[++i];
    else if (argv[i] === "--force") out.force = true;
  }
  return out;
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signHS256Jwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret).update(signingInput).digest();
  const encodedSignature = base64url(signature);
  return `${signingInput}.${encodedSignature}`;
}

function randomHex(bytes) {
  return randomBytes(bytes).toString("hex");
}

function randomBase64(bytes) {
  return randomBytes(bytes).toString("base64");
}

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

function main() {
  const { env, force } = parseArgs(process.argv.slice(2));
  if (!env) {
    console.error("Usage: node scripts/ops/generate-supabase-secrets.mjs --env <local|staging|production> [--force]");
    process.exit(1);
  }

  const defaultTargetDir = process.platform === "darwin"
    ? join(homedir(), ".config", "hasheemstudio")
    : "/etc/hasheemstudio";
  const targetFile = process.env.HASHEEMSTUDIO_ENV_FILE ?? join(defaultTargetDir, `${env}.env`);
  const targetDir = dirname(targetFile);

  if (existsSync(targetFile) && !force) {
    console.error(`Refusing to overwrite existing ${targetFile} without --force.`);
    console.error("If you actually intend to rotate secrets for a running stack, do that");
    console.error("deliberately (rotating JWT_SECRET invalidates all issued sessions/API keys).");
    process.exit(1);
  }

  const templatePath = join(repoRoot, "infra", "compose", ".env.example");
  const template = parseEnvFile(readFileSync(templatePath, "utf8"));

  const jwtSecret = randomHex(32); // 64 hex chars, well over the required 32
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tenYears = 10 * 365 * 24 * 60 * 60;

  const anonKey = signHS256Jwt(
    { role: "anon", iss: "hasheemstudio", iat: nowSeconds, exp: nowSeconds + tenYears },
    jwtSecret,
  );
  const serviceRoleKey = signHS256Jwt(
    { role: "service_role", iss: "hasheemstudio", iat: nowSeconds, exp: nowSeconds + tenYears },
    jwtSecret,
  );

  const generated = new Map([
    // This value is interpolated into postgres:// and ecto:// URLs by Compose.
    // Keep it URL-safe without relying on every consumer to encode it first.
    ["POSTGRES_PASSWORD", randomHex(24)],
    ["JWT_SECRET", jwtSecret],
    ["ANON_KEY", anonKey],
    ["SERVICE_ROLE_KEY", serviceRoleKey],
    ["DASHBOARD_PASSWORD", randomBase64(18)],
    ["SECRET_KEY_BASE", randomHex(32)],
    ["VAULT_ENC_KEY", randomBase64(24).slice(0, 32)], // must be exactly 32 chars
    ["PG_META_CRYPTO_KEY", randomBase64(24).slice(0, 32)],
    ["REDIS_PASSWORD", randomBase64(24)],
  ]);

  const merged = new Map(template);
  for (const [k, v] of generated) merged.set(k, v);

  const lines = [...merged.entries()].map(([k, v]) => `${k}=${v}`);
  const content = `# Generated ${new Date().toISOString()} by scripts/ops/generate-supabase-secrets.mjs\n` +
    `# Environment: ${env}. DO NOT COMMIT. DO NOT PASTE INTO CHAT/LOGS.\n\n` +
    lines.join("\n") + "\n";

  mkdirSync(targetDir, { recursive: true, mode: 0o700 });
  writeFileSync(targetFile, content, { mode: 0o600 });
  chmodSync(targetFile, 0o600);

  console.log(`Wrote ${targetFile} (mode 600).`);
  console.log(`Generated ${generated.size} secret values; none printed here.`);
  console.log(`Merged with ${template.size} non-secret defaults from infra/compose/.env.example.`);
  console.log(`Next: docker compose --env-file ${targetFile} -f infra/compose/docker-compose.yml -p hasheemstudio up -d`);
}

main();
