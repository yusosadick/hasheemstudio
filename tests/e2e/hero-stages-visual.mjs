#!/usr/bin/env node
// Captures the homepage hero at each real pipeline stage (uploading with throttled network, processing, done)
// on desktop and a 390 px phone, and asserts the focus-mode layout: copy hidden, "Pause animations" centred
// above the card with clear space, scene reflecting the stage. Usage: TEST_WEB_URL=... node tests/e2e/hero-stages-visual.mjs --input <file>
import { chromium } from "playwright";
import assert from "node:assert/strict";
const arg = (n, f = null) => { const i = process.argv.indexOf(n); return i !== -1 ? process.argv[i + 1] : f; };
const input = arg("--input", "tests/fixtures/media/synthetic-remux-test.mov");
const base = process.env.TEST_WEB_URL ?? "http://127.0.0.1:5173";
const dir = "docs/evidence/result-ux";
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, vp] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    page.setDefaultTimeout(120_000);
    const cdp = await ctx.newCDPSession(page);
    await page.goto(base + "/");
    await page.screenshot({ path: `${dir}/${name}-0-idle.png` });
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 300, downloadThroughput: 200_000, uploadThroughput: 60_000 });
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Choose video", exact: true }).click()]);
    await chooser.setFiles(input);
    await page.getByRole("progressbar").waitFor();
    await page.waitForFunction(() => document.querySelector(".conversion-scene")?.getAttribute("data-phase") === "upload");
    await page.waitForTimeout(1500);
    assert.equal(await page.locator(".conversion-hero__copy").count(), 0, "copy hidden once upload starts");
    assert.equal(await page.getByText("Prepare your video").count(), 0);
    const pause = await page.locator(".conversion-scene__pause").boundingBox();
    const card = await page.locator(".hero-upload").boundingBox();
    assert(pause && card && pause.y + pause.height + 8 <= card.y, `pause must sit clear above the card (pause bottom ${pause && pause.y + pause.height}, card top ${card?.y})`);
    assert(Math.abs(pause.x + pause.width / 2 - (vp.width / 2)) < 6, "pause centred");
    await page.screenshot({ path: `${dir}/${name}-1-uploading.png` });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await page.getByRole("heading", { name: "Your video is ready" }).waitFor();
    await page.waitForTimeout(1600);
    assert.equal(await page.locator(".conversion-scene").getAttribute("data-phase"), "done");
    assert.equal(new URL(page.url()).pathname, "/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 0, `horizontal overflow ${overflow}`);
    await page.screenshot({ path: `${dir}/${name}-3-done.png`, fullPage: true });
    await ctx.close();
  }
  console.log("PASS hero stage visuals");
} finally { await browser.close(); }
