# Status

> Living document. Update this at the end of every phase or work session. This is the first file
> any resuming agent should read after `CLAUDE.md`/`AGENTS.md`. See `docs/DECISIONS.md` for owner
> input items and `docs/IMPLEMENTATION-PLAN.md` for the fixed phase plan this tracks against.

**Last updated:** 2026-09-16, during initial Phase 0 session.

**Updated again:** 2026-09-17, during a follow-on Phase 5 session (worker sandboxing, resumable
uploads, H.264 encode, real entitlements, retention). See the "Phase 5" section below for full
detail; this replaces the "Current phase" line further down, which is left as a historical marker
of where Phase 4 ended.

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

## Not started yet
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

1. Owner-approved next step for credentials: retrieve `hasheemstudio-resend-api` and
   `hasheem studio DNS` from the owner's self-hosted Vaultwarden. Blocked on the owner (or a
   separate terminal they control) running `bw unlock` and handing off a `BW_SESSION` value via a
   file — **not** through this chat. See `scripts/ops/fetch-vaultwarden-secret.sh` and
   `docs/DECISIONS.md` for the exact secret names (`RESEND_API_KEY`, `CLOUDFLARE_API_TOKEN`) and
   step-by-step handoff. Once in hand: wire Resend SMTP, add DNS records, begin Phase 2's
   public-ingress step, and verify real inbox delivery (separately from provider-API acceptance).
2. Independently unblocked, not yet done: containerize `apps/api` (currently a bare host process);
   schedule `scripts/ops/retention-sweep.mjs` (cron/systemd timer — it's tested and safe to run
   repeatedly, just not automated yet); a Playwright network-throttling test for real
   mid-transfer upload interruption in the browser (current coverage proves the protocol-level
   interrupt/resume and the browser client's logic separately, not together in one browser test);
   `packages/contracts` codegen for generated TypeScript types from the migrated schema.
3. Phase 7 prep: this is the point to start real load/capacity measurement
   (`docs/CAPACITY.md`), an accessibility audit, and the backup/restore rehearsal
   (`docs/BACKUP-RESTORE.md`) — none of that has been done yet and all of it is unblocked.
