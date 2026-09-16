# apps/worker

TypeScript + BullMQ media worker. Real for the Phase 4 vertical slice: a transactional-outbox
dispatcher (`src/dispatcher.ts`), a stale-lease/undispatched-event reconciler (`src/reconciler.ts`),
claim-with-lease job processing (`src/processor.ts`), and pinned-at-runtime FFmpeg/FFprobe
invocation via argument arrays (`src/ffmpeg.ts`). Supports `inspect` and `remux` recipes;
`compat_encode` is rejected by the API for now (Phase 5).

```bash
node --import tsx/esm src/index.ts
```

Use `node --import tsx/esm` rather than `npx tsx` / `tsx` directly for anything you intend to kill
deterministically (e.g. crash-recovery testing) — the `tsx` CLI forks an internal child process,
so signalling only the CLI's own PID can leave the real worker running as an orphan; see
`tests/integration/worker-crash-recovery.mjs` for the test that found this.

**Known gaps** (see `docs/STATUS.md` Phase 4 for full detail): runs as a bare Node process on the
host, not yet containerized/sandboxed per `docs/SECURITY.md` (non-root, read-only rootfs, seccomp,
etc. — none of that is in place yet, this is real but not yet production-hardened); dispatcher and
reconciler poll rather than using LISTEN/NOTIFY; `compat_encode` (H.264/AAC re-encode) recipe not
implemented yet.
