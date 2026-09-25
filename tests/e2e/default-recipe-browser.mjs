#!/usr/bin/env node
// Real-browser proof of the DEFAULT homepage flow: sign in, choose a video on "/" WITHOUT touching the
// recipe selector, wait for the result page, download the file through the real download button and
// report exactly what came back. Confirms platform_optimize is preselected and that the delivered file
// is the optimized one, not a remux.
//
// Usage: TEST_WEB_URL=https://hasheemstudio.com node tests/e2e/default-recipe-browser.mjs --input <file> [--out <path>]
// Env: HASHEEMSTUDIO_ENV_FILE (admin credentials to create a disposable user), TEST_WEB_URL (default http://127.0.0.1:5173)
// Prints one JSON line prefixed "RESULT ".

import { chromium } from "playwright";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";

const arg = (n, f = null) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : f; };
const input = arg("--input");
if (!input) { console.error("--input <file> required"); process.exit(2); }
const out = arg("--out", `/tmp/default-recipe-${Date.now()}.mp4`);
const base = process.env.TEST_WEB_URL ?? "http://127.0.0.1:5173";
const envFile = process.env.HASHEEMSTUDIO_ENV_FILE ?? "/etc/hasheemstudio/local.env";
const env = Object.fromEntries(readFileSync(envFile, "utf8").split("\n").filter((l) => l.trim() && !l.startsWith("#") && l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const gateway = `http://127.0.0.1:${env.API_GW_HTTP_PORT}`;
const admin = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const email = `default-recipe-${randomUUID()}@example.invalid`, password = `Dr1!${randomUUID()}`;
const created = await (await fetch(`${gateway}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password, email_confirm: true }) })).json();

const browser = await chromium.launch({ headless: true });
try {
  const page = await (await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(30_000);
  await page.goto(`${base}/login`);
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/app/upload");

  await page.goto(`${base}/`);
  const defaultChecked = await page.getByRole("radio", { name: /Platform-optimized/ }).isChecked();
  assert.equal(defaultChecked, true, "Platform-optimized must be preselected on the homepage");
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose video", exact: true }).click()]);
  await chooser.setFiles(input);
  await page.getByRole("heading", { name: "Your video is ready" }).waitFor({ timeout: 600_000 });
  assert.equal(new URL(page.url()).pathname, "/", "result must appear on the homepage");
  const badge = (await page.getByTestId("result-details").innerText()).replace(/\n+/g, " | ");
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 600_000 }), page.getByRole("button", { name: "Download video", exact: true }).click()]);
  await download.saveAs(out);
  assert.match(download.suggestedFilename(), /^hasheemstudio_\d{8}_\d{6}\.mp4$/);
  const bytes = readFileSync(out);
  const result = {
    input, inputBytes: statSync(input).size, resultBadge: badge, recipeDefaultChecked: defaultChecked,
    downloadedBytes: bytes.length, reductionPercent: Math.round((1 - bytes.length / statSync(input).size) * 1000) / 10,
    sha256: createHash("sha256").update(bytes).digest("hex"), savedTo: out,
  };
  console.log("RESULT " + JSON.stringify(result));
} finally {
  await browser.close();
  await fetch(`${gateway}/auth/v1/admin/users/${created.id}`, { method: "DELETE", headers: admin });
}
