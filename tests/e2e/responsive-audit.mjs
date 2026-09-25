#!/usr/bin/env node
// Responsive audit + regression: for several phone/tablet viewports checks no horizontal overflow, that the upload
// card (idle) and the processing card (focus mode, throttled so it stays visible) fit inside the first screen
// without scrolling, and reports page height. Usage: TEST_WEB_URL=... node tests/e2e/responsive-audit.mjs [--shots dir]
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import pg from "pg";
const base = process.env.TEST_WEB_URL ?? "http://127.0.0.1:5173";
const i = process.argv.indexOf("--shots"); const shots = i > -1 ? process.argv[i + 1] : null; if (shots) mkdirSync(shots, { recursive: true });
const sizes = [["iphone-se", 375, 667], ["small-android", 360, 640], ["iphone-14", 390, 844], ["large-phone", 430, 932], ["tablet", 768, 1024]];
// Local runs only: the guest daily limit (3 sessions per network) would otherwise block later viewports.
async function resetLocalGuestLimit() {
  if (!/127\.0\.0\.1|localhost/.test(base)) return;
  const env = Object.fromEntries(readFileSync(process.env.HASHEEMSTUDIO_ENV_FILE ?? "/etc/hasheemstudio/local.env", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
  const hash = createHmac("sha256", env.JWT_SECRET).update("127.0.0.1").digest("hex");
  const c = new pg.Client({ host: "127.0.0.1", port: Number(env.POSTGRES_PORT), user: "postgres.hasheemstudio", password: env.POSTGRES_PASSWORD, database: env.POSTGRES_DB });
  await c.connect();
  await c.query("update guest_sessions set created_at = created_at - interval '2 days' where network_hash=$1 and created_at >= date_trunc('day', now() at time zone 'UTC')", [hash]);
  await c.end();
}
const browser = await chromium.launch();
let failed = 0;
for (const [name, w, h] of sizes) {
  await resetLocalGuestLimit();
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: w < 500, hasTouch: w < 500 });
  const page = await ctx.newPage(); page.setDefaultTimeout(30000);
  await page.goto(base + "/"); await page.waitForTimeout(600);
  const m = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const c = r(".hero-upload");
    return { overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, cardTop: Math.round(c.top), cardBottom: Math.round(c.bottom), pageH: document.documentElement.scrollHeight };
  });
  if (shots) await page.screenshot({ path: `${shots}/${name}-idle.png` });
  const idleFits = m.cardBottom <= h; // the whole idle card is visible on load
  // processing / focus mode
  const cdp = await ctx.newCDPSession(page); await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 100_000, uploadThroughput: 30_000 });
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose video", exact: true }).click()]);
  await chooser.setFiles("tests/fixtures/media/synthetic-remux-test.mov");
  await page.getByRole("progressbar").waitFor(); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(900);
  const f = await page.evaluate(() => { const c = document.querySelector(".hero-upload").getBoundingClientRect(); return { cardTop: Math.round(c.top), cardBottom: Math.round(c.bottom), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  if (shots) await page.screenshot({ path: `${shots}/${name}-processing.png` });
  const focusFits = f.cardBottom <= h;
  // finished result (guest sees the sign-in gate): let the upload finish, then measure again
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.getByRole("heading", { name: "Your video is ready" }).waitFor({ timeout: 120000 });
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { const c = document.querySelector(".hero-upload").getBoundingClientRect(); return { top: Math.round(c.top), bottom: Math.round(c.bottom), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  if (shots) await page.screenshot({ path: `${shots}/${name}-result.png` });
  const resultFits = r.bottom <= h + 8;
  const ok = m.overflow <= 0 && f.overflow <= 0 && r.overflow <= 0 && idleFits && focusFits && resultFits;
  if (!ok) failed++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name} ${w}x${h}: overflow ${m.overflow}/${f.overflow}px | idle card ${m.cardTop}-${m.cardBottom} ${idleFits ? "fits" : "CUT OFF"} | processing card ${f.cardTop}-${f.cardBottom} ${focusFits ? "fits" : "CUT OFF"} | result card ${r.top}-${r.bottom} ${resultFits ? "fits" : "CUT OFF"} | page ${m.pageH}px`);
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
