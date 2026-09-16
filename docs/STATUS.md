# Status

> Living document. Update this at the end of every phase or work session. This is the first file
> any resuming agent should read after `CLAUDE.md`/`AGENTS.md`. See `docs/DECISIONS.md` for owner
> input items and `docs/IMPLEMENTATION-PLAN.md` for the fixed phase plan this tracks against.

**Last updated:** 2026-09-16, during initial Phase 0 session.

## Current phase: Phase 4 (upload-to-download vertical slice) is next unblocked work

Phase 0 gate: met in full. Phase 1: first-pass prototype done, **owner-approved** in this session.
Phase 2: dedicated Supabase+Redis stack running and verified, not yet publicly reachable (DNS
blocked). Phase 3: tenancy/RLS/migration-runner core done and verified with real tests, scoped
deliberately to exclude job/media tables (that's Phase 4/5's job). Details for each phase below.

### Phase 0 — done, with evidence

- **Read-only discovery performed directly on the target VPS** (`169.58.72.101`, host
  `vmi3464308`, user `yuso`). Findings recorded in `docs/ENVIRONMENTS.md`:
  - Confirmed shared host already running Coolify (owns 80/443 via Traefik), a dedicated Supabase
    stack for another product, and ~20 other unrelated services. None will be modified.
  - Confirmed no `hasheemstudio`-named Docker containers, networks, or volumes exist yet (clean
    slate for Phase 2).
  - Confirmed `hasheemstudio.com` DNS is delegated to Cloudflare NS but has no published records —
    recorded as a blocker in `docs/DECISIONS.md` item 1.
  - Confirmed SSH access to `github.com:yusosadick/hasheemstudio.git` works (read verified via
    `git ls-remote`, returned 0 refs — empty repo).
  - Confirmed Node 22.23.1 and Docker 29.6.2 available on the VPS; pnpm was not installed, so
    `pnpm@9.15.0` was installed globally via `npm install -g pnpm@9.15.0` (low-risk, reversible,
    scoped to running this project's own scripts — recorded per `AGENTS.md`).
- **Repository scaffold created** at `/home/yuso/hasheemstudio` per
  `docs/MASTER-PLAN-ORIGINAL.md` §17: `apps/{web,api,worker}`, `packages/{contracts,ui,config,media-recipes}`,
  `supabase/migrations`, `infra/{compose,k8s/base,k8s/overlays/{staging,production},ansible,monitoring}`,
  `scripts/{ops,db,verify}`, `tests/{unit,integration,security,e2e,load,fixtures/media}`,
  `.github/workflows`, `docs/adr`, `docs/evidence`.
- **Documentation split** from `docs/MASTER-PLAN-ORIGINAL.md` (retained in full) into `docs/PRD.md`,
  `docs/IMPLEMENTATION-PLAN.md`, `docs/DESIGN-SYSTEM.md`, `docs/ARCHITECTURE.md`,
  `docs/ENVIRONMENTS.md`, `docs/MACBOOK-TO-VPS.md`, `docs/MIGRATIONS.md`, `docs/CAPACITY.md`,
  `docs/SECURITY.md`, `docs/BACKUP-RESTORE.md`, `docs/DEPLOYMENT.md`, `docs/ROLLBACK.md`,
  `docs/RUNBOOKS.md`, `docs/DECISIONS.md`, `docs/adr/0001-0003`.
- `CLAUDE.md` and `AGENTS.md` written with working-commands list, boundaries, and evidence
  standard.
- `.gitignore`, `.env.example` (variable names only, no values), root `package.json` +
  `pnpm-workspace.yaml`, CI foundation (`.github/workflows/ci.yml` — install, `pnpm doctor`,
  gitleaks secret scan).
- `pnpm doctor` implemented for real and verified working on the VPS (not a stub):
  ```
  OK    node: v22.23.1
  OK    pnpm: 9.15.0
  OK    git: git version 2.43.0
  OK    docker: Docker version 29.6.2, build dfc4efb
  OK    ssh: OpenSSH_9.6p1 ...
  OK    .env.example present: found
  OK    .env (local secrets file): absent — copy .env.example to .env ...
  ```
- All other `package.json` scripts (`dev:up`, `dev`, `db:local:migrate`, `deploy:plan`, `deploy`,
  `verify:live`, `test:*`) deliberately point to `scripts/ops/not-implemented.mjs`, which fails
  loudly rather than faking success.

### First-push evidence

Pushed 2026-09-16 to `git@github.com:yusosadick/hasheemstudio.git`, branch `main` (new branch,
repo was empty before this).

```
local HEAD:            c2dfba00611dcc9a40683a5ab4b49d841461d918
remote refs/heads/main: c2dfba00611dcc9a40683a5ab4b49d841461d918
MATCH - push verified
```

Verified by `git ls-remote origin refs/heads/main` immediately after push, independent of the
`git push` command's own exit code. Manual secret-pattern grep (AWS keys, private key headers,
Stripe/Slack/GitHub/Google API key shapes) found nothing in the 51 committed files; automated
gitleaks scanning runs on every push going forward via `.github/workflows/ci.yml`.

### Phase 1 — done so far (with evidence)

- `packages/ui/src/tokens.css`: exact brand tokens (`#121212`/`#FDF8F0` background,
  `#1E1E1E`/`#F5F5EC` surface, `#E91E63` accent, `#FFC0CB` secondary, the specified pink→orange
  gradient) plus derived accessible foreground/muted/border/focus/success/warning/danger tokens
  for both themes, applied via CSS variables (no flash: theme set from `localStorage`/OS
  preference before first paint in `apps/web/index.html`).
- `apps/web`: real Vite + React + TypeScript + Tailwind app wired to those tokens
  (`apps/web/tailwind.config.ts` maps Tailwind color/spacing/radius utilities to the CSS
  variables). `npx tsc -b --noEmit` passes clean.
- Three prototype screens built: landing (`/`), upload wizard (`/prototypes/upload`), job
  result/verification report (`/prototypes/job-result`) — mobile nav, drag/drop upload area, real
  (hand-drawn, unlicensed-pack-free) SVG icon set, honest job-stage stepper with no fake
  percentages, a technical diff table that collapses to cards on phones, and an explicit
  "sampled decode check, not full verification" disclosure on the result page.
- Verified running: `pnpm --filter @hasheemstudio/web dev` served all three routes with HTTP 200
  on the VPS (127.0.0.1:5173) on 2026-09-16.
- Screenshots captured for real via Playwright (Chromium, already available in this environment)
  at 390/768/1440px in both dark and light theme, full page — 18 PNGs at
  `docs/evidence/phase1-design/`. Self-reviewed for clipping/contrast/collapse behaviour; see that
  directory's README for the review notes.

### Phase 1 — still open

- **Owner visual approval of the screenshots is not yet obtained.** This is the actual Phase 1
  gate per `docs/IMPLEMENTATION-PLAN.md` ("Visual approval status recorded") — building and
  screenshotting the prototype is necessary but not sufficient.
- No automated accessibility/contrast audit run yet (planned Phase 7, though a lightweight pass
  could move earlier).
- No component "stories"/visual regression baselines yet (`docs/IMPLEMENTATION-PLAN.md` Phase 1
  file list mentions "component stories/tests").
- No keyboard-navigation test pass recorded yet, only visual/structural review.

## Phase 2 — isolated infrastructure (in progress)

### Done, with evidence

- `infra/compose/docker-compose.yml`: dedicated `hasheemstudio` Compose project adapted from the
  current official `supabase/supabase` Docker reference (see `docs/adr/0004-envoy-gateway.md` for
  why it uses Envoy, not Kong, and why `realtime`/`functions` are excluded), plus a dedicated Redis
  service (ACL password, AOF persistence, `noeviction` policy). All container names prefixed
  `hasheemstudio-` and all published ports bound to `127.0.0.1` only, chosen to avoid every port
  already in use on this shared host (cross-checked against `docs/ENVIRONMENTS.md`'s port
  inventory).
- `scripts/ops/generate-supabase-secrets.mjs`: real, tested secret generator (Postgres password,
  JWT secret, HS256-signed `ANON_KEY`/`SERVICE_ROLE_KEY`, dashboard password, `SECRET_KEY_BASE`,
  `VAULT_ENC_KEY`, `PG_META_CRYPTO_KEY`, Redis password) — writes only to
  `/etc/hasheemstudio/<env>.env` at mode 600, refuses to overwrite without `--force`, never prints
  values. Run for `local` on 2026-09-16.
- **The stack was actually started and its health verified for real** (not just "container is
  up"): Auth health endpoint, Storage status endpoint, PostgREST OpenAPI schema (service-role) and
  a real anon-key query reaching Postgres (404 on a nonexistent table — proves the request passed
  gateway auth and hit PostgREST/DB, not a stub), a direct `psql` connection through the Supavisor
  pooler, and Redis `PING`/auth-rejection both confirmed. Full detail and exact commands in
  `docs/ENVIRONMENTS.md` "Dedicated hasheemstudio Compose stack".
- Hit and fixed one real bug during verification: the Redis healthcheck initially failed because
  `REDIS_PASSWORD` wasn't exported into the container's environment (only used at
  container-start-command time), causing the healthcheck's own `redis-cli` call to fail auth even
  though Redis itself was healthy — fixed by adding an explicit `environment:` block.
- **Confirmed zero regression** on the shared VPS: the other project's `supabase-*` stack,
  `coolify-proxy`, and `hasheem-web-*` containers were all still `healthy` after this stack came up.
- Vaultwarden-based secret retrieval script written (`scripts/ops/fetch-vaultwarden-secret.sh`) —
  writes directly into the target env file, never prints the secret value. Not yet run: needs the
  owner (or a separate terminal the owner controls) to run `bw unlock` and hand off a session key,
  per the plan agreed with the owner in this session — see `docs/DECISIONS.md` item 1/2.

### Phase 2 — still open

- Not reachable publicly: no DNS, no Coolify/Traefik route wired up yet (blocked on
  `docs/DECISIONS.md` item 1, and wiring the proxy is itself a deliberate next action once DNS
  exists — not done blindly).
- No dedicated least-privilege service user yet; the stack and `/etc/hasheemstudio/` currently run
  as `yuso`.
- No backup configured for this stack yet (`docs/BACKUP-RESTORE.md` still fully open).
- No object storage decision made yet (`docs/adr/0003-media-storage-path.md` still open) — Storage
  is running with the `file` backend for now, sufficient for Phase 2 connectivity verification, not
  a final decision.
- Resend SMTP not configured — `SMTP_PASS` is blank in the generated env, so Auth email sending
  will not work yet. This is expected and matches `docs/DECISIONS.md` item 2.

## Phase 3 — tenancy/RLS/migration runner core (done, scoped)

### Done, with evidence

- `supabase/migrations/0001-0003`: bootstrap identity marker, `profiles`/`workspaces`/
  `workspace_members` with RLS and a recursion-safe `SECURITY DEFINER` membership helper, an
  atomic registration trigger (profile + personal workspace + owner membership together), and
  `platform_admins` with RLS enabled and **zero** policies (no client-writable path exists at all).
- `scripts/db/remote.mjs`: real `status`/`plan`/`apply`/`verify` commands, tested against the live
  dedicated database (not a mock):
  - `status` before any migration existed correctly listed all 3 as pending.
  - `plan` correctly **refused** while the working tree was dirty.
  - After committing and pushing, `plan` passed clean against the real pushed SHA.
  - `apply` applied all 3 migrations in order, each wrapped with its ledger insert in one
    transaction.
  - `verify` did real introspection (`information_schema`, `pg_class.relrowsecurity`,
    `pg_policies`) confirming all 4 tables exist, RLS is enabled on all 4, and no
    pending/drifted migrations remain.
  - **Idempotency verified**: re-running `apply` against the fully-applied state returned
    `applied: []`, a true no-op.
  - **Checksum-drift detection verified**: temporarily appending a line to an already-applied
    migration file caused `plan` to correctly refuse with an explicit drift error (then reverted;
    working tree confirmed clean again).
- `tests/security/rls.cross-tenant.mjs`: real negative-test suite against the live stack — created
  two throwaway users via the GoTrue admin API, signed each in for a real access token, and
  confirmed via actual PostgREST requests: **7/7 checks passed** — registration trigger creates
  exactly one personal workspace per user; user A cannot read user B's workspace or profile
  (RLS silently filters, empty result); user A cannot insert themselves into user B's
  `workspace_members` (403); user A cannot self-promote into `platform_admins` (403). Test users
  cleaned up afterward.

### Explicitly out of scope for this pass (honest gaps)

- No `jobs`/`media_assets`/`upload_sessions`/`usage_*`/`outbox_*`/`audit_events`/
  `deletion_requests` tables yet — deferred to Phase 4/5 where they're actually needed, per
  `docs/IMPLEMENTATION-PLAN.md`'s own phase boundaries.
- **Not yet a true SSH-based remote migration**: this runner currently executes on the same VPS
  the target database runs on (there's only one environment, `local`, and it IS this VPS). The
  "real SSH-based staging migration from a separate client terminal" acceptance test in
  `docs/MIGRATIONS.md` is unmet until a genuinely separate client (e.g. an actual MacBook) runs
  this against `staging`.
- Concurrent-invocation test (two `apply` calls racing) not yet exercised.
- No `staging`/`production` environment provisioned — `scripts/db/environments.json` defines them,
  but their secrets files don't exist, so `remote.mjs` correctly refuses to target them.
- Generated TypeScript types from the migrated schema (`docs/IMPLEMENTATION-PLAN.md` Phase 3 gate:
  "Generated type definitions reflect migrated schema") — not done yet, no `packages/contracts`
  codegen wired up.

## Not started yet
- Phase 4 (upload-to-download vertical slice)
- Phase 5 (compatibility recipes, reliability)
- Phase 6 (Resend, admin, compliance UX)
- Phase 7 (performance, resilience, launch gate)
- Phase 8 (Kubernetes)
- Phase 9 (growth features)

### Open blockers (owner input needed — see `docs/DECISIONS.md` for full detail)

1. Cloudflare/DNS management access for `hasheemstudio.com` (NS confirmed on Cloudflare, no token
   available).
2. Resend account access / API key + an inbox for delivery verification.
3. Confirmed platform-owner email for admin bootstrap.
4. Approved off-host backup/object-storage provider, region, budget.
5. Whether dedicated production Kubernetes nodes exist or need budget approval.
6. Payment provider / commercial terms (not needed for P0 — checkout stays disabled regardless).
7. Final support/reply-to address.

None of these block Phase 0 completion or the safe portions of Phase 1–2 (design tokens, Compose
file authoring, dry-run validation). They block: real DNS/TLS, real email delivery, real off-host
backups, and Kubernetes production rollout specifically.

### P0/P1/P2 requirements checklist

Tracked at the phase level in `docs/IMPLEMENTATION-PLAN.md`; per-requirement checkboxes will be
added here once Phase 1+ implementation begins, to avoid a checklist that just restates the PRD
with no evidence behind it.

## Next unblocked task

1. Owner review of Phase 1 screenshots: **done, approved verbally in this session** ("looks fine
   from your description, keep going").
2. Owner-approved next step for credentials: retrieve `hasheemstudio-resend-api` and
   `hasheem studio DNS` from the owner's self-hosted Vaultwarden. Blocked on the owner (or a
   separate terminal they control) running `bw unlock` and handing off a `BW_SESSION` value via a
   file — **not** through this chat. See `scripts/ops/fetch-vaultwarden-secret.sh` and
   `docs/DECISIONS.md`.
3. Once those two secrets are in hand: wire Resend SMTP into `/etc/hasheemstudio/local.env` and
   re-verify Auth email sending; add the Cloudflare-provided DNS records (or hand the owner exact
   records to add manually) and begin Phase 2's public-ingress step.
4. Independently unblocked regardless of the above: start Phase 3 — write the first
   `supabase/migrations/*.sql` (schema from `docs/ARCHITECTURE.md` "Data model and RLS") and begin
   `scripts/db/remote.mjs`, now that there's a real dedicated database to migrate and verify against.
