#!/usr/bin/env node
// Real migration runner per docs/MIGRATIONS.md. Connects via the Supavisor SESSION pooler
// (not the transaction pooler) so advisory locks hold for the whole run. Honest about scope:
// this session currently executes ON the same VPS the "local"/"staging" stack runs on, so there
// is no actual SSH hop yet for those two environments (see docs/STATUS.md for what that means for
// the "real SSH-based staging migration from a separate client terminal" acceptance test — it is
// NOT yet satisfied by this script alone). "production" has no environment provisioned at all and
// will refuse to run.

import { Client } from "pg";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const migrationsDir = join(repoRoot, "supabase", "migrations");
const LEDGER_SCHEMA = "_hasheemstudio_meta";
const LEDGER_TABLE = "schema_migrations";
const ADVISORY_LOCK_KEY = 7_262_747_270n; // arbitrary fixed constant, unique to this project's migration lock

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const out = { command, env: null, sha: null, confirm: null };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--env") out.env = rest[++i];
    else if (rest[i] === "--sha") out.sha = rest[++i];
    else if (rest[i] === "--confirm") out.confirm = rest[++i];
  }
  return out;
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

function loadEnvironments() {
  return JSON.parse(readFileSync(join(__dirname, "environments.json"), "utf8"));
}

function resolveEnvironment(envName) {
  const envs = loadEnvironments();
  const cfg = envs[envName];
  if (!cfg) {
    throw new Error(`Unknown environment '${envName}'. Known: ${Object.keys(envs).filter((k) => k !== "_comment").join(", ")}`);
  }
  const secretsFile = envName === "local" && process.env.HASHEEMSTUDIO_ENV_FILE
    ? process.env.HASHEEMSTUDIO_ENV_FILE
    : cfg.secretsFile;
  if (!existsSync(secretsFile)) {
    throw new Error(
      `Environment '${envName}' is not provisioned: ${secretsFile} does not exist. ${cfg.description}`,
    );
  }
  const secrets = parseEnvFile(readFileSync(secretsFile, "utf8"));
  const password = secrets.get("POSTGRES_PASSWORD");
  const port = secrets.get(cfg.sessionPortEnvVar);
  if (!password || !port) {
    throw new Error(`Environment '${envName}' secrets file is missing POSTGRES_PASSWORD or ${cfg.sessionPortEnvVar}.`);
  }
  return {
    name: envName,
    requiresConfirm: cfg.requiresConfirm,
    confirmValue: cfg.confirmValue,
    client: {
      host: cfg.sessionHost,
      port: Number(port),
      user: cfg.sessionUser,
      password,
      database: cfg.database,
    },
  };
}

function readLocalMigrations() {
  if (!existsSync(migrationsDir)) return [];
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  return files.map((filename) => {
    const content = readFileSync(join(migrationsDir, filename), "utf8");
    const checksum = createHash("sha256").update(content).digest("hex");
    return { version: filename, content, checksum };
  });
}

function gitChecks(requestedSha) {
  const problems = [];
  let headSha = null;
  try {
    headSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();
  } catch {
    problems.push("Could not resolve git HEAD — is this running inside the repo?");
    return { problems, headSha: null, dirty: true };
  }

  const status = execFileSync("git", ["status", "--porcelain"], { cwd: repoRoot, encoding: "utf8" }).trim();
  const dirty = status.length > 0;
  if (dirty) {
    problems.push("Working tree is dirty (uncommitted changes). Refusing to apply from a mutable working tree.");
  }

  if (!requestedSha || requestedSha === "<PUSHED_COMMIT_SHA>" || !/^[0-9a-f]{7,40}$/i.test(requestedSha)) {
    problems.push(`--sha is missing or looks like a placeholder: '${requestedSha}'.`);
  } else if (requestedSha !== headSha && !headSha.startsWith(requestedSha)) {
    problems.push(`--sha ${requestedSha} does not match local HEAD ${headSha}. Check out the exact pushed commit before running.`);
  }

  let pushedToOrigin = false;
  try {
    const originMain = execFileSync("git", ["rev-parse", "origin/main"], { cwd: repoRoot, encoding: "utf8" }).trim();
    pushedToOrigin = originMain === headSha;
    if (!pushedToOrigin) {
      problems.push(
        `Local HEAD (${headSha}) does not match origin/main (${originMain}) as last known to this checkout. ` +
        `Push first, and run 'git fetch' before trusting this check if origin/main may be stale.`,
      );
    }
  } catch {
    problems.push("Could not resolve origin/main — cannot confirm this commit is actually pushed.");
  }

  return { problems, headSha, dirty, pushedToOrigin };
}

async function withClient(envCfg, fn) {
  const client = new Client(envCfg.client);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function ensureLedger(client) {
  await client.query(`create schema if not exists ${LEDGER_SCHEMA}`);
  await client.query(`
    create table if not exists ${LEDGER_SCHEMA}.${LEDGER_TABLE} (
      version text primary key,
      checksum text not null,
      applied_at timestamptz not null default now(),
      applied_by text not null default current_user
    )
  `);
}

async function readLedger(client) {
  const res = await client.query(`select version, checksum, applied_at from ${LEDGER_SCHEMA}.${LEDGER_TABLE} order by version`);
  return res.rows;
}

async function readBootstrapMarker(client) {
  try {
    const res = await client.query(`select project from ${LEDGER_SCHEMA}.bootstrap limit 1`);
    return res.rows[0]?.project ?? null;
  } catch {
    return null;
  }
}

function diffMigrations(local, ledgerRows) {
  const ledgerByVersion = new Map(ledgerRows.map((r) => [r.version, r.checksum]));
  const pending = [];
  const drifted = [];
  for (const m of local) {
    if (!ledgerByVersion.has(m.version)) {
      pending.push(m);
    } else if (ledgerByVersion.get(m.version) !== m.checksum) {
      drifted.push(m.version);
    }
  }
  return { pending, drifted };
}

async function cmdStatus({ env }) {
  const envCfg = resolveEnvironment(env);
  const local = readLocalMigrations();
  const result = await withClient(envCfg, async (client) => {
    await ensureLedger(client);
    const ledgerRows = await readLedger(client);
    const marker = await readBootstrapMarker(client);
    const { pending, drifted } = diffMigrations(local, ledgerRows);
    return {
      env,
      connected: true,
      dbHost: envCfg.client.host,
      dbPort: envCfg.client.port,
      dbBootstrapMarker: marker,
      appliedVersions: ledgerRows.map((r) => r.version),
      pendingVersions: pending.map((m) => m.version),
      driftedVersions: drifted,
    };
  });
  console.log(JSON.stringify(result, null, 2));
}

async function cmdPlan({ env, sha }) {
  const envCfg = resolveEnvironment(env);
  const git = gitChecks(sha);
  const local = readLocalMigrations();

  const result = await withClient(envCfg, async (client) => {
    await ensureLedger(client);
    const ledgerRows = await readLedger(client);
    const marker = await readBootstrapMarker(client);
    const { pending, drifted } = diffMigrations(local, ledgerRows);
    const problems = [...git.problems];
    if (drifted.length > 0) {
      problems.push(`Checksum drift on already-applied migrations: ${drifted.join(", ")}. Refusing to plan.`);
    }
    return {
      env,
      sha,
      headSha: git.headSha,
      dbBootstrapMarker: marker,
      ok: problems.length === 0,
      problems,
      willApply: pending.map((m) => m.version),
    };
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

async function cmdApply({ env, sha, confirm }) {
  const envCfg = resolveEnvironment(env);
  if (envCfg.requiresConfirm && confirm !== envCfg.confirmValue) {
    console.error(`Environment '${env}' requires --confirm ${envCfg.confirmValue}`);
    process.exit(1);
  }

  const git = gitChecks(sha);
  const local = readLocalMigrations();

  const result = await withClient(envCfg, async (client) => {
    await ensureLedger(client);
    const ledgerRows = await readLedger(client);
    const { pending, drifted } = diffMigrations(local, ledgerRows);

    const problems = [...git.problems];
    if (drifted.length > 0) {
      problems.push(`Checksum drift on already-applied migrations: ${drifted.join(", ")}. Refusing to apply.`);
    }
    if (problems.length > 0) {
      return { env, sha, ok: false, problems, applied: [] };
    }

    await client.query(`select pg_advisory_lock($1)`, [ADVISORY_LOCK_KEY.toString()]);
    const applied = [];
    try {
      for (const m of pending) {
        try {
          await client.query("begin");
          await client.query(m.content);
          await client.query(
            `insert into ${LEDGER_SCHEMA}.${LEDGER_TABLE} (version, checksum) values ($1, $2)`,
            [m.version, m.checksum],
          );
          await client.query("commit");
          applied.push(m.version);
        } catch (err) {
          await client.query("rollback").catch(() => {});
          return {
            env,
            sha,
            ok: false,
            problems: [`Migration ${m.version} failed: ${err.message}`],
            applied,
          };
        }
      }
    } finally {
      await client.query(`select pg_advisory_unlock($1)`, [ADVISORY_LOCK_KEY.toString()]);
    }

    return { env, sha, ok: true, problems: [], applied };
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

async function cmdVerify({ env, sha }) {
  const envCfg = resolveEnvironment(env);
  const local = readLocalMigrations();

  const result = await withClient(envCfg, async (client) => {
    await ensureLedger(client);
    const ledgerRows = await readLedger(client);
    const { pending, drifted } = diffMigrations(local, ledgerRows);
    const marker = await readBootstrapMarker(client);

    const tablesRes = await client.query(`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name in ('profiles','workspaces','workspace_members','platform_admins')
      order by table_name
    `);
    const rlsRes = await client.query(`
      select relname, relrowsecurity from pg_class
      where relnamespace = 'public'::regnamespace
        and relname in ('profiles','workspaces','workspace_members','platform_admins')
      order by relname
    `);
    const policiesRes = await client.query(`
      select tablename, policyname from pg_policies where schemaname = 'public' order by tablename, policyname
    `);

    const schemaDigest = createHash("sha256")
      .update(local.map((m) => `${m.version}:${m.checksum}`).join("\n"))
      .digest("hex")
      .slice(0, 16);

    const allTablesPresent = tablesRes.rows.length === 4;
    const allRlsEnabled = rlsRes.rows.length === 4 && rlsRes.rows.every((r) => r.relrowsecurity === true);
    const noPendingOrDrift = pending.length === 0 && drifted.length === 0;

    return {
      env,
      sha,
      dbBootstrapMarker: marker,
      schemaDigest,
      appliedVersions: ledgerRows.map((r) => r.version),
      pendingVersions: pending.map((m) => m.version),
      driftedVersions: drifted,
      tablesFound: tablesRes.rows.map((r) => r.table_name),
      rlsEnabled: rlsRes.rows,
      policies: policiesRes.rows,
      checks: {
        allTablesPresent,
        allRlsEnabled,
        noPendingOrDrift,
      },
      ok: allTablesPresent && allRlsEnabled && noPendingOrDrift,
    };
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command || !args.env) {
    console.error("Usage: node scripts/db/remote.mjs <status|plan|apply|verify> --env <name> [--sha <sha>] [--confirm <value>]");
    process.exit(1);
  }
  try {
    if (args.command === "status") await cmdStatus(args);
    else if (args.command === "plan") await cmdPlan(args);
    else if (args.command === "apply") await cmdApply(args);
    else if (args.command === "verify") await cmdVerify(args);
    else {
      console.error(`Unknown command '${args.command}'.`);
      process.exit(1);
    }
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: err.message }, null, 2));
    process.exit(1);
  }
}

main();
