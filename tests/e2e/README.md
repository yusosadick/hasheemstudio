# tests/e2e

`upload-to-download.mjs` — real end-to-end test of the Phase 4 vertical slice against a live
environment: real user, real signed-URL upload, real worker processing, real downloaded+decoded
output, real cancellation, real quota enforcement. See `docs/STATUS.md` Phase 4 for the full
evidence and honest gaps (notably: driven by direct HTTP calls, not yet an actual browser UI).

```bash
node tests/e2e/upload-to-download.mjs --env local --fixture tests/fixtures/media/synthetic-remux-test.mov
```

Requires `apps/api` and `apps/worker` already running. A Playwright-driven version through
`apps/web`'s real UI (once that's wired to real auth/API, not the current static prototypes) is
the next step, not done yet.
