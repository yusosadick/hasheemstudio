# MacBook workflow and Mac-to-VPS deployment

> Split from `docs/MASTER-PLAN-ORIGINAL.md` §19–20.

## Mac prerequisites

Git, an approved container runtime such as Docker Desktop or Colima, supported Node (target: active
LTS, Node 22 as pinned in `package.json` `engines`), pinned pnpm (`9.15.0`, see `packageManager`
field), SSH, and tools required by the chosen test runner. Apple Silicon support: build Linux
production images for the target architecture in CI; do not assume ARM binaries run on the x86_64
VPS (`169.58.72.101` is x86_64 per `docs/ENVIRONMENTS.md`).

## Fresh clone workflow (target interface — see `docs/STATUS.md` for what's implemented today)

```bash
git clone git@github.com:yusosadick/hasheemstudio.git
cd hasheemstudio
pnpm install --frozen-lockfile
pnpm doctor        # implemented: checks tooling + secret-file presence, prints no secrets
pnpm dev:up        # NOT YET IMPLEMENTED — see docs/STATUS.md
pnpm db:local:migrate   # NOT YET IMPLEMENTED
pnpm dev           # NOT YET IMPLEMENTED
```

`pnpm doctor` is real today and was verified on the VPS (`node scripts/ops/doctor.mjs`, all checks
passed 2026-09-16). The remaining tasks are required implementation interfaces per the master plan,
not commands that exist yet; each fails loudly with a clear message rather than pretending to work.
Local email must use a development inbox (e.g. Mailpit), never real customer mail.

## SSH configuration (example — no key installed by this doc)

```sshconfig
Host hasheemstudio-prod
  HostName 169.58.72.101
  User yuso
  IdentityFile ~/.ssh/hasheemstudio_deploy
  IdentitiesOnly yes
  StrictHostKeyChecking yes
```

Verify host fingerprint through a trusted channel before first connect. Prefer a dedicated
restricted deploy identity provisioned during Phase 2 setup; if `yuso` is required for initial
bootstrap, transition deployment to least privilege afterward. **Never set
`StrictHostKeyChecking=no`.** Remote public Postgres exposure is not required: use SSH and the
reviewed remote migration runner (`docs/MIGRATIONS.md`).

## Real migrations from Mac through VPS terminal

See `docs/MIGRATIONS.md` for the full `scripts/db/remote.mjs` specification and acceptance tests.
That interface is not yet implemented.

## Current status

- `git clone` + `pnpm install --frozen-lockfile` + `pnpm doctor` work today, verified directly on
  the VPS (which doubles as a stand-in for "a fresh machine" until this is tested from an actual
  external Mac).
- No local dev stack, no local migrations, no remote migration runner exist yet.
- No dedicated SSH deploy key has been generated for this project.
