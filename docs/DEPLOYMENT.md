# Deployment and GitHub workflow

> Split from `docs/MASTER-PLAN-ORIGINAL.md` §21. Updated 2026-09-17 with the real least-privilege
> deploy identity mechanism (tested) and current honest status.

- Inspect existing repo before writing; empty remote gets an initial main branch, existing repo gets a scoped branch/PR. Never force-push.
- First commit: docs, CLAUDE/AGENTS, workspace scaffold, ignores, env examples and CI foundation. Scan for secrets. Push to `git@github.com:yusosadick/hasheemstudio.git` and compare local HEAD with remote branch SHA. Record proof. If push access fails, stop deployment and resolve repository access.
- Feature branches, required lint/typecheck/tests/security checks and small commits.
- CI builds/tests images, emits SBOM, scans dependencies/images and pushes immutable digests. Never run untrusted pull-request code on the production host runner.
- Staging deployment first; approved DB migrations then compatible application rollout; public health and browser smoke checks; production uses protected approval and release artifact.
- No image tagged only `latest`. Store previous image digest, config version and schema compatibility for rollback. Distinguish readiness rollback from data restore.
- Before/after external health probes include Hasheem Studio and approved neighbouring apps to detect collateral impact. Never load-test unrelated apps.

## Least-privilege deploy identity (tested 2026-09-17)

`scripts/ops/deploy-ssh-wrapper.sh` is a forced-command SSH wrapper: installed as the `command=`
restriction on a dedicated deploy key's `authorized_keys` entry, it runs INSTEAD OF whatever the
connecting client asks for, allowlisting an exact set of safe operations and refusing everything
else — no interactive shell, no arbitrary commands, and `production` migrations are not reachable
through this key **at all** (only `local`/`staging`, and only `status`/`plan`/`apply`/`verify` with
a strictly-regex-validated SHA argument).

**This was tested for real**, not just written: a temporary throwaway keypair was generated,
its public half added to `authorized_keys` with the restriction, exercised, and then fully
removed:
- An allowed command (`node scripts/db/remote.mjs status --env local`) worked.
- A disallowed command (`rm -rf /`) was refused.
- An interactive shell attempt (bare `ssh ...` with no command) was refused — no PTY, no shell.
- A command-injection-style crafted argument (`--sha $(rm -rf /tmp/pwned)`) was refused by the
  strict hex-only regex check.
- An attempt to target `production` was refused — that environment isn't in the allowlist at all.

### Setting up the real deploy key (owner action required)

**The private key must be generated ON the Mac that will use it — never generate a deploy
private key on the VPS and try to transport it elsewhere.** On the Mac:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/hasheemstudio_deploy -C "hasheemstudio-deploy-$(whoami)@$(hostname)"
cat ~/.ssh/hasheemstudio_deploy.pub
```

The **public** key (safe to share by any channel — it is not a secret) then needs one line added
to `/home/yuso/.ssh/authorized_keys` on the VPS:

```
command="/home/yuso/hasheemstudio/scripts/ops/deploy-ssh-wrapper.sh",restrict <paste the public key here>
```

Then add the matching entry to the Mac's `~/.ssh/config` (see `docs/MACBOOK-TO-VPS.md`):

```sshconfig
Host hasheemstudio-deploy
  HostName 169.58.72.101
  User yuso
  IdentityFile ~/.ssh/hasheemstudio_deploy
  IdentitiesOnly yes
  StrictHostKeyChecking yes
```

And verify it from the Mac:

```bash
ssh hasheemstudio-deploy "node scripts/db/remote.mjs status --env local"   # should work
ssh hasheemstudio-deploy "whoami"                                          # should be refused
```

**As of 2026-09-17, no real deploy key has been generated** — the mechanism above is built and
proven with a throwaway test key, not yet used for a real Mac. This is a deliberate, safe stopping
point: creating the real key requires the owner to run the `ssh-keygen` command on their own Mac.

## Task interfaces not yet built

`pnpm deploy:plan -- --env staging`, `pnpm deploy -- --env staging --sha <SHA>` and
`pnpm verify:live -- --env staging` (application deployment, as opposed to database migration)
remain not-implemented stubs — see `docs/STATUS.md`. The database-migration half of "deployment"
(`scripts/db/remote.mjs`) is real and tested; the application-container deployment half is not.

## Current status

No staging or production deployment exists yet — `apps/api` runs as a bare host process,
`apps/worker` runs in a sandboxed container, both currently started/managed manually rather than
through a `pnpm deploy` command. No DNS is configured (`docs/DECISIONS.md` item 1). See
`docs/STATUS.md` for the full phase-by-phase evidence.
