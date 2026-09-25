#!/usr/bin/env node
// Navbar sign-out (in-place, no reload), legal pages, brand assets and per-page SEO tags.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const base = process.env.TEST_WEB_URL ?? "http://127.0.0.1:5173";
const env = Object.fromEntries(readFileSync(process.env.HASHEEMSTUDIO_ENV_FILE ?? "/etc/hasheemstudio/local.env", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const gw = `http://127.0.0.1:${env.API_GW_HTTP_PORT}`;
const admin = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
const email = `shell-${randomUUID()}@example.invalid`, password = `Sh1!${randomUUID()}`;
const user = await (await fetch(`${gw}/auth/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ email, password, email_confirm: true }) })).json();
const browser = await chromium.launch({ headless: true });
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  page.setDefaultTimeout(20000);
  await page.goto(base + "/login");
  await page.getByRole("textbox", { name: "Email address" }).fill(email); await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/app/upload");

  // Sign out from a private page: no reload, lands on home, navbar flips, session gone.
  await page.evaluate(() => { window.__marker = "same-document"; });
  await page.getByRole("button", { name: /Open profile menu for/ }).click();
  assert.equal(await page.getByRole("menuitem").count(), 1);
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL(base + "/");
  assert.equal(await page.evaluate(() => window.__marker), "same-document", "sign-out must not reload the page");
  await page.getByRole("link", { name: "Sign in" }).first().waitFor();
  assert.equal(await page.getByRole("button", { name: /Open profile menu for/ }).count(), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem("hasheemstudio-session")), null);

  // Brand + head
  await page.goto(base + "/");
  assert.match(await page.title(), /^Hasheem Studio \| Video Prep/);
  assert.equal(await page.locator('link[rel="icon"]').first().getAttribute("href"), "/favicon.ico");
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://hasheemstudio.com/");
  assert(await page.locator('script[type="application/ld+json"]').count() >= 1);
  assert.equal(await page.locator("footer a[href='/status']").count(), 0, "no /status link");
  for (const f of ["/favicon.ico", "/apple-touch-icon.png", "/images/brand/og-image.png", "/images/brand/logo-512.png", "/site.webmanifest", "/robots.txt", "/sitemap.xml"]) assert.equal((await page.request.get(base + f)).status(), 200, f);

  // Legal pages: full content, unique title/canonical, no duplicate description tags.
  for (const [path, title, must] of [["/privacy", "Privacy Policy", ["How long we keep data", "deleted automatically", "Snippe", "Your rights"]], ["/terms", "Terms of Service", ["Acceptable use", "Payments and refunds", "Limitation of liability", "Governing law"]]]) {
    await page.goto(base + path);
    await page.getByRole("heading", { level: 1, name: title }).waitFor();
    assert.equal(await page.title(), `${title} | Hasheem Studio`);
    assert.equal(await page.locator('link[rel="canonical"]').count(), 1);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), base.replace(/.*/, "https://hasheemstudio.com") + path);
    assert.equal(await page.locator('meta[name="description"]').count(), 1, "one description tag");
    const text = await page.locator("article").innerText();
    assert(text.length > 6000, `${path} is substantial (${text.length} chars)`);
    for (const m of must) assert(text.toLowerCase().includes(m.toLowerCase()), `${path} mentions ${m}`);
  }
  // Unknown page renders the 404 view and is noindex
  await page.goto(base + "/status"); await page.getByRole("heading", { name: "This page doesn’t exist" }).waitFor();
  assert.equal(await page.locator('meta[name="robots"]').getAttribute("content"), "noindex, nofollow");
  console.log("PASS site shell: sign-out, legal pages, brand assets, SEO head");
} finally { await browser.close(); await fetch(`${gw}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: admin }); }
