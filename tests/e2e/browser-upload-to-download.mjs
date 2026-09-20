#!/usr/bin/env node
// Real browser-driven end-to-end test using Playwright — drives the actual apps/web UI (not
// direct HTTP calls) through login -> upload -> job processing -> download, closing the "through
// the browser" gap noted in docs/STATUS.md for the script-driven version in
// tests/e2e/upload-to-download.mjs. Requires apps/web (vite dev, :5173), apps/api (:8787) and
// apps/worker already running.
//
// Public self-service /signup sends a real confirmation email via GoTrue, which fails until
// Resend SMTP is configured (docs/DECISIONS.md item 2) — confirmed directly against the gateway
// as a real 500 "Error sending confirmation email". That's a real, already-documented blocker,
// not a bug in this app. So this test signs in via the real /login page using an
// admin-precreated, pre-confirmed user rather than driving public signup — it still exercises the
// real upload/processing/download journey through an actual browser, which is the substance of
// the Phase 4 gate.
//
// Usage: node tests/e2e/browser-upload-to-download.mjs --env local

import { chromium } from "playwright";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i !== -1 ? process.argv[i + 1] : fallback;
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

const envName = arg("--env", "local");
const environments = JSON.parse(readFileSync(join(repoRoot, "scripts", "db", "environments.json"), "utf8"));
const envCfg = environments[envName];
const secrets = parseEnvFile(readFileSync(envCfg.secretsFile, "utf8"));
const serviceKey = secrets.get("SERVICE_ROLE_KEY");
const gatewayBase = `http://127.0.0.1:${secrets.get("API_GW_HTTP_PORT") ?? "58000"}`;
const webBase = process.env.WEB_URL ?? "http://127.0.0.1:5173";

const results = [];
function record(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
}

// Playwright's own `npx playwright install` browsers may live under a version-specific directory;
// fall back to Playwright's default resolution if no explicit override is given.
const chromiumOverride = process.env.PLAYWRIGHT_CHROMIUM_PATH;

const suffix = Date.now();
const email = `browser-e2e-${suffix}@example.invalid`;
const password = `Bb1!${suffix}xx`;

const browser = await chromium.launch({
  ...(chromiumOverride ? { executablePath: chromiumOverride } : {}),
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

let userId = null;
try {
  const createRes = await fetch(`${gatewayBase}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const created = await createRes.json();
  userId = created.id;
  record("admin-precreated test user for login (signup email blocked on Resend)", createRes.ok, userId);

  await page.goto(`${webBase}/login`);
  await page.waitForSelector("h1:has-text('Welcome to Hasheem Studio')");
  await page.fill("input[type=email]", email);
  await page.getByRole("button", {name:"Continue", exact:true}).click();
  await page.fill("input[type=password]", password);
  await page.click("button[type=submit]");

  try {
    await page.waitForURL("**/app/upload", { timeout: 10000 });
    record("real login through the browser redirects to the real upload page", true, page.url());
  } catch (e) {
    record("real login through the browser redirects to the real upload page", false, `stuck at ${page.url()}; console: ${consoleErrors.join(" | ")}`);
    throw e;
  }

  const fileInput = page.locator("input[type=file]");
  await fileInput.setInputFiles(join(repoRoot, "tests", "fixtures", "media", "synthetic-remux-test.mov"));

  await page.waitForURL("**/app/jobs/*", { timeout: 20000 });
  record("uploading through the real drag/drop UI navigates to a real job page", true, page.url());

  await page.waitForSelector("text=/Job complete|Job failed|Job cancelled/", { timeout: 60000 });
  const heading = await page.locator("h1").first().textContent();
  record("job reaches a terminal state in the real rendered UI", heading?.includes("Job complete"), heading ?? "");

  const downloadButton = page.getByRole("button", {name:"Download video", exact:true});
  const hasDownload = (await downloadButton.count()) > 0;
  record("gated download action is rendered", hasDownload);
  if (hasDownload) {
    const [download] = await Promise.all([page.waitForEvent("download"), downloadButton.click()]);
    const stream = await download.createReadStream();
    let bytes=0; for await (const chunk of stream) bytes+=chunk.length;
    record("the gated browser action downloads real bytes", bytes>10000, `${bytes} bytes`);
  }

  const verificationVisible = (await page.locator("text=Verification report").count()) > 0;
  record("verification report is rendered in the real UI", verificationVisible);

  const evidenceDir = join(repoRoot, "docs", "evidence", "phase4-browser-e2e");
  if (!existsSync(evidenceDir)) mkdirSync(evidenceDir, { recursive: true });
  await page.screenshot({ path: join(evidenceDir, "job-complete.png"), fullPage: true });
  console.log(`Saved screenshot to docs/evidence/phase4-browser-e2e/job-complete.png`);

  const realErrors = consoleErrors.filter((e) => !e.toLowerCase().includes("favicon") && !e.includes("404"));
  record("no unexpected browser console errors (favicon 404 is expected/benign)", realErrors.length === 0, consoleErrors.join(" | "));
} finally {
  if (userId) {
    await fetch(`${gatewayBase}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    console.log("Cleaned up browser test user.");
  }
  await browser.close();
}

const allPass = results.every((r) => r.pass);
console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed.`);
process.exit(allPass ? 0 : 1);
