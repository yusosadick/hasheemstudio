// Post-build SEO step. The app is a client-rendered SPA, so crawlers (and link previews) would otherwise see the
// same <head> and an empty body for every URL. This writes real static HTML for the public pages, with their own
// title/description/canonical/JSON-LD and the full legal text, plus a noindex 404 page. React replaces the static
// body on load, so users see the normal app; crawlers get complete content without running JavaScript.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LEGAL, SUPPORT_EMAIL } from "../src/content/legal.mjs";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const SITE = "https://hasheemstudio.com";
const base = readFileSync(join(dist, "index.html"), "utf8");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function setMeta(html, attr, name, content) {
  const re = new RegExp(`<meta\\s[^>]*?${attr}="${name}"[^>]*?>`, "i");
  if (!re.test(html)) throw new Error(`seo-prerender: <meta ${attr}="${name}"> not found in index.html`);
  return html.replace(re, `<meta ${attr}="${name}" content="${esc(content)}" />`);
}
function setHead(html, { title, description, path, robots }) {
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  out = setMeta(out, "name", "description", description);
  out = setMeta(out, "property", "og:title", title);
  out = setMeta(out, "property", "og:description", description);
  out = setMeta(out, "property", "og:url", `${SITE}${path}`);
  out = setMeta(out, "name", "twitter:title", title);
  out = setMeta(out, "name", "twitter:description", description);
  if (robots) out = setMeta(out, "name", "robots", robots);
  out = out.replace(/<link rel="canonical"[^>]*>/i, path ? `<link rel="canonical" href="${SITE}${path}" />` : "");
  return out;
}
const linkify = (t) => esc(t).split(esc(SUPPORT_EMAIL)).join(`<a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a>`);
function docHtml(doc) {
  const blocks = (b) => (typeof b === "string" ? `<p>${linkify(b)}</p>` : `<ul>${b.list.map((li) => `<li>${linkify(li)}</li>`).join("")}</ul>`);
  return `<main style="max-width:760px;margin:0 auto;padding:48px 20px;font-family:system-ui,sans-serif;line-height:1.7;color:#ddd">
<p><a href="/">Hasheem Studio</a></p><h1>${esc(doc.title)}</h1><p>Last updated: ${esc(doc.updated)}</p>
${doc.intro.map((p) => `<p>${linkify(p)}</p>`).join("\n")}
${doc.sections.map((s) => `<section id="${s.id}"><h2>${esc(s.title)}</h2>${s.body.map(blocks).join("")}</section>`).join("\n")}
<p><a href="/privacy">Privacy Policy</a> · <a href="/terms">Terms of Service</a></p></main>`;
}
function write(rel, html) {
  const file = join(dist, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  console.log(`seo-prerender: wrote ${rel} (${html.length} bytes)`);
}

for (const kind of ["privacy", "terms"]) {
  const doc = LEGAL[kind];
  const path = `/${kind}`;
  let html = setHead(base, { title: `${doc.title} | Hasheem Studio`, description: doc.description, path });
  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", name: `${doc.title} | Hasheem Studio`, description: doc.description, url: SITE + path, inLanguage: "en", isPartOf: { "@id": `${SITE}/#website` } },
    { "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: doc.title, item: SITE + path },
    ] },
  ] };
  html = html.replace("</head>", `<script type="application/ld+json">${JSON.stringify(ld)}</script></head>`);
  html = html.replace('<div id="root"></div>', `<div id="root">${docHtml(doc)}</div>`);
  write(`${kind}/index.html`, html);
}

let notFound = setHead(base, { title: "Page not found | Hasheem Studio", description: "This page doesn't exist on Hasheem Studio.", path: "", robots: "noindex, nofollow" });
notFound = notFound.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, "");
write("404.html", notFound);
