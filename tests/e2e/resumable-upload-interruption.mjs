#!/usr/bin/env node
// Real interruption/resume test for the TUS resumable-upload path (docs/PRD.md "resumable
// uploads; interruption recovery"), plus real cross-tenant and size-limit checks against the same
// upload path. Per the user's instruction: tests actual interrupted uploads, malicious/hostile
// inputs (a second tenant trying to write into the first tenant's object), and enforced size
// limits — not just the happy path.
//
// Usage: node tests/e2e/resumable-upload-interruption.mjs --env local

import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tusGetOffset, tusUploadChunk } from "../lib/tus-client.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
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
function sha256(buf) { return createHash("sha256").update(buf).digest("hex"); }

const envName = arg("--env", "local");
const environments = JSON.parse(readFileSync(join(repoRoot, "scripts", "db", "environments.json"), "utf8"));
const envCfg = environments[envName];
const secrets = parseEnvFile(readFileSync(envCfg.secretsFile, "utf8"));
const anonKey = secrets.get("ANON_KEY");
const serviceKey = secrets.get("SERVICE_ROLE_KEY");
const gatewayBase = `http://127.0.0.1:${secrets.get("API_GW_HTTP_PORT") ?? "58000"}`;
const apiBase = `http://127.0.0.1:${process.env.API_PORT ?? 8787}`;

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

async function createConfirmedUser(label) {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.invalid`;
  const password = `Pw1!${Date.now()}xx`;
  const created = await (await fetch(`${gatewayBase}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })).json();
  const session = await (await fetch(`${gatewayBase}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })).json();
  return { id: created.id, accessToken: session.access_token };
}

let userA, userB;

try {
  userA = await createConfirmedUser("resume-a");
  userB = await createConfirmedUser("resume-b");
  const authA = { Authorization: `Bearer ${userA.accessToken}` };
  const authB = { Authorization: `Bearer ${userB.accessToken}` };

  const fixtureBuffer = readFileSync(join(repoRoot, "tests", "fixtures", "media", "synthetic-remux-test.mov"));
  const originalChecksum = sha256(fixtureBuffer);
  const half = Math.floor(fixtureBuffer.length / 2);

  // 1. Create a session as user A.
  const session = await (await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST",
    headers: { ...authA, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "resume-test.mov", declaredSizeBytes: fixtureBuffer.length, declaredMimeType: "video/quicktime" }),
  })).json();
  record("upload session created", !!session.tusUploadPath);

  // 2. Upload only the first half — simulating an interrupted connection.
  const offsetAfterFirstHalf = await tusUploadChunk({
    gatewayBase, tusUploadPath: session.tusUploadPath, anonKey, accessToken: userA.accessToken,
    chunk: fixtureBuffer.subarray(0, half), offset: 0,
  });
  record("first half uploaded before 'interruption'", offsetAfterFirstHalf === half, `offset=${offsetAfterFirstHalf}`);

  // 3. Cross-tenant hostile-input check: user B must not be able to write into user A's object,
  //    even knowing the exact TUS path (paths aren't secret — storage RLS is what actually protects
  //    this, per supabase/migrations/0008).
  const hostilePatch = await fetch(`${gatewayBase}${session.tusUploadPath}`, {
    method: "PATCH",
    headers: {
      apikey: anonKey, ...authB,
      "Tus-Resumable": "1.0.0",
      "Upload-Offset": String(offsetAfterFirstHalf),
      "Content-Type": "application/offset+octet-stream",
    },
    body: Buffer.from("malicious payload pretending to be video bytes"),
  });
  record("a different tenant cannot write into this upload (RLS enforced, not just app logic)", !hostilePatch.ok, `status=${hostilePatch.status}`);

  // 4. Confirm the server still reports the SAME offset — the hostile attempt didn't corrupt state.
  const offsetAfterHostileAttempt = await tusGetOffset({ gatewayBase, tusUploadPath: session.tusUploadPath, anonKey, accessToken: userA.accessToken });
  record("offset unchanged after the rejected cross-tenant write attempt", offsetAfterHostileAttempt === half, `offset=${offsetAfterHostileAttempt}`);

  // 5. "Reconnect" — a real client would re-check the server's offset (not trust a locally
  //    cached value) before resuming, exactly like apps/web/src/lib/upload.ts does.
  const resumedOffset = await tusGetOffset({ gatewayBase, tusUploadPath: session.tusUploadPath, anonKey, accessToken: userA.accessToken });
  record("HEAD on reconnect reports the true server-side offset", resumedOffset === half, `offset=${resumedOffset}`);

  // 6. Resume uploading the remainder from that offset.
  const finalOffset = await tusUploadChunk({
    gatewayBase, tusUploadPath: session.tusUploadPath, anonKey, accessToken: userA.accessToken,
    chunk: fixtureBuffer.subarray(half), offset: resumedOffset,
  });
  record("resumed upload completes to the full file size", finalOffset === fixtureBuffer.length, `offset=${finalOffset}`);

  // 7. Finalize and verify the resulting media asset is byte-for-byte identical to the original —
  //    proving the interrupt+resume sequence didn't corrupt or duplicate any bytes.
  const finalized = await (await fetch(`${apiBase}/v1/uploads/sessions/${session.sessionId}/finalize`, { method: "POST", headers: authA })).json();
  record("finalize succeeds after a resumed upload", !!finalized.mediaAssetId, JSON.stringify(finalized));

  const sessionView = await (await fetch(`${apiBase}/v1/uploads/sessions/${session.sessionId}`, { headers: authA })).json();
  record("session is marked completed after finalize", sessionView.state === "completed", `state=${sessionView.state}`);

  // Real byte-for-byte integrity check: download the finalized object (service-role, same as the
  // worker would) and compare its checksum against the original fixture — proves the
  // interrupt+resume sequence produced an exact copy, not truncated/duplicated/reordered bytes.
  const downloadRes = await fetch(`${gatewayBase}/storage/v1/object/authenticated/media/${session.objectKey}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const downloadedBuffer = Buffer.from(await downloadRes.arrayBuffer());
  record(
    "the finalized object is byte-for-byte identical to the original file",
    sha256(downloadedBuffer) === originalChecksum,
    `downloaded=${downloadedBuffer.length} bytes, original=${fixtureBuffer.length} bytes`,
  );

  // 8. A duplicate finalize call on the same (now completed) session must be rejected, not
  //    silently re-processed — protects against double-charging/duplicate media assets.
  const secondFinalizeRes = await fetch(`${apiBase}/v1/uploads/sessions/${session.sessionId}/finalize`, { method: "POST", headers: authA });
  record("re-finalizing an already-completed session is rejected, not silently re-run", secondFinalizeRes.status === 409, `status=${secondFinalizeRes.status}`);

  // 9. Enforced size limit: declaring a size over the plan's cap is rejected up front.
  const oversizeRes = await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST",
    headers: { ...authA, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "too-big.mov", declaredSizeBytes: 200 * 1024 * 1024, declaredMimeType: "video/quicktime" }),
  });
  record("declaring an over-plan-limit size is rejected", oversizeRes.status === 413, `status=${oversizeRes.status}`);

  // 10. Abandoned session: create one and never touch it — its natural state ('pending', with a
  //     real expires_at) is what the retention sweeper (docs/STATUS.md Phase 5) acts on. This
  //     confirms the precondition the sweeper relies on actually exists and is queryable.
  const abandonedSession = await (await fetch(`${apiBase}/v1/uploads/sessions`, {
    method: "POST",
    headers: { ...authA, "Content-Type": "application/json" },
    body: JSON.stringify({ filename: "abandoned.mov", declaredSizeBytes: 1000, declaredMimeType: "video/quicktime" }),
  })).json();
  const abandonedView = await (await fetch(`${apiBase}/v1/uploads/sessions/${abandonedSession.sessionId}`, { headers: authA })).json();
  record("an untouched upload session is left in 'pending' state with a real expiry for the sweeper to find", abandonedView.state === "pending" && !!abandonedView.expiresAt);
} finally {
  if (userA) await fetch(`${gatewayBase}/auth/v1/admin/users/${userA.id}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  if (userB) await fetch(`${gatewayBase}/auth/v1/admin/users/${userB.id}`, { method: "DELETE", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  console.log("Cleaned up test users.");
}

const allPass = results.every((r) => r.pass);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
process.exit(allPass ? 0 : 1);
