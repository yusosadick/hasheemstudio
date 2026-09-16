# Rollback procedure

> Not yet exercised — this document states the intended procedure per
> `docs/MASTER-PLAN-ORIGINAL.md` §20–21. It will be updated with real evidence once a rollback
> rehearsal has actually been run (Phase 7 gate).

## Application rollback

- Every deployed image is addressed by immutable digest, never `latest`.
- The previous image digest, config version, and schema-compatibility marker are recorded at each
  deploy (mechanism to be implemented in `scripts/ops/` — see `docs/STATUS.md`).
- Rollback means redeploying the previous immutable digest, not `git revert` alone — the two can
  diverge if the build step is not perfectly reproducible.

## Database rollback

Rollback normally means **compatible application rollback plus a forward SQL fix**, not a
destructive down-migration — a destructive down migration can cause more harm than the original
issue. Use the expand → migrate/backfill → switch → contract pattern (`docs/MIGRATIONS.md`) so an
old application version keeps working during and after a schema expansion.

`db reset`, `DROP SCHEMA`, and migration-history repair in production are forbidden without a
separate, explicit, exceptional owner approval (see `CLAUDE.md` rule 5).

## Kubernetes rollback (Phase 8, pending)

Standard rollout undo (previous ReplicaSet / Deployment revision) plus verification that stateful
dependencies (Supabase/Postgres, object storage) remain compatible with the rolled-back version.
Not yet applicable — no Kubernetes production deployment exists.

## Current status

No deployment has occurred yet, so no rollback has been exercised. This procedure must be
rehearsed for real (with recorded timing and evidence) before it can be marked passed in
`docs/STATUS.md` — a written procedure is not proof it works.
