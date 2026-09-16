# Design System

> Split from `docs/MASTER-PLAN-ORIGINAL.md` §5. Status of the approval gate is tracked in
> `docs/STATUS.md` (Phase 1).

## Exact brand tokens

| Token | Dark | Light |
|---|---|---|
| Background | `#121212` charcoal | `#FDF8F0` cream |
| Surface 1 | `#1E1E1E` | `#F5F5EC` beige |
| Surface 2 | `#2A2A2A` | derive a tested contrasting neutral |
| Accent | `#E91E63` crimson | same |
| Secondary | `#FFC0CB` bubblegum | same |
| Primary gradient | `linear-gradient(90deg, rgb(255, 0, 110) 0%, rgb(255, 107, 53) 100%)` | same |

Use semantic CSS variables with Tailwind mappings; both themes are first-class. Add accessible foreground, muted, border, focus, success, warning and danger tokens after contrast measurement. Preserving the brand colour does not justify unreadable small text on it. Use dark foreground or an accessible treatment where white-on-accent fails.

Token source of truth once implemented: `packages/ui/src/tokens.css`.

## Visual direction

Premium creative workstation, not a generic admin template. Large type hierarchy, calm spacing, deliberate media presentation, restrained gradient calls to action, clear controls. No gradient on every surface. No tiny social-style badges masquerading as icons. Real SVG icons from a licensed set, consistent stroke/size; accessible text labels for key actions.

- Self-host a licensed readable font such as Inter; limit font weights and payload.
- 4/8-point spacing rhythm, generous 24–32 px card padding where width permits.
- At least 16 px base reading text; 44 px comfortable touch targets.
- Strong focus rings, keyboard-only usability, reduced-motion support.
- Skeletons for actual loading, never fake dashboard data.
- Respect OS theme initially; save user preference without flash.
- Mobile navigation and upload controls must work at 360 px width.
- Technical tables collapse to readable cards on phones.
- Show compressed demo assets, lazy load noncritical media, respect data-saving preferences.
- Video comparison must remain usable without colour perception and without autoplay audio.

## Design approval gate

Before full application implementation, build realistic landing, upload wizard and job-result prototypes in both themes. Capture at 390, 768 and 1440 px. Review spacing, line length, contrast, icons and empty/error states. Obtain owner feedback before polishing all screens. Continue independent backend work while waiting; do not mistake code generation for visual approval.

**Current status:** first-pass prototype built and screenshotted, awaiting owner visual approval.

- Tokens implemented for real in `packages/ui/src/tokens.css`, consumed by `apps/web` via
  Tailwind CSS variable mapping (`apps/web/tailwind.config.ts`).
- Three prototype routes built in `apps/web`: landing (`/`), upload wizard
  (`/prototypes/upload`), job result/verification report (`/prototypes/job-result`).
- Screenshots captured at 390/768/1440px in both themes, full page, via Playwright against the
  real running dev server — see `docs/evidence/phase1-design/`.
- Self-review: no clipping, table→card collapse works, gradient CTA text contrast looks correct;
  no automated contrast/accessibility audit run yet (Phase 7).
- **Not yet done:** owner has not reviewed or approved these screenshots. Treat as a draft for
  review, not a finished design.
