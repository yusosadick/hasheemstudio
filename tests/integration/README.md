# tests/integration

`worker-crash-recovery.mjs` — real test against a live environment: creates a job, force-kills the
worker process mid-flight, confirms the reconciler recovers it. See
`apps/worker/README.md` and `docs/STATUS.md` Phase 4 for what this found and fixed.

```bash
node tests/integration/worker-crash-recovery.mjs --fixture tests/fixtures/media/synthetic-remux-test.mov
```

Requires `apps/api` already running (it uses the real API to create the upload/job); starts and
stops its own worker process. Not yet covered here: concurrent-migration-run tests (see
`docs/MIGRATIONS.md`), duplicate-job-delivery-under-load tests.
