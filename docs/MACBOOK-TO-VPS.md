# MacBook workflow and Mac-to-VPS deployment

> Split from `docs/MASTER-PLAN-ORIGINAL.md` §19–20. Updated 2026-09-17 with the now-real,
> tested-on-the-VPS commands. See "Honest gap" below for the one thing this hasn't been tested
> doing yet: invocation from an actual separate Mac, as opposed to on the VPS itself.

## Mac prerequisites

- Git, an approved container runtime (Docker Desktop or Colima) — only needed if you intend to run
  `infra/compose` locally, not for the remote-migration workflow below.
- Node 22 (active LTS, matching `package.json` `engines`).
- pnpm `9.15.0` (matching `packageManager`): `corepack enable && corepack prepare pnpm@9.15.0 --activate`.
- SSH, and a dedicated key for this project (see below — not yet generated as of 2026-09-17).
- Apple Silicon note: if you ever build a production image on a Mac, target `linux/amd64`
  explicitly (`docker buildx build --platform linux/amd64 ...`) — the VPS (`169.58.72.101`) is
  x86_64, confirmed via `docs/ENVIRONMENTS.md`; an ARM-built image will not run there.

## Fresh clone workflow

```bash
git clone git@github.com:yusosadick/hasheemstudio.git
cd hasheemstudio
pnpm install --frozen-lockfile
pnpm doctor        # real: checks tooling + secret-file presence, prints no secrets
```

`pnpm doctor` is real and passes on the VPS as of this writing. `pnpm dev:up` and `pnpm dev`
remain explicit not-implemented stubs — there is no single command yet that boots the whole local
stack (Supabase, Redis, worker, web, API) for a laptop developer; today, running the real stack
means either using `infra/compose/docker-compose.yml` directly (see `docs/DEPLOYMENT.md`) or
connecting to the already-running VPS environment via the remote workflow below.

## SSH configuration

```sshconfig
Host hasheemstudio-prod
  HostName 169.58.72.101
  User yuso
  IdentityFile ~/.ssh/hasheemstudio_deploy
  IdentitiesOnly yes
  StrictHostKeyChecking yes
```

**As of 2026-09-17, no dedicated `hasheemstudio_deploy` key exists.** The owner's own key
(`~/.ssh/id_ed25519` on the VPS, comment `vps-hermes`) has been used for bootstrap so far, per
`docs/ENVIRONMENTS.md`. Before real external Mac access, generate a dedicated least-privilege key
pair, add its public half to the VPS's `authorized_keys` (scoped to what deployment actually
needs), and verify the host fingerprint through a trusted channel (e.g. an existing session, not
blindly trusting first-connect). **Never set `StrictHostKeyChecking=no`.**

## Real migrations from a Mac through the VPS — commands and the one honest gap

`scripts/db/remote.mjs` is real, tested, and has applied 10 migrations against the live dedicated
database as of this writing (`docs/STATUS.md`), including a real dirty-tree rejection, a real
checksum-drift rejection, and a real idempotent no-op re-apply. The commands are:

```bash
# Read-only: resolves deployed DB, release and migration ledger
node scripts/db/remote.mjs status --env local
node scripts/db/remote.mjs plan --env local --sha <PUSHED_COMMIT_SHA>

# Applies on the actual dedicated database, then verifies live state
node scripts/db/remote.mjs apply --env local --sha <PUSHED_COMMIT_SHA>
node scripts/db/remote.mjs verify --env local --sha <PUSHED_COMMIT_SHA>
```

**Honest gap:** every one of the runs recorded in `docs/STATUS.md` executed *on the VPS itself*
(this agent's session runs there), connecting to the Supavisor pooler at `127.0.0.1:<port>` —
which is deliberately not exposed beyond loopback, per `docs/SECURITY.md` ("Postgres ... must not
be publicly exposed"). Run unmodified from an actual external MacBook, `127.0.0.1` resolves to the
Mac, not the VPS, and the connection will simply fail (correctly — this is the security boundary
working as intended, not a bug). To genuinely run this from a Mac, open an SSH tunnel first:

```bash
# In one terminal: forward the VPS's loopback-only Supavisor transaction-pooler port to your Mac.
# The exact port is in the protected env file (POOLER_PROXY_PORT_TRANSACTION) — read the port
# number only, never print the file's secret values over the connection.
ssh -N -L 6543:127.0.0.1:<POOLER_PROXY_PORT_TRANSACTION> hasheemstudio-prod

# In a second terminal, on your Mac, with the repo cloned:
WORKER_DB_HOST=127.0.0.1 WORKER_DB_PORT=6543 node scripts/db/remote.mjs status --env local
```

This has **not yet been exercised end-to-end from a real separate Mac** in this project — it's the
documented, ready-to-test procedure, not a claim that it's been proven. The `docs/IMPLEMENTATION-PLAN.md`
Phase 3 acceptance test ("a documented real SSH-based staging migration from a separate client
terminal") remains open until someone actually runs it from an external machine and the evidence is
recorded here.

For safety, the same script that runs on `local` will refuse `production` outright (no
`production.env` exists yet) and requires `--confirm hasheemstudio-production` even once it does —
see `docs/MIGRATIONS.md` for the full safety-check list (dirty tree, unpushed SHA, checksum drift,
advisory lock, transaction-per-migration).

## Running the real test suites from a Mac

Once the SSH tunnel above is in place and `HASHEEMSTUDIO_ENV_FILE`/`WORKER_DB_HOST` etc. point at
the tunneled ports (the same override mechanism `apps/worker` uses for its containerized
deployment — see `apps/worker/README.md`), the same `pnpm test:e2e` / `pnpm test:integration` /
`pnpm test:security` commands documented in `docs/STATUS.md` should work unmodified. This has the
same "not yet exercised from an actual external Mac" caveat as the migration runner above.

## Current status (2026-09-17)

- `git clone` + `pnpm install --frozen-lockfile` + `pnpm doctor` work today.
- `scripts/db/remote.mjs` is real and has applied 10 migrations live — but only ever invoked
  on-VPS so far; the SSH-tunnel path above is documented, not yet proven from a real external
  machine.
- No dedicated SSH deploy key exists yet — bootstrap has used the owner's own key.
- `pnpm dev:up` / `pnpm dev` (a one-command local stack) remain unimplemented.
