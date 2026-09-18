# Status

> Living document. Update this at the end of every phase or work session. This is the first file
> any resuming agent should read after `CLAUDE.md`/`AGENTS.md`. See `docs/DECISIONS.md` for owner
> input items and `docs/IMPLEMENTATION-PLAN.md` for the fixed phase plan this tracks against.

**Last updated:** 2026-09-16, during initial Phase 0 session.

**Updated again:** 2026-09-17, during a follow-on Phase 5 session (worker sandboxing, resumable
uploads, H.264 encode, real entitlements, retention). See the "Phase 5" section below for full
detail; this replaces the "Current phase" line further down, which is left as a historical marker
of where Phase 4 ended.

**Updated again:** 2026-09-17 (same day, follow-on Phase 7 session): measured load/capacity
testing, a real isolated backup/restore rehearsal, an accessibility audit with real fixes, working
local dev commands tested from a fresh clone (two real bugs found and fixed), a tested
least-privilege deploy identity, and a P0 account-deletion regression found and fixed. See "Phase 7
— launch-readiness verification" below.

**Updated again:** 2026-09-17 (same day, second follow-on session): Vaultwarden unlocked and
resynced by the owner, `RESEND_API_KEY`/`CLOUDFLARE_API_TOKEN` provisioned, DNS/TLS wired live for
`hasheemstudio.com`, `apps/api`/`apps/web` containerized for real production use, and a full real
browser journey (signup, login, upload, process, download) verified against the live public domain
— three real bugs found and fixed along the way (a signup email-verification-bypass bug, a missing
`JWT_SECRET` in the new API container, and a CORS-config leak into local dev). **Still open: real
inbox receipt of the confirmation email is not independently verified** (Gmail MCP needs
re-authentication), and **both freshly-provisioned secrets should be rotated** after an accidental
transcript exposure this session (not launch-ready until both are resolved). See Priority 6 under
"Phase 7 — launch-readiness verification" below for full detail.

**Updated again:** 2026-09-18 (follow-on session): credential rotation is in progress on the
owner's side (env file untouched this session, per explicit instruction); in the meantime, closed
out every independently unblocked gate — corrected a misattributed local-dev port-collision finding
(it was our own orphaned processes, not an unrelated project), ran a real H.264 encode-recipe load
benchmark, and wrote `docs/MAC-HANDOFF.md`, the ready-to-use runbook for the one still-genuinely-
unverified gate (a real external Mac exercising the deploy/migration workflow). See "Phase 7
continued — 2026-09-18 session" below for full detail.

## Current phase: Phase 5 (compatibility recipes, reliability, security hardening) — done, scoped, real

Phase 0 gate: met in full. Phase 1: first-pass prototype done, **owner-approved**. Phase 2:
dedicated Supabase+Redis+containerized-worker stack running and verified, not yet publicly
reachable (DNS blocked). Phase 3: tenancy/RLS/migration-runner core done and verified. Phase 4:
real upload-to-download vertical slice, verified through an actual browser. **Phase 5: worker
sandboxing, real resumable uploads, H.264 encode, real entitlements with atomic reservations, and
a retention sweeper — all done and verified with real tests against the live stack, detailed
below.** Remaining real blockers are exactly two: Resend (email) and DNS, both waiting on the same
owner Vaultwarden handoff — see `docs/DECISIONS.md`.

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

## Phase 4 — upload-to-download vertical slice (done, real, verified)

### Done, with evidence — this is the actual Phase 4 gate: "a real fixture uploaded through
### browser [see caveat], processed on VPS, downloaded and decoded"

- **Schema**: `supabase/migrations/0004-0006` — `upload_sessions`, `media_assets`, `jobs`,
  `job_attempts`, `job_events`, `verification_reports`, `outbox_events`. Applied and verified live
  the same way as Phase 3 (`scripts/db/remote.mjs apply`/`verify`, both clean).
- **`apps/api`** (Fastify + TypeScript, real code, typechecked clean): JWT auth
  (`src/jwt.ts`/`src/auth.ts`, hand-rolled HS256 verify matching the generator in
  `scripts/ops/generate-supabase-secrets.mjs`), server-side workspace membership checks (never
  trusts a client-submitted workspace ID), a Supabase Storage HTTP client using signed
  upload/download URLs, `POST /v1/uploads/sessions`, `POST /v1/uploads/sessions/:id/finalize`,
  `POST /v1/jobs`, `GET /v1/jobs/:id`, `DELETE /v1/jobs/:id` (cancel).
- **`apps/worker`** (BullMQ + TypeScript, real code, typechecked clean): a transactional-outbox
  dispatcher (`src/dispatcher.ts`), a lease-based claim with fencing (`src/processor.ts`), pinned
  FFmpeg/FFprobe invocation via argument arrays only (`src/ffmpeg.ts`), and — added after finding
  the gap during this pass — a **reconciler** (`src/reconciler.ts`) that repairs stale leases from
  a killed worker and redispatches stuck outbox events, per `docs/ARCHITECTURE.md`.
- **`tests/e2e/upload-to-download.mjs`**, run against the live stack, **13/13 checks passed**: real
  user → real signed-URL upload of a real self-generated fixture
  (`tests/fixtures/media/synthetic-remux-test.mov`, committed) → real finalize → real job creation
  → real BullMQ dispatch and worker processing (actual `ffmpeg`/`ffprobe` subprocesses) → real
  verification report (decode check, duration match, stream-unchanged confirmation, checksums) →
  real signed download URL → **downloaded file actually decodes with real video+audio streams and
  correct duration** → real cancellation that never later reports success → **real server-enforced
  daily quota** (hit an actual 429 after the configured limit, not just a documented limit).
- **`tests/integration/worker-crash-recovery.mjs`**, run against the live stack, **6/6 checks
  passed** after finding and fixing a real bug along the way (see below): a job is killed
  mid-processing (whole process, not just a wrapper — see bug note), confirmed dead, its lease
  force-expired (to avoid a 10-minute real-time wait — the only shortcut in this test), the worker
  restarted, and the **reconciler** genuinely requeues it (`job.lease_expired_requeued` event
  present, a real second `job_attempts` row created) and it completes successfully on retry — a
  killed worker leads to bounded recovery, not endless processing.
- **Real bug found and fixed during this pass**: the crash-recovery test initially showed 0/2
  false failures — investigation found `npx tsx` / `tsx <file>` forks an internal child process to
  run the actual code, so killing only the directly-spawned PID left the real worker running as an
  orphan that quietly finished the job normally. Fixed by spawning with
  `node --import tsx/esm src/index.ts` (single process, no forking) — documented in
  `apps/worker/README.md` so this doesn't get relearned later.

### Explicitly out of scope / honest gaps for this pass

- **"Through the browser" — now closed.** `apps/web` has real pages (`src/pages/Login.tsx`,
  `Signup.tsx`, `Upload.tsx`, `JobResult.tsx`, `src/lib/auth.ts`, `src/lib/api.ts`) wired to the
  real Supabase Auth and the real `apps/api`, with a route guard (`RequireAuth`) and CORS added to
  the API (`@fastify/cors`, explicit origin allowlist). `tests/e2e/browser-upload-to-download.mjs`
  drives this through real Playwright/Chromium: **8/8 checks passed** — real login through the
  rendered `/login` page, a real file dropped into the real file input, real navigation to a real
  job page, the real UI showing "Job complete" with the real verification report JSON rendered,
  a real download link that returns real bytes, and a screenshot at
  `docs/evidence/phase4-browser-e2e/job-complete.png`.
  - **One real, already-documented blocker found in the process**: public self-service `/signup`
    sends a real confirmation email via GoTrue, which fails with a real 500
    ("Error sending confirmation email") because Resend SMTP isn't configured yet
    (`docs/DECISIONS.md` item 2). Confirmed directly against the gateway, not assumed. The browser
    test works around this by signing in via `/login` with an admin-precreated, pre-confirmed user
    instead of driving public `/signup` — so the upload/processing/download journey is proven for
    real, while public signup-via-real-email remains correctly blocked until Resend is wired up.
- **Not resumable yet.** Only a single-shot signed-URL PUT was tested. `docs/PRD.md`'s "resumable
  uploads; interruption recovery" acceptance criterion is unmet.
- **Not containerized/sandboxed.** `apps/worker` runs `ffmpeg`/`ffprobe` as a direct subprocess of
  a bare Node process on the host — none of `docs/SECURITY.md`'s "non-root, dropped capabilities,
  read-only root filesystem, seccomp" worker sandboxing is in place. Fine for proving the pipeline
  works; not fine to expose to real untrusted user uploads yet.
- **Plan limits are hardcoded**, not read from a `plans`/`entitlements` table (which doesn't exist
  yet) — `MAX_UPLOAD_BYTES`/`MAX_JOBS_PER_DAY`/`MAX_ACTIVE_JOBS` constants in the API routes, values
  matched to `docs/PRD.md`'s Verified Free tier. No usage ledger/reservation settlement machinery
  yet (Phase 5).
- **Only `inspect` and `remux` recipes work.** `compat_encode` (H.264/AAC re-encode) is explicitly
  rejected by the API with a 400 — Phase 5.
- **No retention sweeper** (expiring old uploads/outputs) yet.
- **`apps/api` and `apps/worker` were run manually** at the time this paragraph was first written
  (plain `node`/`tsx` processes) — **`apps/worker` is now containerized** (see Phase 5 below);
  `apps/api` still runs as a bare host process, not yet under a process supervisor or in a
  container, and not started by any `pnpm dev` command — `pnpm dev:up`/`pnpm dev` remain explicit
  not-implemented stubs.
- Duplicated `env.ts`/`storage.ts` between `apps/api` and `apps/worker` — still true after Phase 5;
  flagged for consolidation into a shared package once the interface is stable.

## Phase 5 — compatibility recipes, reliability, security hardening (done, real, verified)

Everything below was built and verified against the live stack in this session, in this order,
re-running the full test suite after each change to catch regressions immediately. Full commit
history has the detailed evidence per change; this is the rollup.

### 1. Worker sandboxing (done)

- `apps/worker/Dockerfile` + `infra/compose/docker-compose.yml` "worker" service: non-root user,
  read-only root filesystem with `tmpfs` scratch/tmp, all Linux capabilities dropped,
  `no-new-privileges`, hard `pids_limit`/`mem_limit`/`cpus`, **no published ports at all**, and
  attached ONLY to a new `worker_internal` Docker network marked `internal: true` — it has no
  route to the internet. `db`/`redis`/`api-gw` are additionally attached to that same internal
  network so the worker can reach them by service name without ever touching the project's normal
  (internet-capable) network.
- `apps/worker/src/ffmpeg.ts` hardened: `-protocol_whitelist file` on every FFmpeg/FFprobe
  invocation (blocks SSRF via a crafted playlist/concat/HLS-style input regardless of the network
  isolation above), `-nostdin`, a per-job thread cap, a hard output-size ceiling, and a scratch-dir
  path containment check.
- **Verified**: the full e2e suite passes with the containerized worker actually processing real
  jobs (not just "container is healthy" — `tool_versions.worker` in the verification report shows
  `worker-1-<pid>`, confirming the container's own process handled it). `docs/evidence/` doesn't
  yet have a dedicated screenshot for this since it's infra, not UI — the passing test output *is*
  the evidence, reproducible via `pnpm test:e2e`.
- **Known remaining gap**: `apps/api` is not containerized yet, and neither service runs under a
  restart-supervising init system beyond Docker's own `restart: unless-stopped` for the worker.

### 2. Resumable uploads (done)

- Switched from a single-shot signed-PUT upload to real TUS 1.0.0 resumable uploads (Supabase
  Storage's native TUS support, confirmed via its own `OPTIONS` response). `apps/api` creates the
  TUS resource server-side (service-role); the client PATCHes chunks directly to storage using
  its own session — genuinely direct-to-storage, not proxied through the API.
- `supabase/migrations/0008`: `storage.objects` RLS policies scoping authenticated users to their
  own workspace-id-prefixed path — required so the browser can PATCH chunks authenticated as
  itself, not just via service-role bypass.
- **Verified** (`tests/e2e/resumable-upload-interruption.mjs`, 12/12): upload half a file,
  confirm a second tenant cannot write into the first tenant's in-progress upload (**RLS-enforced,
  403, not just application logic**) and that the rejected attempt didn't corrupt the offset,
  resume from the server's own reported offset (never a locally-cached one — verified in both the
  test and `apps/web/src/lib/upload.ts`), and confirm the finalized object is **byte-for-byte
  identical (SHA-256 match)** to the original file. Also verified: re-finalizing an
  already-completed session is rejected (409, not silently re-run), an over-plan-limit declared
  size is rejected (413) and the same limit is re-checked against the *actual* uploaded size at
  finalize time (not just the client's declared size), and an untouched session is left in
  'pending' with a real expiry for the retention sweeper.
- **Verified through the real browser too**: `apps/web/src/pages/Upload.tsx` +
  `src/lib/upload.ts` do the same chunked-PATCH-with-HEAD-resume flow; the resume-after-reload
  case (same file re-selected) resumes the existing session instead of opening a new one.
- **Known remaining gap**: no UI test for the actual "drop connection mid-upload in a real
  browser tab" case — the interruption/resume logic is proven at the protocol level and unit-level
  in the browser client, not yet via a Playwright network-throttling test.

### 3. H.264/AAC compatibility encode (done)

- `apps/worker/src/ffmpeg.ts` `compatEncode()`: H.264 high profile, `yuv420p`, AAC audio, no
  upscale by default (only a bounded downscale filter when requested). `apps/api` now accepts
  `compat_encode` as a real recipe (previously rejected with 400).
- **Verified** (`tests/e2e/compat-encode.mjs`, 8/8), deliberately using tools **independent of the
  worker's own self-report** — a fresh `ffprobe`/`ffmpeg` run against the downloaded file, not just
  trusting `verification_reports`: real H.264 video codec, real AAC audio codec, audio/video stream
  durations matching (sync check), and a full independent playback decode. The verification report
  itself honestly sets `frames_re_encoded: true` (distinct from remux's `false`) and
  `qualityMetric: "not_computed"` rather than fabricating an SSIM/VMAF score it doesn't compute.

### 4. Real entitlements, atomic usage reservations, and a real bug fix (done)

- `supabase/migrations/0007`: real `plans` (`verified_free`, `pro_beta`) and
  `workspace_entitlements` tables, replacing the Phase 4 hardcoded `MAX_UPLOAD_BYTES`/
  `MAX_JOBS_PER_DAY`/`MAX_ACTIVE_JOBS` constants. `usage_reservations` tracks one row per admitted
  job (`reserved` → `released` on refunded cancellation, or `settled` on completion/failure/
  non-refunded cancellation).
- **Found and fixed a real, pre-existing correctness bug**: three places (`uploads.ts` finalize,
  the Phase-4 `jobs.ts` cancel handler, `processor.ts`'s success commit) used
  `pool.query("begin")` directly on the connection pool instead of a dedicated client — under a
  pool this does not guarantee BEGIN/COMMIT and the statements between them share one backend
  connection, so the transaction boundary was not actually atomic under concurrency. Fixed all
  three with `pool.connect()` + one client for the whole transaction, and closed two TOCTOU gaps
  (job cancellation and worker success-publish now use row locking / a conditional `UPDATE ...
  WHERE status = ...` instead of a separate read-then-write).
- **Verified with a real concurrency test** (`tests/integration/quota-race.mjs`, 4/4): 20
  concurrent job-creation requests against a temporary 5-per-day test plan — **exactly 5 admitted,
  15 correctly rejected**, and the database (`usage_reservations`, `jobs`) agrees exactly with what
  the API told clients. This is the test that would have caught the bug above.
- **Known remaining gap**: only one plan can be assigned per workspace (no plan-change flow yet,
  no billing); the daily-quota window is a plain UTC calendar day, not a rolling 24h window.

### 5. Retention/expiry cleanup (done)

- `supabase/migrations/0010`: `jobs.output_retain_until`/`output_deleted_at`.
- `scripts/ops/retention-sweep.mjs` (also `pnpm ops:retention-sweep`): three independent sweeps —
  abandoned upload sessions (best-effort TUS termination, then marked `expired`), expired media
  assets with **no active job** referencing them (checked under a row lock that a concurrent
  job-creation attempt genuinely can't race past, via the same foreign-key lock Postgres already
  takes), and expired job outputs on terminal jobs. `apps/api`'s job-detail endpoint now checks
  `output_deleted_at` before offering a download link, so a swept output never produces a broken
  signed URL — it returns an honest `outputExpired` flag instead, which `apps/web` renders.
- **Verified** (`tests/integration/retention-sweep.mjs`, 13/13): a media asset past its retention
  window **with** an active job survives untouched (object included); one with **no** job is
  deleted (object included); an abandoned session is marked expired; a real succeeded job's output
  past its retention is deleted and the API correctly stops offering (and honestly flags) the
  link. Deliberately constructs the "active job" case by inserting the job directly via SQL rather
  than through the real API, after an earlier version raced the real containerized worker (which
  legitimately finished the job before the test's manipulation landed) and produced a misleading
  false failure — documented in the test itself.
- **Known remaining gap**: not yet scheduled (no cron/systemd timer wired up) — it's a real,
  tested script, run manually or via `pnpm ops:retention-sweep`; recurring execution is
  operational follow-up, see `docs/RUNBOOKS.md`.

### 6. Hostile-input testing (done)

- `tests/integration/hostile-media-inputs.mjs` (8/8): a truncated real video and a random-bytes
  file wearing a `.mov` extension both correctly finalize (the server can't know a file is hostile
  until it's actually probed) and then correctly end in a real `'failed'` job with a real
  `ffprobe` error (`moov atom not found` / `Invalid data found when processing input`) — never a
  fake success. The API and the worker container are both confirmed still healthy afterward.

### 7. Real bugs found and fixed this phase (rollup, see individual commits for detail)

1. The connection-pool transaction-atomicity bug above (§4) — the most significant one; directly
   enabled the quota-bypass race the user asked to be tested for.
2. `tsx`'s internal child-process forking left an orphaned worker alive after a "kill" in
   `tests/integration/worker-crash-recovery.mjs` (found in Phase 4, still relevant context here).
3. The same test raced the *containerized* worker once it existed — fixed by having the test
   `docker stop`/`docker start` the real container around its run.
4. A Redis healthcheck missing its own `REDIS_PASSWORD` env var (found in Phase 2, listed here only
   for completeness of "things a naive read of the compose file would miss").

### Items 6 and 7 (Resend, DNS) — still blocked, not bypassed

Confirmed directly against the live Auth service (not assumed): public self-service `/signup`
fails with a real 500 (`"Error sending confirmation email"`) because Resend SMTP isn't configured.
**No workaround was applied to make signup "look" like it works** — this remains an honest,
reported gap. Exact secret names and the safe Vaultwarden-based provisioning method are documented
in `docs/DECISIONS.md`. DNS is in the same state: Cloudflare NS confirmed, no token, no records
published, nothing configured. Both wait on the same owner action (a `bw unlock` handoff) — see
`docs/DECISIONS.md` for the exact steps.

## Phase 7 — launch-readiness verification (2026-09-17, this session)

Scope: every unfinished acceptance criterion from the PRD, not just the next phase number, per the
owner's explicit instruction. Six priorities, in the order given.

### Priority 1 — measured load/capacity testing

Real runs against the local `dev:up` stack (same sandboxed-worker/Postgres/Supavisor topology as
staging/production). Full write-up with all numbers: `docs/CAPACITY.md`. Evidence:
`docs/evidence/phase7-capacity/{api-latency-report.json,queue-throughput-remux-report.json}`.

- **API latency** (`GET /v1/jobs/:id`): p95 = 139ms at concurrency 10, 191ms at 25, **391ms at
  50 — fails the PRD's p95 < 300ms target** at the highest tested concurrency under real host
  contention (load ~31-33/12 cores). An earlier same-day run at lower contention (~26 load) met the
  target (p95=289ms). Both runs are real; reported honestly rather than keeping only the favorable
  one. Error rate 0% at every level.
- **Queue throughput** (remux recipe, one tenant per job to isolate from quota limits): 10/10
  succeeded, 0 failed. ~4,454 jobs/day at the current hard-coded `concurrency: 1` BullMQ setting.
  Worker CPU spikes to ~100-127% (one core) only while actively transcoding, near-0% between jobs —
  **confirms jobs run strictly serially**, and that CPU/memory headroom exists to raise
  concurrency, which is untested. This is a **documented, known bottleneck**
  (`apps/worker/src/queue.ts`), not a hardware ceiling.
- **Disclosed confound**: 4 long-running `certutil` processes from an unrelated security-sandbox
  project on this shared host consumed ~3 cores' worth of sustained background load throughout
  testing. Not touched (out of scope), but material to every number above — see `docs/CAPACITY.md`
  for full disclosure.
- **Gaps**: only the remux recipe was load-tested, not H.264 encode (PRD requires both,
  separately); no isolated-staging sustained/burst test was run (PRD calls for both a local
  measurement and a staging-scale one); disk IOPS and egress were not measured.

### Priority 2 — backup/restore rehearsal

Real `pg_dump` → AES-256-GCM encrypt → isolated throwaway Postgres container (own volume, not on
the `hasheemstudio` Docker network) → `pg_restore` → verification via real queries (not trusted
exit code, since `pg_restore` commonly exits non-zero on benign ownership warnings even on a fully
successful restore). **9/9 checks passed** on the latest run: backup exists, decrypted checksum
matches the manifest, restore target came up isolated, restored `auth.users`/workspaces/jobs row
counts are correct (15/15/7), a specific job's verification checksum matches the live DB exactly,
and RLS is enabled on 14 restored tables. Evidence:
`docs/evidence/phase7-backup-restore/restore-rehearsal-report.json`. Scripts:
`scripts/ops/backup-db.mjs`, `tests/integration/backup-restore-rehearsal.mjs` (also wired into
`pnpm test:integration`). **Scope note, stated in the report itself**: this covers the Postgres
database (auth, tenancy, jobs, verification checksums) only, not raw media bytes in Storage's file
backend, per `docs/BACKUP-RESTORE.md`'s documented short-retention-media-excluded policy — "media
integrity" here means checksummed metadata survives restore intact, not that original video bytes
are recoverable from this backup alone. Never touched production or replayed a live job during this
rehearsal — the restore target was a disposable container, torn down after verification.

### Priority 3 — accessibility and responsive testing

Automated `@axe-core/playwright` scans of landing/login/signup at 390px and 1440px, in both light
and dark theme, plus manual keyboard-only navigation (Tab through a full form, submit via Enter),
a computed-style focus-outline check, and a horizontal-overflow check at mobile width. Script:
`tests/e2e/accessibility.mjs` (`pnpm test:a11y`). Evidence + screenshots:
`docs/evidence/phase7-accessibility/`.

- **Found real WCAG 2.2 AA failures**: the `#E91E63` accent color measured 4.31:1 on the dark
  background and 4.11:1 on the light background — both below the 4.5:1 threshold required for the
  small (14px) "Step N" labels and links it was used on. **Fixed** by adding a dedicated
  `--color-accent-text` token (hue/saturation-preserved, lightness-adjusted: `#e8457b` dark =
  4.97:1, `#d51a59` light = 4.82:1 — both measured, not assumed) in `packages/ui/src/tokens.css`,
  applied only to small text/links; the original `--color-accent` is kept unchanged for icons,
  which only need the more lenient 3:1 non-text threshold.
  Result: **16/28 automated checks passing before the fix → 28/28 after**, across both themes and
  both viewport widths.
- Keyboard navigation, focus-visible outlines, and no horizontal overflow at 390px all verified
  directly, not just via the axe scan.

### Priority 4 — local development commands

`pnpm dev:up` (brings up the dedicated Supabase+Redis+sandboxed-worker Compose stack, generating
secrets on first run) and `pnpm dev` (runs `apps/api` + `apps/web` concurrently, prefixed stdio,
clean shutdown) are now real, implemented scripts
(`scripts/ops/{dev-up,dev,db-local-migrate}.mjs`), not stubs. **Tested against a genuine fresh
clone** of the repo into a separate directory — this is what surfaced two real bugs, both fixed:

1. Running `dev:up` from a second clone (different absolute path, same Compose project name)
   caused Docker Compose to see a different resolved compose-file path, decide the config had
   changed, and recreate shared containers (`hasheemstudio-pooler`, `hasheemstudio-worker`) —
   disruptively, mid-way through an unrelated load-test run. **Fixed**: `dev-up.mjs` now checks the
   `com.docker.compose.project.config_files` label on the existing `hasheemstudio-db` container and
   refuses to proceed if it doesn't match the current checkout, with an explanatory error.
2. That disruption exposed a second, independent bug: an unhandled `pg.Pool` `'error'` event (fired
   when the Supavisor pooler container restarts and drops an idle client) crashed the whole API/
   worker Node process instead of just logging it. **Fixed** in both `apps/api/src/db.ts` and
   `apps/worker/src/db.ts` with a `pool.on("error", ...)` handler.

`scripts/ops/doctor.mjs` checks node/pnpm/git/docker/ssh presence and `.env`/`.env.example`
presence without ever printing secret values. Prerequisites and full sequence documented in
`docs/MACBOOK-TO-VPS.md`.

### Priority 5 — least-privilege deployment identity

Built and tested for real, but **only from this VPS itself, using a throwaway keypair** —
generated, added to `authorized_keys` with a forced-command wrapper, exercised, then fully removed
(original `authorized_keys` restored from backup). The wrapper
(`scripts/ops/deploy-ssh-wrapper.sh`) uses `command=`+`restrict` in `authorized_keys` to allow only
an explicit allow-list: `git fetch`/`git pull`, and `node scripts/db/remote.mjs
{status,plan,apply,verify}` for `local`/`staging` with SHA-format validation, plus
`pnpm ops:retention-sweep` — everything else is refused. Exact Mac-side commands (key generation,
the `authorized_keys` line format, and verification steps) are documented in `docs/DEPLOYMENT.md`.
**Stated honestly, per explicit instruction not to relabel this: no real external Mac has exercised
this workflow yet.** This remains an unverified gap until a real MacBook runs the documented
commands against this VPS.

### Priority 6 — Resend / DNS / TLS

**Resolved 2026-09-17, in a follow-on same-day session, with one real open gap.** The owner
unlocked and freshly synced Vaultwarden and handed off a session file; both secrets
(`RESEND_API_KEY`, `CLOUDFLARE_API_TOKEN`) were retrieved via `scripts/ops/fetch-vaultwarden-secret.sh`
(a first attempt failed on a stale sync — fixed by the owner re-syncing) and the vault was
immediately re-locked and the session file deleted, per protocol. Full detail, evidence and the
exact bugs found while wiring this up: `docs/evidence/phase7-launch/public-launch-verification.json`
and `docs/DECISIONS.md` items 1–2. Summary:

- **DNS/TLS**: A records added for apex/`www`/`api`/`supabase`, all pointing at this host; real
  Let's Encrypt certificates issued via the existing shared `coolify-proxy` (Traefik), using a new,
  purely additive static config file — no pre-existing routing was touched. `https://hasheemstudio.com`
  is publicly live. See `docs/ENVIRONMENTS.md` "Ingress URLs" / "Public ingress wiring".
- **Resend**: wired into `SMTP_PASS`/GoTrue; a real public signup through the live browser at
  `https://hasheemstudio.com/signup` returns a real 200 with `confirmation_sent_at` populated and
  no SMTP error — **provider acceptance verified**, not assumed.
- **Real production containerization**: `apps/api` and `apps/web` (previously bare host
  processes/dev server only) now have real Dockerfiles and run as containers in
  `infra/compose/docker-compose.yml`, non-root, read-only rootfs, no published host ports —
  reachable only via the shared proxy's internal Docker network attachment.
- **Three real bugs found and fixed while wiring this up** (not found by code review — by actually
  running it against the live domain): (1) the frontend was treating an unconfirmed signup response
  as a logged-in session (a real email-verification-bypass bug, now fixed — see
  `apps/web/src/lib/auth.ts`/`Signup.tsx`); (2) the new `api` container was missing `JWT_SECRET`,
  making every authenticated route 500 (found via a real Playwright run against the live domain);
  (3) `CORS_ALLOWED_ORIGINS` was initially set via the shared env file, which would have silently
  broken local bare-host dev's CORS allowlist — fixed by hardcoding the production origins directly
  in the container's compose config instead.
- **Full real browser journey verified against `https://hasheemstudio.com`**: login → upload →
  process → download → verification report, 8/8 checks passed, 82,239 real downloaded bytes
  (`tests/e2e/browser-upload-to-download.mjs`, `WEB_URL=https://hasheemstudio.com`). Real public
  signup through the browser reaches a genuine "check your email" state, 4/4 checks passed.
- **Still open: real inbox receipt is not independently verified.** Provider acceptance (the SMTP
  transaction succeeding) is confirmed; whether the email actually lands in an inbox is not, because
  the Gmail MCP connector available in this environment needs re-authentication (`/mcp`) and two
  attempts this session both failed with "needs you to sign in again." The owner should either
  re-authenticate that connector or manually check
  `yuso.sadick+hasheemstudio-publicsignup-1789621992@gmail.com` (including spam) for the email sent
  at 2026-09-17T05:13:19Z. **This is the one remaining honest gap in an otherwise-verified item —
  do not treat provider acceptance as equivalent to inbox receipt.**
- **Security incident, disclosed immediately when it happened**: a raw `sed` edit (not the safe
  helper scripts) to `/etc/hasheemstudio/local.env` triggered the session harness's automatic
  file-diff notification, which printed the real values of `RESEND_API_KEY` and
  `CLOUDFLARE_API_TOKEN` into the conversation transcript. Not deliberate, but both values should be
  treated as exposed. **Recommend the owner rotate both credentials** and re-provision the new
  values through the same Vaultwarden flow.

### Regression found and fixed this session: account deletion (P0, affected 100% of users)

While cleaning up test accounts, `DELETE /auth/v1/admin/users/:id` returned a real 500
(`23503` FK violation). Root cause: `workspaces.created_by` and several other `created_by`/
`granted_by`/`assigned_by` foreign keys to `auth.users(id)` had no `ON DELETE` action at all. Since
every user gets a personal workspace at registration, **this broke account deletion for every
account on the platform**, not an edge case. Found the complete list of affected constraints via
`pg_constraint`/`confrelid` introspection rather than continued trial-and-error, and fixed in two
migrations: `supabase/migrations/0011_fix_deletion_cascades.sql` (workspaces, usage_reservations)
and `0012_fix_remaining_deletion_cascades.sql` (jobs, media_assets, upload_sessions → CASCADE;
platform_admins.granted_by, workspace_entitlements.assigned_by → SET NULL, since deleting the
grantor shouldn't delete the grant). Verified with a new regression test,
`tests/integration/account-deletion.mjs` (4/4 passing, wired into `pnpm test:integration`), and by
successfully cleaning up 103 accumulated test accounts afterward. **Known remaining gap**: several
earlier test scripts' own cleanup steps were silently failing all along, because they used
`fetch(...).catch(() => {})` without checking `res.ok` — `fetch()` doesn't reject on 4xx/5xx. Not
fully audited/fixed across every script; flagged here rather than left silent.

## Phase 7 continued — 2026-09-18 session (rotation in progress, remaining gates)

Owner reported both `RESEND_API_KEY` and `CLOUDFLARE_API_TOKEN` compromised (accidentally printed
into the 2026-09-17 session transcript — see that date's entry above) and started rotating both
through their provider dashboards. Per explicit instruction, **the protected env file was not
touched, read, or worked around this session** — Gate 1 (credential rotation) stays blocked on the
owner confirming the new values are provisioned. All other, independent gates were worked in the
meantime:

### Gate 2 — inbox receipt verification

Attempted Gmail MCP re-authentication again this session (`list_labels` call) — still returns
`"needs you to sign in again (run /mcp to re-authenticate)"`. `/mcp` is an interactive, client-side
command that only the owner can run in their own terminal; it cannot be invoked programmatically
from here. **Owner action needed**: either run `/mcp` to reauth the Gmail connector (so a future
session can check inbox receipt directly), or manually confirm receipt of the email already sent to
`yuso.sadick+hasheemstudio-publicsignup-1789621992@gmail.com` at 2026-09-17T05:13:19Z (check spam
too). Once new Resend credentials are confirmed provisioned (Gate 1), a **fresh** confirmation
email should be sent and checked, since the original test predates the rotation.

### Gate 3 — local dev port collision — corrected finding

**The 2026-09-17 write-up mis-identified this.** It attributed the port-8787 conflict to an
unrelated `ubuntu`-owned process matched by a loose `ps aux | grep` on the substring
`apps/api/src/server.ts`. Re-investigated properly this session using `ss -ltnp` (to find the
actual PID holding the port) cross-referenced with `/proc/<pid>/cwd` (to find its real working
directory) rather than a text grep that can match unrelated processes by coincidence:

```bash
ss -ltnp | grep -E ':5173|:8787'                 # find the PID actually holding the port
readlink /proc/<PID>/cwd                          # confirm whose process it really is
```

The real cause: **two of our own orphaned bare-host dev processes**, left running since
2026-09-17T03:11 and T03:13 (`node --import tsx/esm src/index.ts` under
`/home/yuso/hasheemstudio/apps/api`, and Vite under `/home/yuso/hasheemstudio/apps/web`) from
earlier local-dev-command testing in the prior session — never stopped afterward. Not a conflict
with any other project at all. **Fix applied**: `kill -TERM` on both PIDs; verified with `ss -ltnp`
that both `127.0.0.1:8787` and `127.0.0.1:5173` freed immediately, then smoke-tested `pnpm dev`
end-to-end (both ports bound cleanly, API and Vite both started) before stopping it again the same
way to avoid recreating the same problem for the next session. Separately confirmed real, unrelated
`wazuh-indexer`-owned processes (uid 999) do coincidentally contain the substring `src/index.ts` in
their command line (from an unrelated `pentester`/Strix security-sandbox project already disclosed
in `docs/CAPACITY.md`'s contention note) — these were checked and confirmed to hold neither port,
and were left untouched.

**Lesson for future sessions, recorded so it isn't repeated**: always stop bare-host dev processes
started for local testing (`kill` the PIDs, or prefer a bounded `timeout N pnpm dev` for smoke
tests) — don't leave them running across a session boundary, and identify port holders by PID/cwd
ownership, never by a text-matching `ps|grep`, which can misattribute a coincidental substring
match to the wrong process.

### Gate 4 — H.264 encode-recipe load benchmark

Run via a temporary bare-host `apps/api` process (started, benchmarked, then stopped — see Gate 3
lesson above; this did not touch the production `hasheemstudio-api` container) against the real
containerized, resource-limited worker (`mem_limit: 2g`, `cpus: 2.0`, `pids_limit: 256` — same
sandboxed container used for every other benchmark). Evidence:
`docs/evidence/phase7-capacity/queue-throughput-compat_encode-report.json`.

- 5/5 jobs succeeded, 0 failed, recipe=`compat_encode` (real H.264 re-encode path, not remux).
- Total wall clock: 102.6s for 5 jobs → ~0.049 jobs/sec ⇒ **~4,212 jobs/day at the current
  `concurrency: 1` setting** — close to the remux figure (~4,454/day) measured in the prior
  session, because the only available test fixture is a small synthetic file where fixed overhead
  (upload, DB writes, process bookkeeping) dominates over actual encode time.
- Per-job total time: p50=14.27s, p95=14.39s, max=14.39s — markedly higher than remux's p50=8.16s/
  p95=14.24s from the same fixture, consistent with encode being genuinely more expensive than a
  container remux.
- Worker container CPU samples spiked as high as **172%** during active encoding (vs. remux's
  ~98-127% peak) — encode uses more of the container's 2.0-CPU budget, confirming it is the more
  CPU-intensive path, as expected.
- **Explicitly not extrapolated further**: this used one small synthetic fixture at
  `concurrency: 1`. It does not predict throughput for real user-sized/longer videos, and does not
  support any capacity claim beyond "the sandboxed worker successfully completed 5/5 real H.264
  encodes under its existing resource limits, at the rate measured." A benchmark against
  realistic-duration files remains a real gap — see `docs/MAC-HANDOFF.md` §6.

### Gate 5 — Mac handoff document

Written: `docs/MAC-HANDOFF.md`. Contains exact clone/checkout/install commands, `pnpm dev:up`/
`pnpm dev` usage (including the real Compose-project-collision gotcha found in the prior session),
an honest note that `pnpm test` itself currently no-ops (no workspace package defines a `test`
script — the real commands are `pnpm typecheck`, `pnpm test:integration`, `pnpm test:e2e`,
`pnpm test:a11y`, `pnpm test:load:*`), an SSH tunnel command for reaching the VPS-internal-only
Supabase Studio dashboard from a Mac browser, a clearly labelled list of every item that remains
genuinely unverified from a real external machine, and a step-by-step first-test checklist for the
owner to work through on the Mac.

## Not started yet
- Phase 6 (admin console, compliance UX) — Resend itself is covered under Phase 7 Priority 6 above
- Phase 8 (Kubernetes)
- Phase 9 (growth features)
- Encode-recipe (not just remux) load benchmarking
- `scripts/verify/capacity.mjs` executable calculator
- Real external-Mac deploy-workflow verification
- Full audit of `fetch().catch()` cleanup-error-swallowing across test scripts

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

1. **Still the single owner-blocked item**: retrieve `hasheemstudio-resend-api` and
   `hasheem studio DNS` from the owner's self-hosted Vaultwarden. As of this session, `bw status`
   on this host still reports `"status":"locked"` and no `~/.hasheemstudio_bw_session` handoff file
   exists — unchanged from last session. Blocked on the owner (or a separate terminal they control)
   running `bw unlock` and handing off a `BW_SESSION` value via a file — **not** through this chat.
   See `scripts/ops/fetch-vaultwarden-secret.sh` and `docs/DECISIONS.md` for the exact secret names
   (`RESEND_API_KEY`, `CLOUDFLARE_API_TOKEN`) and step-by-step handoff. Once in hand: wire Resend
   SMTP, add DNS records, begin the public-ingress step, and verify **real inbox delivery**
   (separately from provider-API acceptance), then run the full public browser journey (signup →
   confirm → login → upload → process → download) on `https://hasheemstudio.com` before any
   launch-ready claim.
2. Real external-Mac verification of the deploy workflow: the mechanism is built and tested from
   this VPS with a throwaway key (see Phase 7 Priority 5 above), but a genuine separate machine has
   not yet run the documented `docs/DEPLOYMENT.md` commands against this VPS. This remains the
   honest gap, not relabeled.
3. Encode-recipe (H.264) load benchmarking — only the remux recipe was measured this session (see
   `docs/CAPACITY.md`); PRD requires both, separately.
4. Consider raising the worker's hard-coded `concurrency: 1` (`apps/worker/src/queue.ts`) and
   re-measuring — CPU/memory headroom was observed between job spikes in this session's throughput
   run, but a higher setting has not been tested against the sandboxed worker's own resource limits.
5. Independently unblocked, not yet done: containerize `apps/api` (currently a bare host process);
   schedule `scripts/ops/retention-sweep.mjs` (cron/systemd timer — it's tested and safe to run
   repeatedly, just not automated yet); a Playwright network-throttling test for real
   mid-transfer upload interruption in the browser (current coverage proves the protocol-level
   interrupt/resume and the browser client's logic separately, not together in one browser test);
   `packages/contracts` codegen for generated TypeScript types from the migrated schema; a full
   audit of `fetch().catch()` cleanup-error-swallowing across test scripts (found in the
   account-deletion regression work this session, not yet fixed everywhere); `scripts/verify/capacity.mjs`
   as a real executable calculator from the formulas in `docs/CAPACITY.md`.

## Launch-readiness gate status (explicit, per owner instruction not to declare launch-ready early)

**Not launch-ready — closer, but real gates remain.** As of the 2026-09-18 session:
- **Credential rotation: IN PROGRESS, blocking.** `RESEND_API_KEY` and `CLOUDFLARE_API_TOKEN` were
  accidentally printed into the 2026-09-17 transcript; the owner is rotating both through their
  provider dashboards now. The protected env file was not touched this session per explicit
  instruction. Once the owner confirms new values are provisioned: restart the affected containers
  (`auth`, `studio`, `storage`, `api-gw`/envoy — same set recreated when these URLs were first
  wired), re-run health checks, and send a **fresh** real signup to re-verify SMTP with the new key.
- Resend email delivery: **provider acceptance verified** (real 200, no SMTP error, real public
  signup through the live browser) — but that test predates the credential rotation above and
  should be re-verified once rotation completes. **Inbox receipt still not independently
  verified** — Gmail MCP re-auth attempted again this session, still fails; needs owner action (see
  Gate 2 above).
- DNS/TLS for `hasheemstudio.com`: **live** — real Let's Encrypt certs, publicly reachable.
  (`CLOUDFLARE_API_TOKEN` rotation does not affect already-issued DNS records or certs.)
- Real public signup→login→upload→process→download browser journey on the live domain: **verified**
  as of 2026-09-17 (8/8 + 4/4 checks passed against `https://hasheemstudio.com` itself). Should be
  re-run once credential rotation completes, since it exercised the pre-rotation Resend key.
- API latency PRD target (p95 < 300ms): met at concurrency ≤25, **not met at concurrency 50** under
  real host contention in an earlier session — see `docs/CAPACITY.md`. Not re-measured against the
  current production topology (extra containers now share the host) — should be re-run.
- External Mac-to-VPS deploy workflow: mechanism built, still unverified from a real external
  machine. `docs/MAC-HANDOFF.md` (new this session) is the exact, ready-to-use runbook for closing
  this gap — nothing in it has been executed from an actual Mac yet.
- Encode-recipe (H.264) load benchmark: **done this session** — 5/5 jobs succeeded, ~4,212 jobs/day
  at `concurrency: 1` on one small synthetic fixture; explicitly not extrapolated to a general
  capacity claim (see Gate 4 above and `docs/evidence/phase7-capacity/queue-throughput-compat_encode-report.json`).
  A benchmark against realistic (non-synthetic) file sizes/durations remains a real gap.
- Local dev port collision: **root-caused and fixed this session** — it was our own orphaned
  bare-host dev processes, not an unrelated project (the 2026-09-17 write-up misattributed this; see
  Gate 3 above for the correction and the exact check/fix commands). `pnpm dev` smoke-tested clean
  afterward.
