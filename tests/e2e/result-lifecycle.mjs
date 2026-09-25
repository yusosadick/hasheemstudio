#!/usr/bin/env node
// Guest flow on the homepage: the job id appears in the URL, a refresh (even mid-processing) restores the same
// video, the finished result carries a real ~5:00 countdown from the worker's retention, expiry flips the card
// without a reload, and an unknown ?job= link degrades to a clear message. Local run only (uses the local DB to fast-forward expiry).
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import pg from "pg";
const base = process.env.TEST_WEB_URL ?? "http://127.0.0.1:5173";
const env = Object.fromEntries(readFileSync(process.env.HASHEEMSTUDIO_ENV_FILE ?? "/etc/hasheemstudio/local.env", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const db = new pg.Client({ host: "127.0.0.1", port: Number(env.POSTGRES_PORT), user: "postgres.hasheemstudio", password: env.POSTGRES_PASSWORD, database: env.POSTGRES_DB });
await db.connect();
const hash = createHmac("sha256", env.JWT_SECRET).update("127.0.0.1").digest("hex");
await db.query("update guest_sessions set created_at = created_at - interval '2 days' where network_hash=$1 and created_at >= date_trunc('day', now() at time zone 'UTC')", [hash]);
const browser = await chromium.launch({ headless: true });
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.setDefaultTimeout(60000);
  await page.goto(base + "/");
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose video", exact: true }).click()]);
  await chooser.setFiles("tests/fixtures/media/synthetic-remux-test.mov");
  await page.waitForFunction(() => new URL(location.href).searchParams.get("job"));
  const jobId = new URL(page.url()).searchParams.get("job");
  assert.match(jobId, /^[0-9a-f-]{36}$/i, "job id is in the address bar as soon as the job exists");
  // accidental refresh while it is (probably still) processing
  await page.reload();
  await page.getByRole("heading", { name: "Your video is ready" }).waitFor({ timeout: 120000 });
  assert.equal(new URL(page.url()).searchParams.get("job"), jobId);
  // real countdown from the worker's 5-minute retention
  const label = await page.getByRole("timer").getAttribute("aria-label");
  const [, m, s] = /Available for (\d+):(\d{2})/.exec(label);
  const secs = Number(m) * 60 + Number(s);
  assert(secs <= 300 && secs >= 240, `countdown starts near 5:00, saw ${label}`);
  const row = (await db.query("select output_retain_until - updated_at as d from jobs where id=$1", [jobId])).rows[0];
  assert(row.d.minutes === 5 || (row.d.minutes === 4 && row.d.seconds >= 59), "worker set retention to 5 minutes");
  // fast-forward: 4 s left -> card flips to expired by itself
  await db.query("update jobs set output_retain_until = now() + interval '4 seconds' where id=$1", [jobId]);
  await page.reload();
  await page.getByRole("heading", { name: "Your video is ready" }).waitFor();
  await page.getByRole("heading", { name: "This video has expired" }).waitFor({ timeout: 20000 });
  assert.equal(await page.getByRole("button", { name: "Download video" }).count(), 0, "no download after expiry");
  await page.getByRole("button", { name: "Prepare again" }).click();
  await page.getByRole("button", { name: "Choose video", exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("job"), null, "URL is cleaned after starting over");
  // unknown / foreign link
  await page.goto(base + "/?job=00000000-0000-4000-8000-000000000000");
  await page.getByRole("alert").filter({ hasText: "couldn’t find that video" }).waitFor();
  console.log(`PASS result lifecycle: URL job id, refresh restore, countdown ${label}, live expiry, unknown link`);
} finally { await browser.close(); await db.end(); }
