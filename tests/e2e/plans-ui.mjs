#!/usr/bin/env node
// Browser proof of the pricing UI and checkout states. The provider is NOT contacted: the three payment
// endpoints are mocked inside the browser, so this proves the UI, not Snippe. Real plan/entitlement/webhook
// logic is covered by tests/integration/studio-payments.mjs.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const base = process.env.TEST_WEB_URL ?? "http://127.0.0.1:5173";
const env = Object.fromEntries(readFileSync(process.env.HASHEEMSTUDIO_ENV_FILE ?? "/etc/hasheemstudio/local.env", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const gw = `http://127.0.0.1:${env.API_GW_HTTP_PORT}`;
const admin = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const email = `plans-${randomUUID()}@example.invalid`, password = `Pl1!${randomUUID()}`;
const user = await (await fetch(`${gw}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
const dir = "docs/evidence/plans-ui"; mkdirSync(dir, { recursive: true });
const catalogue = (available) => ({ available, currency: "TZS", free: { videosPerDay: 1 }, plans: [{ code: "weekly", name: "Weekly", amountTzs: 5000, days: 7, videos: 20 }, { code: "monthly", name: "Monthly", amountTzs: 19900, days: 30, videos: 50 }] });
const browser = await chromium.launch({ headless: true });
try {
  for (const [name, vp] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
    // 1) Signed out, checkout not live (the real API state today): honest "Opening soon".
    const ctx = await browser.newContext({ viewport: vp }); const page = await ctx.newPage(); page.setDefaultTimeout(20000);
    await page.goto(base + "/"); await page.locator("#pricing").scrollIntoViewIfNeeded();
    const cards = page.locator(".plan-card"); assert.equal(await cards.count(), 3);
    const text = await page.locator("#pricing").innerText();
    for (const t of ["5,000", "19,900", "20", "50", "7 days", "30 days", "Most popular", "1 video a day"]) assert(text.includes(t), `pricing shows ${t}`);
    assert.equal(await page.getByRole("button", { name: "Opening soon" }).count(), 2);
    await page.locator("#pricing").screenshot({ path: `${dir}/${name}-pricing-not-live.png` });
    await ctx.close();

    // 2) Signed in, checkout live (mocked): pick monthly → pay → approve on phone → active.
    const c2 = await browser.newContext({ viewport: vp }); const p2 = await c2.newPage(); p2.setDefaultTimeout(20000);
    await p2.route("**/v1/payments/plans", (r) => r.fulfill({ json: catalogue(true) }));
    let polls = 0; let posted = null;
    await p2.route("**/v1/payments/entitlement", (r) => r.fulfill({ json: { free: { perDay: 1, usedToday: 1 }, paid: polls > 1 ? { videosRemaining: 50, videosTotal: 50, expiresAt: new Date(Date.now() + 30 * 864e5).toISOString(), planCodes: ["monthly"] } : null } }));
    await p2.route("**/v1/payments", async (r) => { if (r.request().method() === "POST") { posted = r.request().postDataJSON(); await r.fulfill({ status: 202, json: { id: randomUUID(), status: "pending" } }); } else await r.continue(); });
    await p2.route(/\/v1\/payments\/[0-9a-f-]{36}$/, (r) => { polls++; return r.fulfill({ json: { status: polls >= 2 ? "completed" : "pending" } }); });
    await p2.goto(base + "/login");
    await p2.getByRole("textbox", { name: "Email address" }).fill(email); await p2.getByRole("button", { name: "Continue", exact: true }).click();
    await p2.getByRole("textbox", { name: "Password", exact: true }).fill(password); await p2.getByRole("button", { name: "Sign in", exact: true }).click();
    await p2.waitForURL(base + "/");
    await p2.goto(base + "/"); await p2.locator("#pricing").scrollIntoViewIfNeeded();
    await p2.getByRole("button", { name: "Get Monthly" }).click();
    const dlg = p2.getByRole("dialog"); await dlg.waitFor();
    assert((await dlg.innerText()).includes("19,900 TSh"));
    await p2.waitForTimeout(450);
    await p2.screenshot({ path: `${dir}/${name}-checkout-form.png` });
    await dlg.getByLabel("First name").fill("Amina"); await dlg.getByLabel("Last name").fill("Test"); await dlg.getByLabel("Mobile money number").fill("255 712 345 678");
    await dlg.getByRole("button", { name: /Pay 19,900 TSh/ }).click();
    await dlg.getByText("Approve on your phone").waitFor();
    assert.deepEqual(posted, { planCode: "monthly", method: "mobile", phone: "255712345678", firstname: "Amina", lastname: "Test" });
    await p2.screenshot({ path: `${dir}/${name}-checkout-waiting.png` });
    await dlg.getByText("Monthly plan is active").waitFor({ timeout: 15000 });
    await p2.screenshot({ path: `${dir}/${name}-checkout-active.png` });
    await dlg.getByRole("button", { name: "Continue" }).click();
    await p2.getByText("50 of 50 videos left").waitFor();
    await p2.locator("#pricing").screenshot({ path: `${dir}/${name}-pricing-active.png` });
    await c2.close();
  }
  console.log("PASS plans UI");
} finally { await browser.close(); await fetch(`${gw}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: admin }); }
