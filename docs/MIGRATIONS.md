# Migrations — remote runner specification

> Split from `docs/MASTER-PLAN-ORIGINAL.md` §20. **Not yet implemented.** `pnpm db:remote` and
> `scripts/db/remote.mjs` currently do not exist; do not run any command claiming to be this
> runner until it appears in `docs/STATUS.md` as built and tested.

## Required command contracts

```bash
# Read-only: resolves deployed DB, release and migration ledger
node scripts/db/remote.mjs status --env staging
node scripts/db/remote.mjs plan --env staging --sha <PUSHED_COMMIT_SHA>

# Applies on actual VPS staging database, then verifies live state
node scripts/db/remote.mjs apply --env staging --sha <PUSHED_COMMIT_SHA>
node scripts/db/remote.mjs verify --env staging --sha <PUSHED_COMMIT_SHA>

# Production plan and separately approved write
node scripts/db/remote.mjs plan --env production --sha <PUSHED_COMMIT_SHA>
node scripts/db/remote.mjs apply --env production --sha <PUSHED_COMMIT_SHA> --confirm hasheemstudio-production
node scripts/db/remote.mjs verify --env production --sha <PUSHED_COMMIT_SHA>
```

Reject placeholder SHAs, unpushed commits, dirty migration edits, unexpected DB identity and
ambiguous environment. Do not guess deployed container names from another project.

## Runner implementation requirements

1. Resolve exact SSH target from the nonsecret inventory (`docs/ENVIRONMENTS.md`) and verify
   connectivity without exposing secrets.
2. Fetch only the approved pushed commit on the VPS into a release-specific path; verify SHA equals
   the requested SHA. Do not run migration SQL from a mutable working tree or copy arbitrary local
   SQL directly into production.
3. Verify the dedicated Hasheem Studio database marker, current database, role, host/service
   identity, expected environment and migration ledger. An empty new database needs explicit
   bootstrap marker creation, not a guessed existing marker.
4. Compute an ordered migration checksum manifest; reject modifications to previously applied
   migrations.
5. Acquire a database-level advisory lock spanning the migration run using a session/direct
   connection, not a transaction pooler. Avoid separate `psql` invocations that release the lock
   before execution. Use one authoritative migration runner/ledger; do not combine incompatible
   histories.
6. Use pinned Supabase CLI custom-DB migration support only after confirming flags, transaction
   behaviour and self-hosted compatibility against the pinned CLI. Alternatively use a reviewed
   session-based SQL runner compatible with Supabase migration bookkeeping. Document the chosen
   implementation and test its ledger semantics.
7. Before production apply, establish backup/PITR health and restore evidence
   (`docs/BACKUP-RESTORE.md`). For destructive operations require a separate explicit owner
   approval, impact estimate and maintenance plan. Normal bootstrap approval is not approval for
   dropping future customer data.
8. Use a least-privilege dedicated migration role able to own required schema changes. Do not put
   database passwords in command arguments/logs/process listings. Resolve protected credentials on
   the VPS using appropriate env/file mechanisms (`docs/SECURITY.md`).
9. Transaction per compatible migration, `ON_ERROR_STOP` or equivalent, lock/statement timeout,
   fail-fast. Label nontransactional operations (e.g. concurrent indexes) explicitly with
   repair/retry procedures.
10. Use expand → migrate/backfill → switch → contract over separate compatible releases. Bounded
    backfills, not one huge lock-holding update.
11. After applying, read the live ledger, inspect actual tables/columns/indexes/RLS/functions and
    execute real API/RLS smoke tests with approved test accounts.
12. Return sanitised JSON with target environment, SHA, applied versions, schema digest,
    verification results, duration and exit status. Never declare success based only on exit code
    or local schema generation.
13. Retrying a fully applied release is a verified no-op. A failed partial migration must not be
    marked applied. Add concurrent-run and checksum-drift tests.
14. Production `db reset`, `drop schema`, volume deletion and migration-history repair are
    forbidden without explicit exceptional approval. Rollback normally means compatible application
    rollback plus forward SQL fix (`docs/ROLLBACK.md`); a destructive down migration can cause more
    harm.

## Acceptance tests (required before this is marked done)

Fresh local replay; upgrade populated staging; idempotent repeat; two concurrent invocations;
wrong-target rejection; missing-backup rejection; modified-history rejection; failed SQL handling;
direct live schema readback; RLS cross-tenant denial; old and new application versions working
during expansion. Include a documented real SSH-based staging migration from a separate client
terminal, not only an in-container test.

## Current status

Not implemented. No `supabase/migrations/*.sql` files exist yet (Phase 3). No dedicated Supabase
stack has been provisioned for this project (Phase 2). Building this runner before the dedicated
database exists would have nothing real to verify against.
