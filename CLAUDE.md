# CLAUDE.md — instructions for any Claude agent working in this repository

Read this file, `AGENTS.md`, and `docs/STATUS.md` before doing anything else. Then read whichever
`docs/*.md` file covers the area you're touching. Do not re-derive the plan from memory — the
authoritative source is `docs/MASTER-PLAN-ORIGINAL.md` and its split-out docs, not this file's summary.

## Non-negotiable rules

1. **This is a shared production VPS.** Hasheem Gaming, its dedicated Supabase stack, Coolify,
   monitoring, VPN, and other unrelated services run on this host. Never modify their containers,
   networks, volumes, databases, credentials, or the Traefik/Coolify proxy config. Never claim a
   port, network name, or Compose project name already in use — check first (`docker ps`,
   `docker network ls`) and use `hasheemstudio`-prefixed names only.
2. **New, dedicated resources only.** New Supabase project, new Postgres, new Redis, new buckets,
   new secrets. Never borrow another project's credentials, tables, or auth users.
3. **No local-only migration success claims.** A migration is only "done" after
   `scripts/db/remote.mjs verify` reads it back from the actual target database over SSH, per
   `docs/MIGRATIONS.md`. Local `supabase db reset` output proves nothing about staging/production.
4. **No shared-project secrets, ever.** Secrets live in protected files outside git (see
   `docs/ENVIRONMENTS.md`) or a secret manager — never in chat, commits, logs, screenshots, or ZIPs.
   `.env.example` documents variable *names* only.
5. **No destructive production actions** (`db reset`, `DROP SCHEMA`, volume deletion, force-push,
   firewall changes, proxy replacement) without a separate, explicit owner approval recorded in
   `docs/STATUS.md`.
6. **Proof before completion.** Every claimed-done acceptance criterion needs recorded evidence
   (command output, screenshot, live URL response, remote SHA) in `docs/evidence/` or `docs/STATUS.md`.
   "It compiles" or "the container is healthy" is not proof the feature works.
7. **Record blockers honestly.** If a credential, DNS access, budget approval, or hardware is
   missing, mark the acceptance criterion blocked in `docs/STATUS.md` with exactly what is needed —
   do not fabricate the missing piece or silently skip the requirement.

## Working commands

Real, tested commands as of the current state of this repo (see `docs/STATUS.md` for what's
actually implemented vs. still a stub):

```bash
pnpm install --frozen-lockfile
pnpm doctor            # checks local tooling + secret-file presence, prints no secret values
```

Commands listed in `package.json` that are not yet implemented deliberately fail with a clear
"not implemented" message (`scripts/ops/not-implemented.mjs`) instead of pretending to succeed.
Check `docs/STATUS.md` before assuming any command beyond the two above is real.

## Where things live

| Topic | Doc |
|---|---|
| Product requirements | `docs/PRD.md` |
| Phased delivery plan & gates | `docs/IMPLEMENTATION-PLAN.md` |
| Design tokens & system | `docs/DESIGN-SYSTEM.md` |
| Architecture & topology | `docs/ARCHITECTURE.md` |
| Environment inventory (nonsecret) | `docs/ENVIRONMENTS.md` |
| Local dev + Mac-to-VPS workflow | `docs/MACBOOK-TO-VPS.md` |
| Migration runner spec | `docs/MIGRATIONS.md` |
| Capacity model | `docs/CAPACITY.md` |
| Security & secrets | `docs/SECURITY.md` |
| Backup/restore | `docs/BACKUP-RESTORE.md` |
| Deployment workflow | `docs/DEPLOYMENT.md` |
| Rollback procedure | `docs/ROLLBACK.md` |
| Operational runbooks | `docs/RUNBOOKS.md` |
| **Current status & blockers** | `docs/STATUS.md` |
| Decisions log / owner-input items | `docs/DECISIONS.md` |
| ADRs | `docs/adr/` |

## Resuming after a context reset

Use the resume prompt in `docs/MASTER-PLAN-ORIGINAL.md` §26, or simply: read `CLAUDE.md`,
`AGENTS.md`, `docs/STATUS.md`, `docs/PRD.md`, `docs/ENVIRONMENTS.md`, run `git status` and check
the GitHub remote before editing anything, then resume the first incomplete unblocked phase.
