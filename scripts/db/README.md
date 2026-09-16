# scripts/db

`remote.mjs` — the migration runner specified in `docs/MIGRATIONS.md`. Implements
`status`/`plan`/`apply`/`verify` against a real environment defined in `environments.json`,
connecting via the Supavisor session pooler (not the transaction pooler) so advisory locks hold
for the whole run.

```bash
node scripts/db/remote.mjs status --env local
node scripts/db/remote.mjs plan --env local --sha <PUSHED_COMMIT_SHA>
node scripts/db/remote.mjs apply --env local --sha <PUSHED_COMMIT_SHA>
node scripts/db/remote.mjs verify --env local --sha <PUSHED_COMMIT_SHA>
```

**Honest scope, see `docs/STATUS.md` for current evidence:** this currently runs ON the same VPS
the `local`/`staging` stack lives on, so there is no real SSH hop for those two environments yet —
the "real SSH-based staging migration from a separate client terminal" acceptance test in
`docs/MIGRATIONS.md` is not yet satisfied by this alone. `production` has no environment
provisioned and will refuse to run. Concurrent-invocation and checksum-drift tests described in
`docs/MIGRATIONS.md` have not been separately exercised yet either.
