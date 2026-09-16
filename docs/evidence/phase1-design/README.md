# Phase 1 design evidence

Screenshots captured 2026-09-16 via Playwright against the real `apps/web` Vite dev server
(`pnpm --filter @hasheemstudio/web dev`, not a static mockup), for three prototype routes:

- `/` — landing page
- `/prototypes/upload` — upload wizard prototype (static, not wired to a real upload)
- `/prototypes/job-result` — job result / verification report prototype (static sample data)

Each route captured at 390px, 768px and 1440px viewport widths, in both `dark` and `light` theme
(`data-theme` attribute set directly, same mechanism the real theme toggle uses), full page.

File naming: `<page>-<theme>-<width>.png`.

## Review notes (self-review, not yet owner-approved)

- No clipping observed at any captured width.
- Technical comparison table (`/prototypes/job-result`) correctly collapses from a table (≥768px)
  to stacked cards (390px), per `docs/DESIGN-SYSTEM.md`.
- Job stage stepper truncates gracefully on narrow widths without overlapping text.
- Gradient CTA text uses `--color-foreground-on-accent` (#fff) for contrast; verified visually
  legible in both screenshots — a full automated contrast audit (axe/Lighthouse) is still a Phase 7
  deliverable, not done here.
- This is a first-pass visual prototype for the **owner approval gate** in
  `docs/DESIGN-SYSTEM.md` — it has not yet been reviewed/approved by the owner. Do not treat as
  final.
