# Status

## Snippe mobile-money checkout enabled — 2026-09-26

- [VERIFIED-LIVE] Owner-approved Vaultwarden item `hasheemstudio-snippe-api` provisioned into `/etc/hasheemstudio/local.env` (0600): password field validated as `snp_` API key; username field validated as `whsec_` account webhook signing secret. Values were never printed or saved in repo evidence. Vault locked and temporary session deleted immediately after provisioning.
- [VERIFIED-LIVE] `STUDIO_PAYMENT_METHODS=mobile`, `STUDIO_PAYMENT_APPROVED=true`, `STUDIO_CHECKOUT_ENABLED=true`; only `hasheemstudio-api` was recreated and it is healthy. Public `/v1/payments/plans` reports `available:true`; live pricing shows Weekly 5,000 TZS / 20 videos / 7 days and Monthly 19,900 TZS / 50 videos / 30 days with active CTAs (no "Opening soon").
- [VERIFIED-PROVIDER] Snippe accepted the installed API key through the documented non-mutating `GET /v1/payments/balance` endpoint (HTTP 200, `status:success`, balance object, TZS). No amount/balance value was retained in evidence.
- [VERIFIED-LIVE] Unsigned webhook POST is rejected 401. A correctly HMAC-signed, schema-valid synthetic `payment.completed` event for a nonexistent random Studio intent reached settlement and was safely denied 400; zero `payment_events` rows were written. This proves the configured signing secret is accepted by Studio's live verifier without granting an entitlement.
- [TESTED] API payment tests 17/17 and fake-provider checkout chain 8/8 passed immediately before activation (exact provider request, pending state, signature/amount rejection, webhook completion, entitlements/download charging, failure/retry, anonymous denial). [Evidence](evidence/payments/snippe-live-enable.json).
- [PENDING OWNER TEST] No real phone was charged yet. Full financial proof still requires one owner-approved 5,000 TZS Weekly mobile-money attempt, physical handset approval, provider-originated `payment.completed` webhook, activated 20-video entitlement and one paid download decrement. Do not claim the real money path end-to-end until those are observed.

## Studio product rollout — 2026-09-21

- [VERIFIED-LIVE] Deployed only Studio web/API/Auth images/configuration. HTTPS login, privacy/service-information pages, API readiness and disabled checkout plan all return 200. Auth/web/API healthy; DB/Redis/Envoy/worker containers were not recreated. The crash-recovery test briefly stopped/restarted **only Studio worker**, restoring it afterward. No shared edge/DNS or unrelated services changed. [Readback](evidence/studio-product-deployment.json).
- [VERIFIED-LIVE] Shared landing-style auth is deployed, tourism panel removed, Get Started visible on mobile and authenticated navigation. Landing.tsx unchanged; one shared accent-text token was slightly lightened to pass contrast on cards. Real public Chromium guest upload → processing → login → same result → private download → daily-limit denial → logout passed. [Browser](evidence/guest-download-gate/browser.json).
- [VERIFIED-LIVE] Six Studio code-only templates deployed and public template URLs checked. Protected environment remains 0600 inside 0700. GoTrue readback: six digits, 600-second expiry, confirmation required, Resend SMTP sender no-reply@hasheemstudio.com. Frontend allowlist contains only the two approved Studio callback/reset URLs. Existing Google callback unchanged.
- [TESTED-LOCAL] Real GoTrue signup/recovery tests reject wrong/expired/reused codes; browser tests verify signup/recovery sessions, refresh, password update and logout. Codes retained only in memory. No approved external test inbox provided, so these tests deliberately do **not** establish email delivery. All six email previews checked in light/dark at 320px. [Email tests](evidence/email-templates/otp.json), [browser flow](evidence/studio-product-flows/results.json).
- [VERIFIED-LIVE] Migration 0015 applied by the repository runner from pushed 23bedcfa1f0a1ec0a6bc802b7c7d37c709d3e2a8 after encrypted backup; ledger readback has no pending migrations or checksum drift. The inventory name local refers to the deployed dedicated Studio DB, not independent staging. [Migration](evidence/payments/migration.json).
- [TESTED-LOCAL] Payment DB/API/RLS tests use synthetic signed fixtures: duplicate concurrent events store once and grant once; bad signatures, stale timestamps, wrong amounts/correlations, cross-account access, expired/revoked allowances and resurrection after failure/cancellation denied. Actual private download gate respects a synthetic verified entitlement. **Not Snippe sandbox or financial evidence.** Public checkout=false and unconfigured webhook returns 503. [Payment tests](evidence/payments/integration.json).
- [TESTED-LOCAL] Full typecheck/build, unit tests, all six existing integration suites, RLS, transport/browser uploads, concurrency, storage denial and 27 accessibility checks passed. Initial stale browser/finalize assertions were corrected to current progressive auth and idempotent same-asset behavior. Retention tests now filter only test workspaces; backup/rehearsal tools no longer put passwords in process arguments. [Complete test matrix](evidence/studio-product-tests.json).
- [TESTED-LOCAL] Known-current-secret scan passed across source/diff, frontend bundles, task logs, process arguments and bounded Studio Auth/API logs; not a universal history scan. No Vaultwarden retrieval attempted: exact Snippe item unknown, handoff absent, BW_SESSION absent. [Scan](evidence/studio-product-secret-scan.json).
- [BLOCKED] Actual signup/recovery **inbox receipt** and support@hasheemstudio.com routing need owner confirmation. Google remains enabled and reaches Google with PKCE/correct callbacks, but owner consent/authenticated Google session is not independently verified.
- [BLOCKED] No approved Snippe item, plan name/TZS price/duration/download allowance/methods or provider-approved sandbox credentials/mode. No real charge or provider request made. Card billing/hosted-checkout integration is deferred pending those approvals; checkout remains disabled. Payment screenshots are visibly labelled synthetic UI fixtures. Do not report email delivery, Google end-to-end, or payments complete.

## Disabled Studio payment foundation — 2026-09-21

- [IMPLEMENTED] Studio-owned payment intents/events/expiring entitlements, verified webhook settlement, authenticated checkout/status API and download-gate upgrade states. Checkout defaults disabled, with no price seed. Card initiation remains denied pending provider contract/sandbox verification. No provider call or charge made. [PAYMENTS](PAYMENTS.md).
- [TESTED-LOCAL] Five Snippe unit tests cover raw signatures, stale/future timestamps, malformed signatures, event schema/version/correlation, missing configuration, request shape and idempotency/key guards. Full typecheck/build passed. Migration 0015 is committed before runner application; actual DB/API tests and deployment remain in the next evidence milestone.
- [IMPLEMENTED] Studio backup helper now passes its password through child environment, not Docker command arguments, before the required migration backup.
- [BLOCKED] Exact approved Snippe item, price/name/duration/download allowance/methods and verified sandbox credential/mode still needed. No protected handoff currently exists. No production payment activation.

## Studio email-code milestone — 2026-09-21

- [IMPLEMENTED] Adapted six owner-authorized email layouts with Studio assets/branding, code-only content and public privacy/service-information links. Added signup OTP entry/resend; recovery copy now describes codes, not emailed links. Signup and recovery retain distinct Supabase OTP types.
- [TESTED-LOCAL] All six email templates previewed at 320px in light/dark with synthetic codes and no overflow. Real deployed GoTrue loopback tests passed wrong/expired/used signup and recovery cases, session creation and recovery password update; disposable test account removed. No email was sent by this test. Full typecheck/build and pnpm test result recorded separately in rollout.
- [IMPLEMENTED] Compose template mappings and six-digit/600-second settings prepared; protected production configuration and Auth restart are pending the deployment milestone. Existing Google callbacks unchanged.
- [BLOCKED] Actual confirmation/recovery inbox delivery, support mailbox routing and owner Google consent remain unverified. No approved test inbox supplied yet. [Email runbook](EMAIL-TEMPLATES.md), [OTP evidence](evidence/email-templates/otp.json).

## Landing-design auth milestone — 2026-09-21

- [IMPLEMENTED] Shared LandingAuthShell reuses the public navigation, Studio brand, charcoal surfaces, gradient accent and pausable/reduced-motion landing background across all auth routes. Removed the tourism panel; Landing.tsx remains unchanged. Get Started remains visible at 320px and for both auth states. Existing safe return-path and PKCE exchange logic are preserved.
- [TESTED-LOCAL] Full workspace typecheck and production build pass. Chromium checked seven public/auth routes at 1440, 390 and 320px (21 combinations), visible CTA/mobile sign-in and no horizontal overflow. Evidence: [landing-auth](evidence/landing-auth/results.json). Authenticated navigation and real guest flow regression follow in the deployment milestone.
- [BLOCKED] Studio payment price/configuration absent; exact approved Snippe Vaultwarden item and sandbox mode not established. Requested plan/price/duration/download allowance/methods and approved email test inbox. Checkout remains disabled. Email OTP work and deployment are not included in this milestone.

## Google OAuth enabled in production — 2026-09-21 (Europe/Berlin)

- [VERIFIED-LIVE] Owner confirmed organization **Bisso VPS Automation**, collection **Hasheem
  Studio**, exact item `hasheemstudio-google-oauth`. Retried only that item with Bitwarden CLI
  **2026.8.0** and the new protected handoff. The response now matches the exact item name and
  has an organization assignment; the previous metadata blocker is resolved.
- [VERIFIED-LIVE] Provisioned only `GOOGLE_ENABLED`, `GOOGLE_CLIENT_ID` and `GOOGLE_SECRET` into
  `/etc/hasheemstudio/local.env` (0600, inside 0700 directory). No credential value was printed
  or stored in repository evidence. Vault lock completed, session environment was cleared and
  the handoff deleted **before deployment**. [Provisioning](evidence/google-oauth-provisioning.json).
- [VERIFIED-LIVE] Recreated **only `hasheemstudio-auth`** with `--no-deps`; it is healthy.
  All other preexisting container IDs are unchanged, including Hasheem API/web and MailRaft.
  Readback confirms Google enabled and both credential variables present, with exact provider
  callback `https://supabase.hasheemstudio.com/auth/v1/callback`. Frontend callback remains
  `https://hasheemstudio.com/auth/callback`. No Google Cloud settings changed.
  [Deployment](evidence/google-oauth-deployment.json).
- [VERIFIED-LIVE] `/auth/v1/settings` returns HTTP 200 with `external.google=true`. A fresh
  Chromium context sees the enabled Continue with Google button and reaches Google's login
  page. Observed authorization requests use PKCE and both exact approved callback URLs.
  No `redirect_uri_mismatch` or `invalid_client` page was observed. A callback visit without a
  session is rejected. No query values, tokens, screenshots or traces were retained.
  [Browser](evidence/google-oauth-browser.json).
- [TESTED-LOCAL] Four provisioning guard/update tests passed and resolved Compose configuration
  validated without printing it. Workspace typecheck/build passed in the preceding same-day
  code milestone; this retry changes protected configuration/evidence only. The known-secret
  scan now includes the actual Google Client ID and Secret plus URL/base64 forms: zero matches
  across 1,382 checked repository/diff, bundle, task-log, Auth/API-log-tail and process surfaces.
  It is not a universal/history scan. [Scan](evidence/google-oauth-secret-scan.json).
- [BLOCKED] Real owner Google consent, code exchange, authenticated return, refresh and logout
  are **not yet independently verified**. Requested a fresh owner login at
  https://hasheemstudio.com/login; do not share callback URLs/codes/tokens. Provider enablement
  and reaching Google's login page are not end-to-end session proof. No synthetic account or
  fabricated login was used. The earlier failed-item/disabled snapshots below are historical.


## Google OAuth provisioning — 2026-09-21 (Europe/Berlin)

- [BLOCKED] Used the installed Bitwarden CLI **2026.8.0**, not the default 2026.9.0 binary,
  with the protected `~/.hasheemstudio_bw_session`. Requested only
  `hasheemstudio-google-oauth`. The retrieved response failed the combined exact-name /
  organization-item guard (`exact_organization_item_required`). No credential was provisioned,
  no raw item was persisted, and no value was printed. The original bounded diagnostic does
  not establish which of the two metadata conditions failed; do not invent that detail.
- [VERIFIED-LIVE] Vault lock returned success, `BW_SESSION` was removed from the helper's
  environment, and the temporary handoff was deleted. Protected server environment remains
  `/etc/hasheemstudio/local.env`, mode 0600 inside a 0700 directory, unchanged by this attempt.
  No Auth/API or other service was restarted. MailRaft and all unrelated services are untouched.
- [IMPLEMENTED] Compose now maps server-only `GOOGLE_ENABLED`, `GOOGLE_CLIENT_ID` and
  `GOOGLE_SECRET` to GoTrue with a disabled default for unconfigured stacks. The resolved
  production provider callback is exactly
  `https://supabase.hasheemstudio.com/auth/v1/callback`. Existing frontend callback remains
  `https://hasheemstudio.com/auth/callback`; no Google Cloud settings or frontend auth logic changed.
- [IMPLEMENTED] Added exact-item provisioning helper with pinned CLI version, protected-file
  checks, atomic environment update, no secret-bearing arguments/output and vault/session
  cleanup. Future retries distinguish exact-name mismatch from missing organization assignment
  using bounded reason codes/booleans, never item contents. Owner must confirm the item's exact
  name and organization membership (or explicitly clarify a personal-vault item) and prepare a
  fresh protected handoff. Do not paste credentials into chat.
- [TESTED-LOCAL] Four synthetic provisioning guard/update tests passed; Compose validation,
  full workspace typecheck and build passed. Frontend build retains its existing non-failing
  >500 kB bundle warning. Known-current-secret scan found zero matches across 1,371 checked
  repository/diff, frontend, task-log, Auth/API-log-tail and process-argument surfaces. This is
  not a universal/history scan, and discarded Google item values could not be value-matched.
- [VERIFIED-LIVE] Fresh Chromium and HTTPS probe: `/auth/v1/settings` returned 200 with Google
  **disabled**; the login button is correspondingly disabled. The exact frontend callback
  returns its SPA and rejects an unauthenticated visit. This verifies the blocked dependency,
  not Google consent, code exchange or a real session. [Browser](evidence/google-oauth-browser-disabled.json),
  [provisioning](evidence/google-oauth-provisioning-blocked.json), [scan](evidence/google-oauth-secret-scan.json).
- [BLOCKED] Google-enabled readback, real consent/login, refresh/logout and authenticated callback
  acceptance remain pending valid provisioned credentials and an owner-approved browser login.
  Do not claim Google Sign-In works from this change. Safe retry/runbook: [GOOGLE-AUTH](GOOGLE-AUTH.md).


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

**Updated again:** 2026-09-18 (same day, second session): the owner confirmed rotation and handed
off a fresh Vaultwarden session; both new secrets were provisioned via the safe helper script only
(no raw file edits, no secret values printed, no repeat of the prior transcript-leak incident),
affected containers restarted, and SMTP/DNS re-verified against the new credentials. Ran a full
health pass (`pnpm typecheck` clean, `pnpm test:integration` 44/44) and a full post-rotation browser
journey that included a real click-through of the actual confirmation link GoTrue embedded in a
real sent email — 8/8 checks passed, real download bytes confirmed. **The one gap still open: real
inbox receipt is not independently verified** by this agent (Gmail MCP still needs interactive
owner re-authentication) — provider acceptance and the full technical chain are verified, inbox
receipt itself is not, and this document does not conflate the two. See "Gate 1 completed —
2026-09-18, second same-day session" below for full evidence.

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

## Gate 1 completed — 2026-09-18, second same-day session: rotation provisioned and verified

The owner confirmed both new secrets were saved into Vaultwarden and handed off a fresh session
file. Retrieved both via `scripts/ops/fetch-vaultwarden-secret.sh` only (no raw file edits) — one
attempt each, both succeeded immediately this time. Vault was locked and the session file deleted
straight after, per protocol. Full evidence:
`docs/evidence/phase7-launch/post-rotation-verification.json`.

- `SMTP_PASS` re-synced to the new `RESEND_API_KEY` (GoTrue reads `SMTP_PASS`, not
  `RESEND_API_KEY` directly, via a small script using the same never-print awk+mv pattern as the
  fetch script — confirmed by matching string lengths, not by printing values).
- **No file-diff leak this time.** The 2026-09-17 incident was caused by a raw `sed -i` run
  directly against the protected file, outside the safe helper scripts — every edit this session
  went through the awk+mv-based helper pattern instead, and no secret value appeared anywhere in
  this session's output.
- Restarted `hasheemstudio-auth` (recreated — picked up the new `SMTP_PASS`), and explicitly
  restarted `hasheemstudio-api` and `hasheemstudio-worker` per instruction (Compose correctly
  determined neither's resolved config had actually changed, since neither consumes these two
  secrets — restarted anyway as a clean-state precaution). No in-flight jobs existed at restart
  time (checked first). All three came back healthy; every other container, and every unrelated
  service on this shared host, was confirmed untouched.
- **SMTP re-verified with the new key**: a fresh real signup (`POST /auth/v1/signup`) returned a
  real 200 with `confirmation_sent_at` populated and no SMTP error in the auth logs — provider
  acceptance confirmed against the rotated credential, not assumed carried over from before.
- **DNS re-verified with the new token**: `GET /zones/:id/dns_records` returned all 7 expected
  records correct and unchanged (the 4 ingress A records plus the pre-existing Resend
  send/rsend/DKIM records) — the token rotation did not disturb anything already published.
- **Full health checks**: `pnpm typecheck` clean across all packages. No literal `pnpm check`
  script exists in this repo (already documented as a gap in `docs/MAC-HANDOFF.md`) — ran the real
  equivalent, `pnpm test:integration`, instead: **44/44 checks passed** across all 6 suites
  (crash-recovery 6/6, quota-race 4/4, retention 13/13, hostile-inputs 8/8, account-deletion 4/4,
  backup-restore 9/9). Public HTTPS health endpoints for all three live hostnames also confirmed.
- **Full post-rotation browser journey, including a real click-through of the actual confirmation
  link**: the exact token GoTrue embedded in the real Resend-sent email was retrieved via
  legitimate service-role database access to our own just-created test account's row (not a bypass
  of the verification mechanism), then used to hit the real `/auth/v1/verify` endpoint exactly as
  a real email click would — **8/8 checks passed**: real confirm → real session → real login →
  real upload → real processing → real download (82,239 real bytes). Screenshot:
  `docs/evidence/phase7-launch/post-rotation-full-journey.png`. Test account deleted afterward
  (real 200 from the admin delete).
- **Minor disclosure**: a short-lived (1-hour expiry) test-account session token appeared in this
  session's tool output as an artifact of capturing the post-redirect URL during the
  confirmation-link test. This is a materially lower-severity event than the prior static-credential
  leak — a disposable per-session auth token for an account that was deleted immediately
  afterward, not a reusable provider secret. Noted for completeness, not because it requires owner
  action.
- **The one gap that remains genuinely open**: real inbox receipt is still not independently
  verified by this agent. Provider acceptance and the entire technical confirm/login/upload/
  download chain are now verified with real evidence; whether a Resend-sent email actually lands
  in an inbox is a distinct claim this agent still cannot check itself. Gmail MCP re-auth was
  attempted again this session — same "needs you to sign in again" failure, since `/mcp` is an
  interactive command only the owner can run. **Owner action still needed**: either run `/mcp` to
  reauth Gmail, or manually check an inbox for a Resend-sent confirmation email and report back.

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

**Not launch-ready — one real gate remains.** As of the second 2026-09-18 session:
- **Credential rotation: DONE.** New `RESEND_API_KEY` and `CLOUDFLARE_API_TOKEN` provisioned via
  the safe helper script only, affected containers restarted and healthy, SMTP and DNS both
  re-verified working against the new values. See "Gate 1 completed" above for full evidence.
- Resend email delivery: **provider acceptance re-verified against the NEW rotated key** (real 200,
  no SMTP error). **Inbox receipt is the one remaining unverified claim** — Gmail MCP re-auth
  attempted again this session, still fails (interactive `/mcp` only the owner can run); needs
  owner action (see Gate 2 above). This is now the single blocking item for a full launch-ready
  declaration.
- DNS/TLS for `hasheemstudio.com`: **live and re-verified** with the new Cloudflare token — all 7
  expected records correct and unchanged.
- Real public signup→login→upload→process→download browser journey on the live domain:
  **re-verified post-rotation**, including a real click-through of the actual confirmation link
  from the actual sent email (8/8 checks passed, real download bytes). The only piece not covered
  by this agent's own verification is confirming that email physically arrived in an inbox — see
  above.
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

# Mac local-development bootstrap — 2026-09-19

- Installed the project-required host tooling with Homebrew: Docker CLI 29.8.1,
  Docker Compose 5.5.1, Colima 0.10.3, and pnpm 9.15.0. Colima is configured with
  4 CPUs, 6 GiB memory, and a 60 GiB disk for the project-scoped local stack.
- The first real Mac run found that local secret generation assumed Linux's
  `/etc/hasheemstudio` and therefore required an interactive root password. The
  local scripts now default to `~/.config/hasheemstudio/local.env` on macOS and
  continue using `/etc/hasheemstudio/local.env` on Linux. An explicit
  `HASHEEMSTUDIO_ENV_FILE` still overrides both defaults, including for local
  migrations.
- Added `package-lock.json` to `.gitignore`; pnpm is the declared package manager
  and an npm-generated lockfile otherwise makes the migration runner reject the
  working tree as dirty.
- The first Compose start also found that the base file always required the
  VPS-owned external `coolify` network. macOS `dev:up` now layers a local override
  that creates a project-owned substitute network while preserving the same
  service attachments and leaving the production Compose behavior unchanged.
- The first container boot exposed another fresh-Mac bug: the generated
  `POSTGRES_PASSWORD` used standard Base64, whose reserved characters could make
  Auth and Supavisor parse their connection URLs incorrectly. New database
  passwords now use 48-character hexadecimal values, preserving entropy while
  remaining safe in the existing URL interpolation. The empty first-run local
  volumes were reset before regenerating the local secret file.
- Network-path startup then exposed that `supabase_admin` was omitted from the
  role-password bootstrap SQL. The role is now updated alongside Auth, Storage,
  PostgREST, and pooler roles. The bootstrap explicitly switches to the image's
  protected `supabase_admin` administrator before altering those reserved roles.
  Verification uses a real TCP connection from a separate container because the
  database container trusts its own loopback.
- The same TCP check showed the migration identity (`postgres.<tenant>`) still
  used the image's bootstrap password. The bootstrap now assigns the generated
  password to `postgres` as well, allowing the documented migration runner to
  authenticate through Supavisor's session endpoint.
- The local migration runner now selects the same macOS secret-file default as
  `dev:up`, so the documented `pnpm db:local:migrate` command works without an
  extra shell export.
- The first host-process start found that `dev.mjs` checked the selected secret
  file but did not pass it to the API child. It now supplies the parsed local
  environment to the API and maps only the public Supabase URL, anon key, and
  API URL to Vite's `VITE_*` variables.
- Final Mac evidence: all 13 `hasheemstudio` Compose containers reported healthy
  or running; `pnpm db:local:migrate` applied migrations `0001` through `0012`
  and verified no pending versions or checksum drift; the bare-host API returned
  HTTP 200 from `http://127.0.0.1:8787/health/live`; and Vite returned HTTP 200
  from `http://127.0.0.1:5173/`. The `pnpm dev` supervisor remains active for
  the owner to use the local application.

# Dark-only interface — 2026-09-20

- The web application now declares the dark theme directly on its root HTML element.
- Removed operating-system theme detection, saved light-theme preferences, the navigation theme
  toggle, and the light palette overrides. All users now receive the dark palette consistently.
- Verification: `pnpm typecheck` and `pnpm --filter @hasheemstudio/web build` passed.

# Landing-page redesign — 2026-09-20

- Rebuilt the landing page around a focused tool layout: compact navigation, video-preparation
  headline, prominent upload call to action, three processing steps, trust benefits, and a concise
  beta-plan callout. Copy matches the implemented MP4/MOV upload, inspect/remux/encode, verification,
  resumability, and Verified Free limits.
- Added an original generated transparent hero illustration at
  `apps/web/public/assets/video-verified-hero.png`, using the product's dark graphite and
  magenta/orange palette. No third-party reference artwork or branding is included.
- Verified desktop (1440 px) and mobile (390 px) renders in headless Chrome with no horizontal
  overflow. `pnpm typecheck` and `pnpm --filter @hasheemstudio/web build` passed.

# Framed navigation and page guides — 2026-09-20

- Applied the supplied navigation reference's structural treatment using Hasheem Studio content:
  a bordered desktop canvas, boxed brand mark, centered product navigation, monospace account
  actions, a light primary button, and a dashed divider below the navigation.
- Added faint dashed vertical content guides across the desktop page. They are decorative,
  non-interactive, hidden on smaller screens, and sit behind application content.
- Verified desktop (1440 px) and mobile (390 px) renders in headless Chrome with no horizontal
  overflow. `pnpm typecheck` and `pnpm --filter @hasheemstudio/web build` passed.

# Generated workflow artwork — 2026-09-20

- Replaced the generic line icons and arrow badges in the three workflow cards with an original,
  coordinated set of transparent 3D illustrations for upload, processing, and verified download.
  The optimized 320 px PNG assets are stored under `apps/web/public/assets/steps/` and total less
  than 300 KB.
- Removed the benefit-row icons and replaced them with compact numbered proof points, keeping the
  generated workflow artwork as the section's visual focus.
- Verified the completed desktop layout in headless Chrome with no horizontal overflow.
  `pnpm typecheck` and `pnpm --filter @hasheemstudio/web build` passed.

# Flat social-output hero — 2026-09-20

- Removed the original 3D hero artwork and replaced it with a flat, front-facing progressive
  diagram at `apps/web/public/assets/video-social-progress.png`.
- The new visual shows a source video becoming progressively more compact before branching into
  landscape, square, and vertical social-ready formats. Supporting labels clarify the sequence;
  copy describes preserved visual quality without making a lossless-compression claim.
- Optimized the transparent artwork to a 1200×468 PNG (318 KB). Verified desktop (1440 px) and
  mobile (390 px) renders in headless Chrome with no horizontal overflow; `pnpm typecheck` and
  `pnpm --filter @hasheemstudio/web build` passed.

# Benefit-row Lucide icons — 2026-09-20

- Added `lucide-react` to the web workspace and paired the four benefit claims with consistent
  outline icons: `ShieldCheck`, `Gauge`, `MonitorSmartphone`, and `BadgeCheck`.
- Retained the compact numeric markers as secondary navigation cues while making each benefit
  faster to recognize visually.
- Verified all four SVG icons render in headless Chrome at 1440 px with no horizontal overflow;
  `pnpm typecheck` and `pnpm --filter @hasheemstudio/web build` passed.

# Conversion-diagram clarification — 2026-09-20

- Restored the generated conversion diagram and all three generated workflow-card illustrations.
- Changed only the conversion-diagram area. It now states the one-in/one-out outcome and labels the
  exact input, processing decision, and delivered output. All surrounding landing-page sections
  remain at their previously approved design.
- Verified desktop (1440 px) and mobile (390 px) renders in headless Chrome with no horizontal
  overflow; `pnpm typecheck` and `pnpm --filter @hasheemstudio/web build` passed.

# Layered hero and typography — 2026-09-20

- Reworked only the hero upload composition: the existing conversion visual now sits behind the
  content as a compact stage, while a high-contrast upload panel overlaps its lower edge like a
  dialog. The workflow cards and all sections below the hero remain unchanged.
- Added the locally bundled Inter Variable family and applied it through the shared design token,
  including the navigation wordmark and all application pages.
- Verified desktop (1440 px) and mobile (390 px) renders in headless Chrome. Inter Variable is the
  computed body font at both sizes, the overlay remains inside the viewport, and there is no
  horizontal overflow. `pnpm typecheck` and `pnpm --filter @hasheemstudio/web build` passed.

# Visual-only hero background — 2026-09-20

- Removed all headline and explanatory copy from the background stage behind the upload dialog.
- Recentered and enlarged the existing conversion artwork so the background is visual-only while
  the floating upload panel remains the single text and action focus.
- `pnpm typecheck` and `pnpm --filter @hasheemstudio/web build` passed.

# Animated native converter visual — 2026-09-20

- Removed the generated hero-background PNG and replaced it with a native responsive animation:
  MOV/MP4 source cards cycle every 2.8 seconds, a rotating preparation control connects them, and
  the output card states the actual MP4 H.264/AAC target.
- Built the visual from HTML, CSS, and existing Lucide icons with original Hasheem Studio styling.
  Reduced-motion preferences disable the continuous rotation.
- Browser verification confirmed MOV changes to MP4 after 2.8 seconds at desktop (1440 px) and
  mobile (390 px), with no horizontal overflow. `pnpm typecheck` and
  `pnpm --filter @hasheemstudio/web build` passed.

# Split hero message — 2026-09-20

- Moved the existing product label, headline, and explanation into the animated hero stage.
- Desktop now uses a reference-aligned split composition with the message on the left and animated
  converter on the right; mobile stacks the same message above the converter. Copy is unchanged.
- Compact mobile-only converter cards prevent the stacked copy and animated visual from competing
  for space; desktop retains the full cards and codec detail.
- Verified desktop (1440 px) and mobile (390 px) renders with no horizontal overflow;
  `pnpm typecheck` and `pnpm --filter @hasheemstudio/web build` passed.

# Hero spacing and motion correction — 2026-09-20

- Inspected the live CloudConvert page in Chrome, including format transitions, connector sweeps,
  pulsed rotation, output glow, and low-opacity orbit lines. Implemented original corresponding
  motion for the supported MOV/MP4 illustration; added a pause control and a static reduced-motion
  presentation without repeatedly announcing decorative format changes to screen readers.
- Replaced the nested rounded hero and absolute copy placement with a broad background and a
  responsive content grid. Widened and dimmed the page guides, reduced desktop format cards from
  128×160 to 106×116 px, and narrowed the upload panel from 672 to 560 px. The upload panel now has
  approximately 100 px clearance below the format cards on desktop.
- Fixed invalid token/opacity border combinations in the hero and margin guides by using explicit
  alpha colors. Rings now render at 4.5–6% opacity rather than inherited bright foreground white.
- The approved workflow cards, generated images, benefit row, pricing, and footer markup compare
  exactly with the previous commit. Extracted hero styling into ConversionHero.tsx / .css.
- Verification: workspace typecheck and production web build passed. Chrome checks at widths 320,
  390, 768, 1024, and 1440 verify that copy and animation do not overlap, all hero content remains
  within the viewport, and the upload card clears the format cards. Format cycling, pause/resume,
  and reduced-motion checks passed. Screenshots and measurement output are saved in
  `docs/evidence/hero-spacing/`.

# Plain hero background and approved button palette — 2026-09-20

- Removed the hero's gray gradient and grid overlays, exposing the site's charcoal background and
  continuous left/right desktop margin guides. Increased dashed guide opacity from 7% to 18%.
- Per the owner's button reference, replaced the hero's muted rose colors with the exact existing
  primary gradient endpoints (#FF006E and #FF6B35). The upload button and eyebrow use
  `--gradient-primary`; converter accents, connector sweeps, and glow use the same palette.
- Production build (including web TypeScript) passed. Chrome at 1440 and 390 px confirmed the
  upload and pricing button gradients match exactly, the backdrop overlay is absent, and no
  horizontal overflow occurs. Desktop guides are visible and dashed. Screenshots and computed
  style evidence are in `docs/evidence/hero-brand-colors/`.

# Character-wave hero and dark upload card — 2026-09-20

- Increased desktop outer spacing around the dashed page guides: guide max-width is now 1240 px,
  with content capped at 1184 px and 28 px clearance inside each guide at full desktop width.
- Added an original, faint animated character-wave canvas behind the hero, inspired by the owner's
  AgentMail screenshot. The public AgentMail page was readable, but its browser verification
  blocked live animation inspection; this is a reference-inspired implementation, not an exact copy.
- Canvas rendering is capped near 16 fps and pauses when offscreen or the tab is hidden. The hero
  pause control now controls both animations; reduced-motion preferences render a static backdrop.
- Restyled the upload card as a 640 px charcoal surface with a subtle gradient edge, a bordered
  icon badge, larger spacing, and the approved #FF006E → #FF6B35 primary action gradient.
  Existing copy and the /signup destination remain unchanged. This session verifies presentation,
  not upload processing. Existing workflow images, benefits, pricing, and footer markup are intact.
- Evidence: production web build and workspace typecheck passed. Chrome screenshots at 320, 390,
  768, 1024, and 1440 px show no horizontal overflow and clearance between the converter and card.
  Real canvas pixel comparisons verify animation, pause, resume, and reduced-motion behavior;
  browser checks reported no page errors. See `docs/evidence/hero-character-background/`.

# Guest processing and download access — discovery, 2026-09-20

- Owner requested upload and processing before registration, with authentication/payment at
  download; free access is one video per day, maximum 100 MB. Owner also requested importing the
  entire authentication flow from their licensed repository. These instructions supersede the
  earlier product assumptions of mandatory registration before upload and three free jobs/day.
- Inspected API upload/job routes, browser auth/upload/result code, entitlement migration 0007,
  and storage policies 0008. Current upload, job creation, and result routes require a user JWT;
  the frontend protects upload/results behind RequireAuth. Result reads immediately issue signed
  download URLs. Storage member SELECT policies independently allow direct output reads, so a
  button-only gate would be bypassable.
- The current daily quota counts processing attempts, not distinct downloadable videos. Reducing
  that counter alone would block processing before the requested download-time decision. The
  implementation needs atomic per-account download grants, idempotent repeat downloads, and
  corresponding private-output storage enforcement. Guest ownership must survive login without
  allowing another visitor to claim the same job. Existing 100 MB upload checks occur at session
  creation and against actual storage size during finalization.
- Local discovery: all 13 project-scoped containers are running; no infrastructure was changed.
- BLOCKER AUTH-SOURCE: the licensed repository URL/branch was not supplied. Asked the owner for
  it; cannot copy or verify an identical source flow until the repository is identified.
- BLOCKER DOWNLOAD-CHECKOUT: no checkout implementation is present. Asked whether the licensed
  repository includes the intended checkout, otherwise provider and price are required. No
  checkout, paid entitlement, or payment-success behavior has been invented.
- No runtime code, quota, database, or deployment change has been made in this discovery session.
  Next: inspect the supplied source and license, map its auth/session/payment dependencies, import
  the authorized flow, then implement and test guest processing, ownership handoff, download
  grants, storage access denial, one-video daily concurrency, 100 MB enforcement, and return to
  the completed result after login. Verify payment webhooks with the selected provider before
  enabling paid downloads.

# Guest download gate and Zahoro auth import — implementation, 2026-09-20

- Owner supplied `yusosadick/zahorozanzibar`; imported its progressive auth screens, UI components,
  imagery, recovery flow, and email lookup at revision 2fd32cf. Retained Apache-2.0 attribution
  under `third_party/zahorozanzibar/`. Adapted Hasheem branding/session configuration and exact
  video return destinations. Verification now requires a real verified user rather than URL shape.
- Added private hashed guest capabilities, bounded guest session/upload/processing admission,
  ownership-checked resumable upload proxy, idempotent finalize/job retries, and public upload/result
  routes. Metadata no longer includes signed download URLs.
- Added atomic account-scoped download grants: free accounts unlock one distinct video per UTC
  day; repeat downloads of that job do not spend another allowance. Raw output reads and client
  signing are blocked by storage RLS. 100 MB file checks remain on creation and finalization.
- Migrations 0013 and 0014 are pending verification. API/web TypeScript checks pass. A real-stack
  integration test is ready at `tests/integration/guest-download-gate.mjs`; results will follow.
- Paid checkout is not implemented in either inspected source flow. Provider, price, and real
  credentials remain required. The daily-limit response explicitly reports checkout unavailable;
  no fake checkout or paid-success path is exposed. Google UI is disabled until Supabase reports
  that provider enabled. VPS handoff will cover provider setup and end-to-end verification.

# Guest download gate verification and VPS handoff — 2026-09-20

- Applied migrations 0013 and 0014 through `pnpm db:local:migrate` on the real dedicated Mac stack;
  runner verified bootstrap marker `hasheemstudio`, all 14 ledger versions, zero pending/drifted
  versions, and schema digest `56d2bd5253581c1d`. This is LOCAL evidence, not a VPS migration claim.
- Real local integration passed 11 checks: guest TUS upload/worker processing, 100 MB admission,
  retry idempotency, anonymous/cross-account denial, processing before download decisions, atomic
  one-video concurrency, repeat download, UTC reset, expired outputs, progressive email lookup,
  and raw storage read/self-sign denial including authenticated workspace owners.
- Real Chrome flow passed: guest uploads/processes, existing-email/password login returns to the
  exact result, button downloads 82,239 real bytes as `hasheem-video.mp4`, a second signed-in direct
  TUS upload processes but download hits the free daily limit, logout works, and new-email signup
  shows the copied form on mobile with no overflow. Invalid reset/verification URLs correctly fail.
  Browser evidence and screenshots are in `docs/evidence/guest-download-gate/`.
- First successful guest download now atomically adopts the complete guest workspace for that
  account (membership plus created_by references) and invalidates the old guest capability. This
  keeps the account-deletion ownership/cascade model intact and prevents claims by another account.
- Existing upload/remux/encode browser test expectations were updated to the new explicit download
  endpoint/action. Those older full suites have not been rerun this session; the new real-stack
  integration and browser suites above, workspace typecheck, and production frontend build pass.
  Production build emits a non-failing >500 kB bundle-size warning after importing auth dependencies.
- Dedicated test servers used localhost ports 8788 and 5174; disposable users, jobs and stored test
  files were cleaned up. A temporary project API log was moved into ignored `tmp/`. Git identity was
  restored repository-locally to the previous MAC commit identity after hostname auto-detection failed.
- AUTH-SOURCE blocker resolved with the supplied repository and attributed source import.
  Payment checkout still requires an owner-selected processor/price/credentials. Real production
  signup inbox receipt, Google consent/callback, password-reset delivery, and deployment remain VPS
  tasks; do not label these verified from the local tests. No VPS resources were changed here.
- Copy-ready deployment instructions: `docs/VPS-GUEST-DOWNLOAD-HANDOFF.md`. This includes coordinated
  API/frontend rollout, exact migration target discovery, trusted-proxy configuration, public upload
  safeguards, recovery redirect/OTP setup, remaining payments and retention checks, and evidence.

# VPS guest-download rollout — 2026-09-20

- [VERIFIED-LIVE] Fast-forwarded the VPS checkout to the exact pushed `origin/main` SHA
  `11d726037767d47ba7dfa5fa6d86bff9438c74ba`; local `HEAD` and `origin/main` matched before
  deployment. The working tree was clean at the start.
- [VERIFIED-LIVE] Confirmed the target database marker is `hasheemstudio`, reached through the
  dedicated project's Supavisor session port (`127.0.0.1:55432`), not another Supabase project.
  Applied `0013_guest_processing_download_grants.sql` and `0014_progressive_auth_email_lookup.sql`
  with the repository runner against the project-scoped VPS database. Live verification returned
  all 14 migrations, zero pending versions, zero checksum drift, schema digest `56d2bd5253581c1d`,
  all expected tables and RLS enabled.
- [VERIFIED-LIVE] Built and replaced only `hasheemstudio-api` and `hasheemstudio-web` together
  from SHA `11d7260`; the worker, Supabase services, Coolify and unrelated containers were not
  restarted. API and web containers became healthy. Production web build and full workspace
  typecheck passed. The web build retains a non-failing bundle-size warning (main JS about 680 KB).
- [VERIFIED-LIVE] Public boundary checks passed after rollout: `https://hasheemstudio.com/`
  returned HTTP 200; `https://api.hasheemstudio.com/health/live` and `/health/ready` returned
  `{"status":"ok"}`; Supabase Auth health returned a real GoTrue response over HTTPS.
- [VERIFIED-LIVE] `TEST_API_URL=https://api.hasheemstudio.com pnpm test:guest-download` passed all
  11 live checks: 100 MB admission, guest resumable upload, worker processing, idempotent retries,
  anonymous/cross-account denial, processing before download gating, atomic one-video concurrency,
  repeat-download behaviour, locked-output storage protection, UTC reset, expired-output denial and
  progressive email lookup. Disposable fixtures/users/files were cleaned by the test.
- [VERIFIED-LIVE] `TEST_WEB_URL=https://hasheemstudio.com pnpm test:guest-browser` passed the real
  Chromium journey: guest upload/process, progressive login, return to the same result, download,
  logout, signup layout and invalid-auth-link handling. This includes the mobile viewport path; the
  regenerated screenshots are retained under `docs/evidence/guest-download-gate/`.
- [BLOCKED — OWNER INPUT] Live Supabase Auth settings report `external.google=false` and
  `external.email=true`, with email confirmation required. Email configuration is present, but
  physical inbox receipt still needs an owner-approved inbox check. Google OAuth cannot be enabled
  without an approved Hasheem Google OAuth client ID/secret and exact production redirect setup;
  no credentials were invented or borrowed from another project.
- [BLOCKED — OWNER INPUT] Paid checkout remains intentionally disabled. No approved processor,
  prices, credentials, webhook secret or legal billing terms exist in the repo or protected project
  environment. The API correctly reports `checkoutAvailable:false` at the free daily limit. No
  payment-success path was fabricated. Once the owner supplies the processor/pricing, implement
  verified idempotent webhooks and entitlement reconciliation before enabling paid downloads.
- [NOT DONE] Independent inbox receipt, Google consent/callback, paid checkout and final owner
  visual approval remain open. This rollout proves the VPS guest-download release, not those
  external-account gates.
- [VERIFIED-LIVE] After the first live run, inspected the shared Coolify proxy as `10.0.1.6` on
  the project ingress network and set the project environment's nonsecret `API_TRUST_PROXY=10.0.1.6`.
  Recreated only the API, confirmed the container received that exact setting and became healthy.
  Re-ran the live API guest suite (11/11) and live Chromium guest suite successfully afterward.
- [VERIFIED-LIVE] Fixed the signed-in header CTA regression: anonymous users see `Get Started`,
  authenticated users see `Open workspace`. The browser evidence now asserts both states.
- [VERIFIED-LIVE] Restored the Hasheem Gaming wordmark asset in the current auth shell after a later
  auth/layout change had overwritten it with the old grid icon. The live Chromium auth screenshot
  now shows the wordmark and the landing-style auth background/form.
- [VERIFIED-LIVE] Fixed the remux recipe to map only the first video and optional first audio stream,
  excluding data/attachment streams that caused a real FFmpeg `Error initializing output stream`
  failure on a MOV with an additional stream. The live guest API and browser suites passed after
  the worker deployment. Exact previously failed user media was not retained, so that original
  file was not reprocessed.
- [VERIFIED-LIVE] Added public `robots.txt`, `sitemap.xml`, canonical/meta/Open Graph/Twitter SEO
  metadata and no-index rules for authenticated routes. Verified live at `https://hasheemstudio.com/`.

## Homepage inline upload — 2026-09-22

- [IMPLEMENTED] `apps/web/src/hooks/useVideoUpload.ts`: the upload/processing state machine
  (file validation, resumable TUS upload wiring, finalize, job creation, real job-status polling,
  cancel handling) extracted out of `Upload.tsx` so both the homepage hero and `/app/upload` run
  the same tested logic. `Upload.tsx` now consumes it and is behaviourally unchanged (navigates to
  `/app/jobs/:id` as soon as the job exists). Found and fixed one real gap while writing it: a
  cancel requested during `createUploadSession`'s round trip (before any fetch was listening on the
  `AbortSignal`) was previously silently ignored — now checked explicitly.
- [IMPLEMENTED] `ConversionHero.tsx`/`.css`: "Choose video" on the homepage no longer navigates to
  `/app/upload` — it's a plain button opening a hidden `<input type=file>` in place, and the drop
  zone now also accepts drag-and-drop. Selecting a file swaps the hero card (framer-motion
  crossfade) to a processing view: file name/size, a progress bar bound to real
  `uploadFileResumable` byte counts (percentage + "X MB / Y MB", never simulated), a terminal-style
  scrolling log built only from real stage transitions (uploading → finalizing → queuing → the
  actual polled job status through processing/verifying), and a Cancel button wired to
  `useVideoUpload`'s abort/cancel-job logic. Recipe selection (remux/compat_encode/inspect) moved
  inline above the drop zone, matching `Upload.tsx`'s existing radio design. On a terminal
  succeeded/failed/expired status the page navigates to `/app/jobs/:id`, reusing `JobResult`'s
  existing download-gate/sign-in-gate/verification-report UI rather than duplicating it; a
  user-cancelled upload returns straight to the idle card, ready for a new file immediately. Uses
  only existing design tokens (dark surfaces, `--gradient-primary`, existing border/radius) — no
  new colors or copy borrowed from the RTXFury reference used for feel only. `/app/upload` itself
  is untouched and still works as a direct-link/bookmark fallback.
- [TESTED-LOCAL] `pnpm typecheck` (all 3 workspaces), `pnpm --filter @hasheemstudio/web build`,
  `pnpm test` (unit, 5/5), `pnpm test:guest-download` (11/11 API-level), `pnpm test:e2e:resumable`
  (12/12, confirms the resumable-upload/RLS logic in `lib/upload.ts` is unaffected),
  `pnpm test:e2e:browser` (8/8, confirms `/app/upload`'s own dedicated flow — including the
  post-login redirect into it — is unaffected), `tests/e2e/accessibility.mjs` (27/28 → 27/27 no
  regressions, includes the new hero card) and `tests/e2e/landing-auth.mjs` (21/21) all passed
  against the local dedicated stack before deployment.
- [TESTED-LOCAL] Discovered while setting up local browser testing (not a code bug, an environment
  note for future agents): `/etc/hasheemstudio/local.env`'s `PUBLIC_API_URL` is the production API
  URL (correct — it's baked into the containerized web build's `VITE_API_URL` build arg), but
  `pnpm dev`'s bare-host Vite dev server also reads that same file and inherits it, so a plain
  `pnpm dev` on this VPS points its browser client at the *production* API (real CORS failure, not
  a bug in this change). Worked around for this session's local testing with a temporary copy of
  the env file (only `PUBLIC_API_URL` overridden to `http://127.0.0.1:8787`) passed via
  `HASHEEMSTUDIO_ENV_FILE`, kept outside the repo; `dev.mjs` itself was not changed.
- [VERIFIED-LIVE] `tests/e2e/guest-auth-browser.mjs` updated to drive the new inline flow (clicks
  the "Choose video" button and drives Playwright's `filechooser` event instead of navigating to
  `/app/upload` first) and extended with two new real checks: the guest 100 MB limit is still
  enforced inline with no navigation and no real upload attempted (a real sparse temp file is used
  since Playwright caps in-memory `setFiles` buffers at 50 MB), and cancelling mid-upload actually
  aborts the in-flight transfer and returns to the idle card immediately, ready for a new file. Ran
  against the live production stack: `TEST_WEB_URL=https://hasheemstudio.com node
  tests/e2e/guest-auth-browser.mjs` — full guest journey passed (100 MB rejection, cancel-and-retry,
  real guest upload/process entirely on `/`, progressive login, return to the exact result, real
  download of 82,239 bytes, daily-limit gate, logout, signup layout, invalid auth links). Evidence:
  [browser.json](evidence/guest-download-gate/browser.json),
  [live mid-upload screenshot](evidence/guest-download-gate/hero-processing.png) (captured against
  `https://hasheemstudio.com`, not a local mock).
- [VERIFIED-LIVE] Deployed by building only `hasheemstudio-web` from pushed
  `74e2dab5a6b02482fb7ee8eb5be45df6d83acb85` (local `HEAD` and `origin/main` matched before and
  after) and recreating it with `--no-deps --force-recreate`; it came up healthy. Every other
  `hasheemstudio-*` container, Coolify, and every unrelated project's containers on this shared host
  were confirmed unchanged (`docker ps` before/after). `https://hasheemstudio.com/` and
  `https://api.hasheemstudio.com/health/live` both returned 200 after the recreate.
- [VERIFIED-LIVE] Fixed a real, separately-reported bug found this session: `LoginPage.tsx` never
  checked for an existing session, so a signed-in visitor clicking the pricing section's "Get
  started free" link (a plain `<a href="/signup">` that doesn't check auth state, which itself
  redirects into this same page) landed back on the sign-in form instead of the app. It now
  redirects an already-signed-in visitor straight to their next/stored return path (default
  `/app/upload`) on mount. Verified against both local and live production: sign in, click "Get
  started free" from pricing, land on `/app/upload` — not the login form.
- [VERIFIED-LIVE] Added a real favicon (`<link rel="icon">`/`apple-touch-icon`) — none existed
  anywhere in `index.html` before this. Uses the already-approved Studio script wordmark (the same
  asset already used in the nav), not any legacy "Hasheem Gaming" asset — this project has been
  actively removing that branding from Studio's own UI, and `tests/e2e/landing-auth.mjs` already
  asserts zero `img[alt="Hasheem Gaming"]` elements. Verified live: `<link rel="icon">` present and
  the referenced asset returns 200 at `https://hasheemstudio.com/`.
- [NOT DONE] No dedicated component/unit-test framework exists for `apps/web` (no vitest configured,
  `apps/web/package.json` has no `test` script) — coverage for this change is the real Playwright
  browser suites above, not isolated component tests. Only the remux recipe / resumable-upload /
  guest-download suites were re-run as regression checks; `compat_encode`'s own e2e suite and the
  load-test suites were not re-run this session (unrelated to this frontend-only change, and the
  full worker/API pipeline they exercise is untouched by it).

## Worker verification-failure messages, H.264 level fix, remux hardening — 2026-09-22

Triggered by a real user report of `Output verification failed: decodeOk=true durationOk=false`
plus a separate complaint that a previous output "looked scratching" and a request to check global
platform-compatibility. Diagnosed against the real failing job in the live DB, not guessed.

- [VERIFIED-LIVE] Root-caused the exact reported failure: pulled the actual failed job
  (`7db30d29-40b3-498e-84cf-7dc682fc8204`) from the live database and downloaded the real input
  object still in storage, then ran it through the worker's own `probe`/`remux`/`decodeCheck`
  functions directly. Real finding: a 3840x2160 HEVC file with no audio track, where FFmpeg's
  `-c copy` stream copy hit `Packet corrupt (stream = 0, dts = 31031)` then `EOF while reading
  input` at ~1.07s into a real 5.14s recording — the source container is genuinely
  corrupted/truncated at the demux/sample-table level, not an edit-list or negative-timestamp
  artifact. Confirmed this is not fixable by choosing a different recipe: a full decode+re-encode
  (`compat_encode`'s own pipeline) hits the identical "EOF while reading input" wall on the same
  file, since the corruption is upstream of decoding entirely. Verification correctly refused to
  publish the silently-truncated 1-second output as if it were the full 5 — that fail-closed
  behavior is correct and was **not** weakened.
- [IMPLEMENTED] `jobs.error_message` (shown directly to the user on the job result page,
  `apps/web/src/pages/JobResult.tsx`) is no longer the raw internal check string. It now
  distinguishes: a detected source-file corruption/truncation (honest message, real measured
  durations, told to re-export/re-upload — **not** told it's our fault, since it verifiably isn't
  for this class of failure), a generic decode/duration-verification failure (told to re-upload or
  try the other recipe), and our own encode step producing the wrong codec/dimensions (told it's
  likely a bug on our end, not the file). `apps/worker/src/ffmpeg.ts` now captures FFmpeg's own
  stderr from `remux`/`compatEncode` and scans it for corruption markers
  (`looksLikeSourceCorruption`) to tell these apart.
- [VERIFIED-LIVE] Reprocessed the real failing input through the live API end to end after
  deploying the fix (fresh disposable test account, same file, `recipe: "remux"`): job correctly
  reaches `failed`, and `errorMessage` now reads *"Your video file appears to be corrupted or
  incomplete — only about 1.1s of the original 5.1s could be read. This isn't something we can fix
  on our side; please try re-exporting or re-recording the video and upload the file again."*
- [IMPLEMENTED] `compat_encode` hardcoded `-level 4.1`, but Level 4.1's MaxMBPS constraint
  (245,760 macroblocks/sec) only covers 1080p up to ~30fps — the product's own advertised spec is
  1080p60. Verified directly: libx264 encoding a real 1080p60 source with the old settings warns
  `MB rate (489600) > level limit (245760)` while still tagging the output stream as level 41 —
  i.e. a stream that misreports its own conformance, exactly the kind of mismatch strict hardware
  decoders and platform ingest validators reject or mis-decode (a plausible cause of the separately
  reported "scratching" playback). Raised to Level 4.2 (MaxMBPS 522,240, same essentially-universal
  device support as 4.1); the same real 1080p60 source now encodes with zero libx264 warnings and
  correctly reports level 42.
- [IMPLEMENTED] `compat_encode` also now sets a real ~2 second closed GOP (`-g`/`-keyint_min` sized
  from the actual probed source frame rate, `-sc_threshold 0` to stop scene-cut detection from
  moving keyframes) instead of libx264's default ~250-frame GOP (4-8+ seconds at typical frame
  rates) — short, predictable, seekable segment boundaries are what major platforms' ingest/
  transcode pipelines expect. Also standardizes audio to `-ar 48000` rather than passing through
  whatever sample rate the source declared. Verified directly on a real 1080p60 encode: keyframes
  land at exactly 0.033s and 2.033s (was governed by libx264's un-set default before).
  `remux()` gets `-avoid_negative_ts make_zero` — standard, zero-cost practice for the separate,
  real class of duration/sync bugs caused by A/V streams not both starting at PTS 0 on stream copy;
  confirmed it does not regress the healthy-file case (remux duration delta on the committed test
  fixture: 0.067s, well within tolerance).
- [VERIFIED-LIVE] Deployed by building only `hasheemstudio-worker` from pushed
  `056a6f4ce7ef0b760d50ef43839f96da2e6f2321` and recreating it with `--no-deps --force-recreate`;
  came up healthy. No other container touched. `pnpm typecheck` clean;
  `tests/e2e/compat-encode.mjs` (8/8), `tests/e2e/upload-to-download.mjs` (14/14),
  `tests/integration/hostile-media-inputs.mjs` (8/8 — still correctly ends genuinely hostile input
  in `failed`, never fakes success) and `tests/integration/worker-crash-recovery.mjs` (6/6) all
  passed against the live worker after the redeploy.
- [NOT DONE] No SSIM/VMAF or other perceptual-quality scoring exists (unchanged from before this
  session — `qualityMetric: "not_computed"` is reported honestly, not fabricated). The "scratching"
  complaint is addressed via the H.264 level-conformance fix above, which is a real, verified
  encoding-correctness bug; it was not possible to independently reproduce visible frame corruption
  from the level-41-on-1080p60 case locally (no non-compliant decoder available to test against) —
  the fix is justified by the demonstrated bitstream non-conformance itself, not by directly
  observing "scratching" before/after.

## Download truncation on slow connections — real root cause found and fixed, 2026-09-22

**A follow-up production bug report said the prior fix (`2c683bfc`, same day — signed-URL expiry
300s → 7200s) did not fully resolve the issue.** Investigated as instructed: from scratch, assuming
the prior fix addressed *a* cause, not necessarily *the* cause. It was partial. Full raw evidence:
[docs/evidence/download-truncation-fix/results.json](evidence/download-truncation-fix/results.json).

- [VERIFIED-LIVE] **Root cause found via the servers' own logs, not inferred from config alone.**
  The Envoy gateway's `/storage/v1/` route (every signed download goes through this) had
  `timeout: 30s`. This is the timeout for the *entire* request, not time-to-first-byte. Direct
  evidence: the Supabase Storage service's own structured log shows `"ABORTED REQ"` at
  `responseTime: 30004.82ms` for a real throttled download; Envoy's own access log for that
  identical request shows a `"200"` response having sent only `15,204,352` of a real
  `58,592,373`-byte file — Envoy finished the downstream response as if it had succeeded once its
  30s budget ran out, instead of surfacing an error. A file near the 100 MB guest limit takes
  minutes on a real slow connection (300 kbit/s ≈ 27 minutes for 58 MB), so this guaranteed
  truncation for exactly the users who most need reliable delivery.
- [VERIFIED-LIVE] **Reproduced the exact user-reported symptom end to end**, with a real Chrome
  browser (Playwright + genuine CDP `Network.emulateNetworkConditions` throttling at 300 kbit/s
  down / 250 ms latency) driving the actual production download UI against a real 58.6 MB 4K HEVC
  output: the page shows "Job complete" / "Download video" with **zero error anywhere**,
  `download.failure()` returns `null`, Chrome's own download manager reports success — but only
  `11,897,584` of `58,592,373` bytes land on disk. `ffprobe` on that truncated file reports the
  *correct* full duration/frame count (the `moov` atom, placed at the front by `+faststart`,
  finished downloading before the truncation hit later in `mdat`), but a real `ffmpeg` decode
  **fails**: `Invalid NAL unit size (814529 > 62144)` / `Error splitting the input into NAL units`
  / `Decoding error: Invalid data found when processing input` — the exact class of corruption that
  gets a file rejected by VLC and WhatsApp, confirming both halves of the original report.
- [IMPLEMENTED] `infra/compose/volumes/api/envoy/lds.template.yaml`: storage route `timeout`
  `30s` → `7200s` (matches `DOWNLOAD_URL_EXPIRY_SECONDS` in `apps/api/src/routes/downloads.ts`, so
  neither the signed URL's own expiry nor this route timeout binds before the other). Listener
  `per_connection_buffer_limit_bytes` `32768` → `1048576` (Envoy's own documented 1 MiB default —
  32 KiB forced near-constant flow-control stalls on any large response, eating into the timeout
  budget even faster).
- [VERIFIED-LIVE] **Other candidate causes explicitly checked and ruled out, not assumed clear:**
  Cloudflare (DNS-only/grey-cloud for this domain — `hasheemstudio.com`, `api.hasheemstudio.com`,
  `supabase.hasheemstudio.com` all resolve directly to the VPS's own IP via `dig`; Cloudflare is not
  in the request path at all). `apps/web`'s nginx (not in the download path — signed URLs point
  straight at `supabase.hasheemstudio.com`, bypassing `apps/web` entirely). HTTP Range/206 handling
  (tested directly end to end through the full public chain: correct `206`, correct
  `Content-Range`, and the returned bytes verified byte-for-byte identical via `cmp` against the
  same slice of the source file). Client-side Content-Length validation (Chrome's underlying network
  request *did* fail — CDP `Network.loadingFailed`, `net::ERR_ABORTED` — but its download manager
  still reported success; this is real browser behavior outside the app's control once the server
  itself closes the response as a normal `200`, and there's no reliable client-side hook to catch it
  after the fact given the app's `window.location.assign()`-based direct-navigation download —
  fixing the server-side timeout so the connection is never killed mid-transfer is the correct and
  sufficient fix, not a client-side workaround).
- [VERIFIED-LIVE] Deployed by recreating only `hasheemstudio-envoy` (`--no-deps --force-recreate`)
  from pushed `bbffc09bd0f8600fa4e54a8a25afdc39228b87d3`; came up healthy, config confirmed rendered
  correctly inside the container. No other container touched (`docker ps` confirmed before/after,
  including all unrelated shared-host services).
- [VERIFIED-LIVE] **Full mandatory post-fix proof, repeated at two throttle profiles, both real
  browser and raw-HTTP mechanisms** (all against the live `https://hasheemstudio.com` /
  `supabase.hasheemstudio.com`, using genuine kernel-level traffic shaping — `tc`
  `tbf`+`netem` via an IFB device, isolated entirely inside a throwaway Docker container's own
  network namespace via `--cap-add=NET_ADMIN`, never applied to the shared host's real interface):
  - **1 Mbit/s / 100 ms, raw HTTP**: `size_download=58592373` (exact), `time_total=495.4s`, sha256
    exactly matches the original source, clean `ffmpeg -v error` decode (zero stderr), all 5
    extracted frames (0/25/50/75/99%) visually confirmed clean, VLC exit code 0 with no
    corruption-related output.
  - **300 kbit/s / 250 ms, real Chrome browser** (the exact profile and exact mechanism that
    produced the truncated/corrupted file before the fix): `saveAs` elapsed `1565.1s`
    (~26 minutes), `download.failure()` null, saved file `58592373` bytes (exact), sha256 exactly
    matches, clean `ffmpeg` decode, VLC exit code 0, no corruption warnings.
  - **300 kbit/s / 250 ms, raw HTTP** (same profile as the original pre-fix reproduction):
    `size_download=58592373` (exact), `time_total=1642.3s` (~27 minutes), sha256 exactly matches,
    clean `ffmpeg` decode.
  - A VLC binary did not exist in this environment; built one headless (`vlc-bin`+
    `vlc-plugin-base` on `debian:bookworm-slim`, run as non-root with `--intf dummy --vout dummy
    --aout dummy`) specifically for this verification. Its "Could not find ref with POC N" /
    "late frames" warnings on the downloaded files were confirmed to be a software-4K-HEVC-decode
    real-time-performance artifact of this constrained container — the identical warnings appear on
    the known-clean, never-downloaded original source file, not something introduced by the
    download.
  - Disposable test accounts used for this investigation were deleted afterward via the GoTrue
    admin API.

## Platform-optimize recipe — 2026-09-25

Motivation (owner): remux preserves the source bitrate, so a ~91 Mbps 4K HEVC drone clip stream-copies to a ~58 MB file — mathematically correct, but it defeats the product's purpose because TikTok/Instagram/WhatsApp recompress oversized uploads on their own terms. Full design, sources and numbers: [ARCHITECTURE.md "Platform-optimize recipe"](ARCHITECTURE.md); raw data: [docs/evidence/platform-optimize/](evidence/platform-optimize/results.json).

- [VERIFIED-LIVE] **Migration 0016** (`job_recipe` enum + `plans.allowed_recipes`) applied by the repository runner from pushed `0c09272` after an encrypted backup: `plan` showed exactly one pending migration, no drift; `verify` returned `noPendingOrDrift: true`; a direct read-back shows the enum values `inspect, remux, compat_encode, platform_optimize` and both real plans (`verified_free`, `pro_beta`) allowing it.
- [VERIFIED-LIVE] Rebuilt and recreated only `hasheemstudio-worker` and `hasheemstudio-web` (`--no-deps --force-recreate`); both healthy, all other containers untouched; `https://hasheemstudio.com` and the API health endpoint return 200. The recipe is selectable on `/` and `/app/upload` (default unchanged: Compatible MP4 remux).
- [VERIFIED-LIVE] **Four real sources through the production API/queue/worker/download gate, each succeeding on the first attempt**, outputs independently re-verified (fresh `ffmpeg -v error` decode: empty stderr and exit 0 for all four; ffprobe: H.264 Main, no B-frames, yuv420p, AAC-LC 48 kHz stereo where audio existed, duration within 22 ms of the source, frame counts identical):

  | Source | In → Out (bytes) | Reduction | Ceiling / achieved | VMAF (worst frame) / SSIM |
  |---|---|---|---|---|
  | 4K drone 29.97 fps HEVC, portrait (58.6 MB) | 58,592,373 → 5,138,861 | 91.2% | 8000 / 8001 kbps | 74.2 (58.1) / 0.955 @1080p; 48.8 vs 4K ref |
  | natural 1080p30 (Xiph dinner) | 31,079,695 → 5,974,735 | 80.8% | 8000 / 4767 kbps | 95.6 (88.2) / 0.997 |
  | real 1080p60 (BBB, source already 4.2 Mbps) | 7,643,986 → 4,685,920 | 38.7% | 3771 / 3728 kbps | 87.3 (59.0) / 0.993 |
  | hard 1080p50 (Xiph crowd_run) | 82,758,928 → 10,816,920 | 86.9% | 10667 / 10788 kbps | 75.6 (64.8) / 0.976 |

  Worker-measured encode times 23.9 / 17.8 / 23.1 / 27.9 s against the time model's 28 / 24 / 49 / 32 s predictions.
- [TESTED-LOCAL/NOT A CLAIM OF TRANSPARENCY] **Quality honesty:** only the natural 1080p30 source clears VMAF 93 (cited "indistinguishable or noticeable but not annoying", Rassool 2017) / 95 ("subjectively indistinguishable", Kah et al. 2021). The other three do not, and this is the expected cost of a bitrate ceiling on hard content: reaching VMAF 93 would need ~3.4 Mbps for typical natural 1080p30 but ~20 Mbps (drone at 1080p) and ~24 Mbps (crowd_run) — several times any published or recommended platform bitrate — and an already-compressed 4.2 Mbps source cannot be re-encoded smaller at >= 93. Whether to raise the ceilings is an owner decision (DECISIONS.md). The 6-point JND and the 93/95 statements are cited; the Netflix VMAF FAQ itself defines no score bands.
- [VERIFIED-LIVE] **Latent `compat_encode` bug found and fixed:** a real job on the 4K portrait clip (3840x2160 + rotation 90) failed on the previous worker with "output dimensions grew beyond the source" after 698 s (3 attempts), because the check compared coded size to the autorotated output. The same clip now succeeds (180 s, `dimensionsPreserved: true`). Its output is 61.5 MB — larger than the 58.6 MB source, which is why it is not a substitute for the new recipe.
- [TESTED-LOCAL] Measurement pitfall recorded: scoring frames by timestamp reported false VMAF drops (crowd 27, bbb 75) because the no-edit-list output is shifted ~21 ms (one AAC priming block) after the first frame; frame counts were identical. `tests/eval/quality-compare.mjs` now pairs by frame index and refuses to score if frame counts differ.
- [TESTED-LOCAL] Existing suites against this change: `pnpm typecheck` (api/worker/web) clean; `pnpm test` 22/22 (5 api + 17 new worker planning tests); `pnpm test:guest-download` 11/11 (real stack, after migration and worker deploy); `tests/e2e/guest-auth-browser.mjs` passed (real Chromium, guest upload → process → login → download).
- [NOT DONE / LIMITS] Per-job VMAF is not computed (the production ffmpeg has no libvmaf); HDR sources are refused rather than tone-mapped; no natural 60 fps source was available (1080p60 is animation, 1080p50 is natural); the drone fixture is 4K **29.97 fps**, not 4K60; 4K clips longer than the time model allows are refused up front; recipe default remains remux; the effect on real TikTok/Instagram/WhatsApp ingest was not (and cannot be) tested from here.

## Default recipe + HDR (iPhone) support — 2026-09-25

- [VERIFIED-LIVE] **`platform_optimize` is now the default** on `/` and `/app/upload` (listed first, preselected). Real Chromium on `https://hasheemstudio.com`, signed in, choosing the real 4K drone clip on the homepage **without touching the recipe selector**, downloading through the real button: **58,592,373 → 5,152,844 bytes (−91.2%)**, result badge "Platform-optimized H.264/AAC", independent check: H.264 Main, 1080x1920, 8.0 Mbps, 5.138 s, clean decode (`tests/e2e/default-recipe-browser.mjs`).
- [VERIFIED-LIVE] **HDR→SDR tone-mapping** replaces the interim "HDR falls back to remux" (which shipped for about an hour). Four real production jobs, all succeeded: synthetic iPhone-style HLG and PQ MOVs (2 audio tracks, portrait) and two REAL HDR10 4K clips. Outputs independently checked: H.264 Main, 8-bit, tagged BT.709, one audio track (TrueHD converted to AAC), clean decode. Sizes: 29.0→5.3 MB, 16.7→5.3 MB, 10.0→0.86 MB, 12.0→1.5 MB. Evidence: [hdr-runs.json](evidence/platform-optimize/hdr-runs.json) plus a naive-vs-tone-mapped frame pair.
- [TESTED-LOCAL] Colour correctness: real HDR10 frame — naive conversion grey/flat, tone-mapped has proper contrast/colour; exact-inverse plumbing test HLG VMAF 98.3 / PQ 86.7. A first draft of the fidelity test scored the (non-inverse) hable curve against the SDR original and reported VMAF ~11; that test design was wrong and was replaced.
- [TESTED-LOCAL] Time model: HDR runs predicted 20/20/33/46 s vs actual 39.6/27.4/22/31 s; HDR estimates are now ×2. Suites after the change: typecheck clean; unit 25/25; `test:guest-download` 11/11; `guest-auth-browser` pass; `test:e2e:browser` 8/8.
- [NOT DONE / LIMITS] **No real iPhone file was tested** (only iPhone-style synthetic HLG/PQ and real PQ HDR10); Dolby Vision RPU ignored; tone-map curve is a look choice judged by eye + plumbing test; tiny already-low-bitrate sources can come out slightly larger (an 82 KB test clip became 155 KB because of the 516 kbps floor and 128 kbps audio) and the report states the negative reduction; quality figures (only 1 of 4 sources ≥ VMAF 93 at its ceiling) are unchanged.

## Result UX, output naming and report redaction (2026-09-25)
- Downloads are named `hasheemstudio_YYYYMMDD_HHmmss.mp4` (client local time; server validates the exact shape, falls back to UTC report time). Live proof: `tests/e2e/default-recipe-browser.mjs` asserts the browser's `suggestedFilename` against the real domain.
- The browser no longer receives the raw verification report. `/v1/jobs/:id` returns an allow-listed report plus a 4-fact `summary` (size change, format, playback verified, social-ready). Plan/CRF/preset/bitrates/timings/tool versions/checksums stay in the DB. Live check: response contains none of crf/preset/vbv/maxrate/gop/sha256/tool_versions/x264/ffmpeg.
- The result and Download button render on the homepage in the upload card (no navigation). Once a file is chosen the headline copy hides, "Pause animations" centres above the card, and the scene and 4-step stepper follow the real stage. Evidence: `docs/evidence/result-ux/` (desktop + 390 px), `tests/e2e/hero-stages-visual.mjs`.
- Live run with the 4K HEVC drone clip: 59 MB → 4.9 MB (downloaded 5,125,168 bytes, sha256 a0eba9a6…10426f5).
- Not yet done: manual iPhone-file testing by the owner.

## Weekly / monthly plans + premium pricing UI (2026-09-25)
- [VERIFIED-LIVE] Migration 0017 applied by the repository runner from pushed `3ce439b` after an encrypted backup; `verify` shows `noPendingOrDrift: true`.
- [TESTED-LOCAL] `pnpm test:payments` against the real DB/API: catalogue (weekly 2000/20/7, monthly 5000/50/30), free download uncharged and second charged to the paid quota, expired/revoked denied, quota exhausts exactly at the plan limit and `/v1/payments/entitlement` agrees, invalid/stale/wrong-amount webhooks denied, duplicates settle once. Unit tests cover plan-code injection (`__proto__`, `constructor`, `free`) and checkout gating.
- [TESTED-LOCAL] `tests/e2e/plans-ui.mjs`: pricing cards, checkout form → "Approve on your phone" → "plan is active", balance banner, desktop + 390 px (`docs/evidence/plans-ui/`). Payment endpoints are **mocked in the browser**; this is UI evidence only.
- [BLOCKED] Real payments: no Snippe API key / webhook secret / provider-approved sandbox is provisioned, so `STUDIO_CHECKOUT_ENABLED` stays false and paid plans show "Opening soon". Needed from the owner: the exact approved Snippe credential item, the webhook URL registered as `https://api.hasheemstudio.com/webhooks/snippe`, and a sandbox/test recipient. No charge has ever been made.

## Legal pages, SEO, logo, sign-out, download error (2026-09-25)
- [ROOT-CAUSED] "Could not unlock this download": the job used the **Inspect only** mode, which creates no output; the UI still offered Download and the API's 409 had no message. Fixed: Inspect is no longer offered on the homepage, the result view shows "Inspection complete" (no download button) for output-less jobs, and the API returns a clear `no_output` message.
- [IMPLEMENTED] Full Privacy Policy (14 sections) and Terms of Service (19 sections) from one source (`apps/web/src/content/legal.mjs`), rendered in React and baked into static HTML. Facts (7-day result/upload retention, 1-day guest uploads, Snippe/Resend/Google processors, no analytics cookies, plan terms and refund rules) match the running system. **Not legal advice**: operator name (Bisso Technologies Ltd.), Tanzanian governing law/PDPA references and the liability cap are assumptions for the owner/lawyer to confirm.
- [IMPLEMENTED] Navbar sign-out is in-place (no reload): the navbar flips immediately, the page remounts signed-out (also on sign-out from another tab), and the session is cleared even if the network call fails. Profile menu has only Sign out.
- [IMPLEMENTED] New logo (favicon set, apple-touch, manifest, OG image, JSON-LD logo, navbar emblem); robots.txt, sitemap.xml, canonical/OG/Twitter, real 404s and noindex on private routes. See `docs/SEO.md`. `tests/e2e/site-shell.mjs` covers sign-out, legal content, brand assets and head tags.
- [BLOCKED/OWNER] Google Search Console verification and sitemap submission need the owner's Google account (steps in `docs/SEO.md`).

## Responsive pass, WebP images, animated sign-out (2026-09-25)
- [IMPLEMENTED] Phones (≤560 px): compact hero (no breadcrumb, shorter headline, smaller scene) so the **idle upload card, the processing card and the finished-result card all fit inside the first screen** on 375x667, 360x640, 390x844 and 430x932 (no scrolling); page height on a 390 px phone dropped from 3787 px to ~2180 px. How-it-works steps, benefit strip and pricing cards are two-column on phones (featured plan spans the row). `tests/e2e/responsive-audit.mjs` measures overflow and card positions per viewport (incl. finished result).
- [IMPLEMENTED] Images: steps PNG→WebP (87–111 KB → 9–17 KB), wordmark 144 KB→30 KB WebP, logos WebP, auth backgrounds re-encoded (115→73 KB, 111→77 KB), OG image PNG 380 KB → JPEG 84 KB (link-preview scrapers do not reliably support WebP), lazy-loaded below-the-fold images with width/height set. Favicons/apple-touch stay PNG/ICO by design; `email-masthead.png` stays PNG (email clients do not render WebP).
- [IMPLEMENTED] Sign-out is animated (menu stays open with a spinner, navbar cross-fades to "Sign in", confirmation toast) without a page reload; covered by `tests/e2e/site-shell.mjs`.

## iPhone spatial-audio MOV failure fixed (2026-09-25)
- [ROOT-CAUSED] A recent-iPhone `.MOV` (HEVC 10-bit HLG 1080p30, rotated) has audio stream 1 = Apple spatial audio (`apac`, 4 ch, no decoder in ffmpeg) and stream 2 = normal stereo AAC. The worker always mapped the first audio track (`0:a:0`), so ffmpeg aborted with "Could not find codec parameters for stream 1", and the raw command line (including encoder tuning) was shown to the user.
- [FIXED] `probe()` now picks the first *readable* audio track (`pickAudioStream`, prefers the stereo compatibility mix) and remux / compat / platform_optimize map that exact stream; unreadable audio is skipped (not fatal) and counted internally (`inputStreams.audioTracksSkipped`). Error text is sanitised twice: the worker stores a user-facing message only (`userError.ts`; raw text stays in `job_attempts`), and the API redacts anything that looks like tool output for old rows too (`publicError.ts`). 6 new worker + 2 new API unit tests (26/16 pass).
- [VERIFIED-LIVE] The user's real `IMG_5475.MOV` (49,337,711 B) through https://hasheemstudio.com with default settings: succeeded, downloaded 11,387,520 B (76.9% smaller), sha256 `6533d585…ddb5c4`. Independent checks of the downloaded file: H.264 Main L4.2, 1080x1920 upright, BT.709 (tone-mapped from HLG), AAC-LC stereo 48 kHz, video/audio 28.688/28.692 s, `ftyp moov … mdat` (faststart), full decode with zero errors, frame comparison vs original matches. The clip is a personal screen recording, so it is not committed to the repo.

## 5-minute results, free-plan messages, refresh-safe results, phone navbar (2026-09-25)
- [IMPLEMENTED] **Processed videos are kept for 5 minutes** (`RESULT_RETENTION_MS`, set when the job succeeds). The result card shows a live countdown; at 0 it flips to "This video has expired" with "Prepare again". Downloads are refused in the last 15 s and after removal (message: "This video was removed after 5 minutes"). Source uploads are kept at most 1 hour (never while a job still needs them).
- [FOUND + FIXED] The retention sweeper (`scripts/ops/retention-sweep.mjs`) was **never scheduled**, so nothing was actually deleted automatically. The worker now runs `apps/worker/src/retention.ts` every 30 s (results deleted 60 s after expiry so an in-flight download can finish; expired sources; abandoned upload sessions). One-time backfill applied to existing rows: 54 stored results and 59 uploads were past the new limits and were deleted by the sweeper (logged in the worker).
- [IMPLEMENTED] Free plan = one video at a time / one download a day. Trying to start another now fails **before uploading** with a clear message: `video_in_progress` ("still being prepared"), `video_waiting` ("download it first") — both with a "Go to my video" button — or `free_limit_used` ("used today's free video", with reset time and the plan cards). An expired, never-downloaded video does not burn the free slot; a paid plan with videos left lifts the block. `tests/integration/free-limit-and-retention.mjs` (`pnpm test:limits`, 9 checks on real DB + storage).
- [IMPLEMENTED] The job id lives in the address bar (`/?job=<id>`) from the moment the job exists; a refresh at any point (uploading→processing→ready) restores the same card, and signing in returns to `/?job=<id>` with the Download button (guest job is claimed on download). The last job is also remembered in the browser for 10 min so any return to `/` restores it. `tests/e2e/result-lifecycle.mjs` (refresh mid-processing, real 4:59 countdown, live expiry, unknown link) and `guest-auth-browser.mjs` (refresh, sign-in return, download, second-video refusal).
- [IMPLEMENTED] Phone navbar: hamburger removed; "Get Started" is pink-gradient with pink border, shown **only when signed out**, and opens the sign-in screen (not the upload page); signed-in users see their profile chip (session read synchronously, no signed-out flash). Sign-in now lands on `/` by default.

## TikTok/Android "Couldn't decode" — Dolby Vision brand in delivered MP4 (2026-09-25)
- [ROOT-CAUSE, most likely] The re-encoded H.264 MP4 delivered for an iPhone HDR clip had `dby1` (Dolby Vision) in its `ftyp` compatible brands, carried over from the iPhone original, although the file contains no Dolby Vision data (no `dvcC/dvvC`). Dolby-Vision-aware importers/decoders (many Samsung/Android players, TikTok's importer) take a DV path for a stream that has none and reject it. Not reproducible without the TikTok app; this is the concrete header defect found, not a proven vendor-side cause.
- [FIXED] Worker now (a) rewrites Dolby/QuickTime brands in the delivered file's `ftyp` in place (`mp4Compat.ts`, same length so faststart offsets are unchanged) before verification, and (b) passes `-map_metadata -1 -map_chapters -1` on all recipes, so the iPhone's GPS position, device model and other source tags never reach the output.
- [VERIFIED-LIVE] Same real `IMG_5475.MOV` through https://hasheemstudio.com: header was `isom dby1 iso2 avc1 mp41`, is now `isom mp42 iso2 avc1 mp41`; 0 `dby1`, 0 Dolby boxes, no location/device metadata; H.264 Main L4.2 1080x1920, AAC-LC stereo, 28.692 s, 11,387,512 B (76.9% smaller), zero decode errors. 29 worker unit tests pass (3 new for the header rewrite).

## Prices, checkout proof and email logo (2026-09-25)
- [CHANGED] Prices: **Weekly 5,000 TZS** (20 videos, 7 days), **Monthly 19,900 TZS** (50 videos, 30 days); Free unchanged. Server catalogue, pricing UI, structured data, Terms and docs updated. Note: per video this is 250 TZS (weekly) vs ~398 TZS (monthly), so monthly costs more per video; quotas were left as approved (owner may want to raise monthly videos).
- [TESTED-LOCAL] `pnpm test:checkout` (`tests/integration/snippe-checkout-e2e.mjs`): the full chain against a fake Snippe on loopback — catalogue, exact provider request (bearer key, idempotency key, mobile, amount, customer, our webhook URL, Studio-only metadata), pending, no double charge, forged/wrong-amount webhooks refused, signed `completed` -> plan active, free-then-paid downloads, monthly at 19,900, failed payment unlocks nothing and can be retried. A loopback-only `SNIPPE_API_BASE` override exists for this test; remote/https overrides are ignored (unit-tested).
- [BLOCKED / OWNER] **Real payments are still OFF.** No Snippe API key or webhook secret is installed for Studio, and this repo's rules forbid copying another project's (Hasheem Gaming's) credentials from its environment/containers/DB. Owner steps are in `docs/PAYMENTS.md` ("Go-live checklist"): fetch the approved vault item(s) with `scripts/ops/fetch-vaultwarden-secret.sh` in your own terminal, run `scripts/ops/enable-checkout.sh`, confirm the webhook URL/secret in Snippe, make one small real payment. No charge has ever been made.
- [CHANGED] All six auth emails now use a new header with the real Hasheem emblem + wordmark (`email-masthead.jpg`, cache-busted `?v=4`); GoTrue fetches templates from https://hasheemstudio.com/auth-email-templates/, so they take effect on deploy.
