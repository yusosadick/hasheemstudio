# Phase 4 browser end-to-end evidence

`job-complete.png` — full-page screenshot captured by
`tests/e2e/browser-upload-to-download.mjs` (real Playwright/Chromium run against the live stack,
2026-09-16), showing the real rendered `/app/jobs/:id` page after a real upload → real worker
processing → real verification: "Job complete", "Remux only — no re-encode", the real verification
report JSON (real checksums, real decode-check result), and a real "Download output" button that
returns real bytes when fetched. See `docs/STATUS.md` Phase 4 for the full check-by-check
evidence.
