# SEO, indexing and brand assets

**Canonical origin:** `https://hasheemstudio.com`. Public, indexable URLs: `/`, `/privacy`, `/terms`.

## What is implemented
- `apps/web/index.html`: title, description, canonical, robots (`max-image-preview:large`), Open Graph + Twitter card (1200x630 `og-image.jpg`), icons (`favicon.ico` 16/32/48, `favicon-*.png`, `apple-touch-icon.png`; manifest icons are WebP), `site.webmanifest`, JSON-LD (`Organization` with logo, `WebSite`, `SoftwareApplication` with author), and a `<noscript>` summary.
- `apps/web/scripts/seo-prerender.mjs` (runs in `pnpm build`): writes static `privacy/index.html`, `terms/index.html` with their own head tags, breadcrumb JSON-LD and the **full legal text**, and a `noindex` `404.html`. The React app replaces the body on load, so users see the normal app while crawlers get full content without JavaScript.
- `apps/web/nginx.conf`: unknown URLs return a real **404** (with the noindex page) instead of a 200 duplicate; app/auth routes return `X-Robots-Tag: noindex, nofollow`; manifest gets `application/manifest+json`; hashed assets are immutable.
- `robots.txt`: allows public pages; disallows `/app/` and auth pages; declares the sitemap. `sitemap.xml`: the three public URLs with `lastmod` (bump `lastmod` in `public/sitemap.xml` when the pages change materially).
- `PageSEO` updates the existing tags (no duplicates) and restores them on unmount; auth pages are `noindex`.
- `/status` was removed (no such page existed; it would have rendered the app shell).

## Google Search Console (owner action; needs your Google account)
1. Add property `https://hasheemstudio.com` (or Domain property `hasheemstudio.com`).
2. Verify: for a Domain property add the TXT record Google shows in DNS; for a URL-prefix property add the `<meta name="google-site-verification" content="…">` tag to `apps/web/index.html` (and prerender picks it up), then redeploy.
3. Submit `https://hasheemstudio.com/sitemap.xml`; use URL Inspection on `/` to request indexing.
4. Check Enhancements: Logo/Organization and Breadcrumbs should validate. The logo is `images/brand/logo-512.webp` (square, >112 px, as Google requires); favicon is a multiple of 48 px.

The verification token comes from Google and cannot be generated here; nothing has been submitted to Search Console.
