# Mac handoff — first real external verification

> This is the document the owner should have open before switching from the VPS session to a real
> MacBook. Its purpose is narrow: get the owner from a fresh Mac to a working local dev loop, and
> to the one thing that has never actually been tested — driving the real deploy/migration
> workflow from a genuine separate machine, not an on-VPS terminal relabeled as "external."
> Everything below was run and verified **on the VPS itself** as of 2026-09-18; nothing in this
> document has yet been run from an actual Mac. See "Unverified items" below for the exact list.

## 0. What's already live, so you don't need to set it up

`https://hasheemstudio.com` is publicly live right now (real DNS, real Let's Encrypt TLS, real
Resend-backed signup email — see `docs/STATUS.md` "Phase 7 — launch-readiness verification" for
the full evidence trail). You do **not** need a Mac to use the product. This document is about
**developing and deploying against it**, and about finishing the one PRD gate that specifically
requires a second, physically separate machine.

## 1. Prerequisites

- **Node 22** (active LTS — matches `package.json` `engines`).
- **pnpm 9.15.0** (matches `packageManager`): `corepack enable && corepack prepare pnpm@9.15.0 --activate`.
- **Docker Desktop or Colima** — only required if you run `pnpm dev:up` (the full local Supabase +
  Redis + worker stack). Not required just to browse the live site or read the repo.
- **git**, and SSH access you already use to reach the VPS (`169.58.72.101`, user `yuso`) — your
  own existing key is fine for this manual verification pass. (A separate, more restricted
  least-privilege deploy key exists for *automation* — see `docs/DEPLOYMENT.md` — but is not
  required for you personally to run these commands by hand.)
- **Apple Silicon note**: if you ever build a production image on the Mac to push to the VPS,
  target the VPS's architecture explicitly: `docker buildx build --platform linux/amd64 ...`. The
  VPS is x86_64 (confirmed in `docs/ENVIRONMENTS.md`); an ARM-built image will not run there.

## 2. Exact clone / checkout / install commands

```bash
git clone git@github.com:yusosadick/hasheemstudio.git
cd hasheemstudio
git checkout main
git log -1 --oneline   # should show the same commit as the VPS — cross-check against
                        # `git rev-parse HEAD` run on the VPS right before you switch
pnpm install --frozen-lockfile
pnpm doctor             # real check: tooling + secret-file presence, never prints secret values
```

## 3. Full local stack: `pnpm dev:up` and `pnpm dev`

Both are real, implemented commands (not stubs) as of 2026-09-17, tested from a genuine fresh
clone on this VPS (two real bugs were found and fixed doing that — see `docs/STATUS.md` Phase 7
Priority 4). They have **not yet** been run from an actual Mac.

```bash
pnpm dev:up              # brings up a dedicated Supabase + Redis + sandboxed-worker Compose
                          # stack, project name `hasheemstudio`; generates secrets on first run
                          # into /etc/hasheemstudio/local.env-equivalent for your machine.
                          # Safe to re-run.
pnpm db:local:migrate     # applies + verifies all migrations against that local stack
pnpm dev                  # runs apps/api (:8787) and apps/web (:5173) as bare host processes
                          # against the stack pnpm dev:up just started
```

Then open `http://127.0.0.1:5173` in a browser on the Mac. This is a **separate, fully local**
Hasheem Studio instance — it does not touch the VPS, the production database, or
`hasheemstudio.com` in any way.

**A real gotcha found on the VPS side, worth knowing before you hit it on the Mac too**: running
`pnpm dev:up` from a second checkout of this repo while a stack from a *first* checkout is already
running causes Docker Compose to see a different resolved config-file path for the same project
name and try to recreate shared containers. `dev-up.mjs` now guards against this and will refuse
with a clear error rather than doing it silently — see the comment at the top of
`scripts/ops/dev-up.mjs` if you ever hit that message.

## 4. `pnpm test` — what actually runs today (read this before assuming a green run means something)

**Honest gap**: `pnpm test` is currently defined as `pnpm -r --if-present test`, and no workspace
package (`apps/api`, `apps/web`, `apps/worker`, `packages/ui`) defines its own `test` script. So
`pnpm test` today silently does nothing and "succeeds" — **do not treat that as a real check.**
The commands that actually verify something are:

```bash
pnpm typecheck                    # real: tsc -b/--noEmit across every workspace package
pnpm test:integration             # real: crash-recovery, quota-race, retention, hostile-inputs,
                                   # account-deletion, backup-restore — against a running local
                                   # stack (run pnpm dev:up first)
pnpm test:e2e                     # real: upload/download, compat-encode, resumable-interruption
pnpm test:e2e:browser             # real: full Playwright browser journey (needs pnpm dev running)
pnpm test:a11y                    # real: axe-core WCAG scan + keyboard nav
pnpm test:load:api                # real: API latency percentiles
pnpm test:load:queue              # real: queue throughput (add --recipe compat_encode for the
                                   # H.264 path specifically, --jobs N to bound the run)
```

All of the above require Playwright's Chromium to be installed for the browser-driven ones
(`npx playwright install chromium` if `pnpm doctor` doesn't already confirm it).

## 5. SSH tunnel command for VPS preview

The Supabase gateway/Studio admin dashboard on the VPS is deliberately **not** publicly routed
(only `hasheemstudio.com`, `api.hasheemstudio.com` and `supabase.hasheemstudio.com`'s
auth/rest/storage paths are — see `docs/ENVIRONMENTS.md` "Ingress URLs"). To inspect it from your
Mac without exposing it publicly, tunnel the gateway's port over SSH:

```bash
ssh -N -L 58000:127.0.0.1:58000 yuso@169.58.72.101
```

Then open `http://127.0.0.1:58000` in a browser **on the Mac** — this reaches the real VPS gateway
(Studio dashboard, basic-auth protected) through the tunnel, not a copy. Studio dashboard
credentials (`DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD`) live in the protected env file on the VPS —
ask the owner for them out-of-band; they are never printed in chat, commits, or this document.

To instead preview the live production site itself, no tunnel is needed — it's just
`https://hasheemstudio.com` in any browser.

## 6. Unverified items — exact list, labelled honestly

These are real gaps, not hedging. Nothing below should be described as "done" until it has
actually been run from the Mac and the result recorded in `docs/STATUS.md` with evidence.

- [ ] **The entire external-Mac deploy/migration workflow.** `scripts/db/remote.mjs` and the
      forced-command SSH wrapper (`scripts/ops/deploy-ssh-wrapper.sh`) have only ever been
      exercised *from the VPS itself* (including with a throwaway key generated and destroyed on
      the VPS — see `docs/DEPLOYMENT.md`). A real separate machine running these commands against
      the VPS has never happened. This is the core gap this document exists to close.
- [ ] **`pnpm dev:up` / `pnpm dev` from a genuine Mac.** Tested only on the VPS from a fresh Linux
      clone. Mac-specific issues (Docker Desktop/Colima networking, Apple Silicon image
      architecture, filesystem case-sensitivity) have not been exercised.
- [ ] **Real inbox receipt of a Resend-sent confirmation email.** Provider acceptance (the SMTP
      transaction succeeding) is verified; actual inbox delivery is not yet independently confirmed
      — see `docs/STATUS.md` Phase 7 Priority 6 and item 2 in the checklist below.
- [ ] **Credential rotation completion.** `RESEND_API_KEY` and `CLOUDFLARE_API_TOKEN` are being
      rotated by the owner as of 2026-09-18 after an accidental transcript exposure in a prior
      session. Not yet confirmed re-provisioned as of this document.
- [ ] **Encode-recipe capacity at real (non-synthetic) file sizes/durations.** The H.264 benchmark
      run on the VPS used the one available small synthetic fixture — real user-sized files will
      behave differently; do not extrapolate the measured rate to a capacity claim.

## 7. Owner's first-test checklist on the Mac

Work through this in order. Each step should produce something you can point at (a command's real
output, a screenshot, a file) — not just "it seemed to work."

1. [ ] `ssh yuso@169.58.72.101 "cd hasheemstudio && git rev-parse HEAD"` — note the SHA.
2. [ ] On the Mac: clone the repo (§2 above), `git rev-parse HEAD`, confirm it matches step 1.
3. [ ] `pnpm doctor` on the Mac — confirm every check passes.
4. [ ] `node scripts/db/remote.mjs status --env staging` (or `--env local` if staging isn't
   provisioned yet) **from the Mac, over SSH to the VPS** — this is the first real external
   exercise of the remote migration runner. Record the raw output.
5. [ ] `pnpm dev:up && pnpm db:local:migrate && pnpm dev` on the Mac — confirm the local stack
   comes up and `http://127.0.0.1:5173` loads in a Mac browser.
6. [ ] Run the SSH tunnel command in §5, open `http://127.0.0.1:58000` on the Mac, confirm the
   Studio dashboard actually loads through the tunnel.
7. [ ] Open `https://hasheemstudio.com` directly in a Mac browser (no tunnel) — sign up with a
   real email you can check, confirm the "Check your email" state appears, and personally verify
   the confirmation email actually arrives in your inbox (this closes the one remaining email gap
   in §6 above — screenshot or forward the received email as evidence).
8. [ ] Click the confirmation link from that real email, confirm it lands you logged in on
   `https://hasheemstudio.com`, then run a real upload → process → download.
9. [ ] Record every result (pass/fail, raw command output, screenshots) in `docs/STATUS.md` under
   a new "Mac verification" entry, dated, with your machine's OS/arch noted.
10. [ ] Report back whichever of the items in §6 are now resolved vs. still open — do not mark
    launch-ready until all of them are.
