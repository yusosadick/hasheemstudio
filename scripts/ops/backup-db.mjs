#!/usr/bin/env node
// Real encrypted off-host-style Postgres backup (docs/BACKUP-RESTORE.md). Runs pg_dump inside the
// dedicated hasheemstudio-db container (never touching any other project's database), streams the
// dump into Node, encrypts it with AES-256-GCM using a key that never appears in a command-line
// argument or log (read from a protected file, used only in-process), and writes the result plus
// a sha256/size manifest to a backup destination directory.
//
// "Off-host" honestly: this VPS is a single host, so a backup written to another directory on the
// same disk is not yet a real separate failure domain — see docs/BACKUP-RESTORE.md and
// docs/DECISIONS.md item 4 (approved off-host storage provider still pending). This script is
// still real and correct; only the storage destination is a known, documented gap.
import { execFile } from "node:child_process";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const envName = arg("--env", "local");
const destDir = arg("--dest", "/home/yuso/hasheemstudio-backups");
const secretsFile = `/etc/hasheemstudio/${envName}.env`;
const keyFile = "/etc/hasheemstudio/backup-encryption.key";

function parseEnvFile(text) {
  const map = new Map();
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    map.set(t.slice(0, eq), t.slice(eq + 1));
  }
  return map;
}

const secrets = parseEnvFile(readFileSync(secretsFile, "utf8"));
const postgresPassword = secrets.get("POSTGRES_PASSWORD");
const postgresDb = secrets.get("POSTGRES_DB");
const backupKeyB64 = readFileSync(keyFile, "utf8").trim();
const backupKey = Buffer.from(backupKeyB64, "base64");
if (backupKey.length !== 32) throw new Error("Backup encryption key must decode to 32 bytes (AES-256)");

function dumpDatabase() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const child = execFile(
      "docker",
      ["exec", "-e", `PGPASSWORD=${postgresPassword}`, "hasheemstudio-db", "pg_dump", "-U", "postgres", "-d", postgresDb, "-Fc"],
      { maxBuffer: 1024 * 1024 * 1024, encoding: "buffer" },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`pg_dump failed: ${err.message}\n${stderr}`));
        } else {
          resolve(stdout);
        }
      },
    );
  });
}

async function main() {
  const startedAt = Date.now();
  console.log(`Dumping database '${postgresDb}' from hasheemstudio-db...`);
  const plaintext = await dumpDatabase();
  const plaintextChecksum = createHash("sha256").update(plaintext).digest("hex");
  console.log(`Dump complete: ${plaintext.length} bytes, sha256=${plaintextChecksum}`);

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", backupKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  mkdirSync(destDir, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dumpPath = join(destDir, `hasheemstudio-${envName}-${timestamp}.dump.enc`);
  // Format: [12-byte IV][16-byte authTag][ciphertext] — self-contained, one file to move around.
  writeFileSync(dumpPath, Buffer.concat([iv, authTag, ciphertext]), { mode: 0o600 });

  const durationMs = Date.now() - startedAt;
  const manifest = {
    timestamp: new Date().toISOString(),
    env: envName,
    sourceContainer: "hasheemstudio-db",
    sourceDatabase: postgresDb,
    plaintextBytes: plaintext.length,
    plaintextSha256: plaintextChecksum,
    encryptedFile: dumpPath,
    encryptedBytes: ciphertext.length + 28,
    encryption: "aes-256-gcm, key at /etc/hasheemstudio/backup-encryption.key (never in this manifest)",
    durationMs,
  };
  writeFileSync(dumpPath.replace(/\.dump\.enc$/, ".manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(`\nWrote ${dumpPath} (${manifest.encryptedBytes} bytes, mode 600)`);
  console.log(`Wrote manifest alongside it. Duration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
