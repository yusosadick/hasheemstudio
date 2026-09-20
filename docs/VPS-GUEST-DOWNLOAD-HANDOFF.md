# VPS deployment prompt: guest processing and progressive authentication

Deploy and finish Hasheem Studio's guest processing/download-gate release from
`https://github.com/yusosadick/hasheemstudio.git`, branch `main`.

The owner authorizes project-scoped deployment, fixes, and verification. Read AGENTS.md,
CLAUDE.md, docs/STATUS.md, docs/DEPLOYMENT.md, docs/MIGRATIONS.md, and this handoff first.
Do not touch other applications, their containers, credentials, routing, or databases.
Do not print tokens, passwords, service-role keys, confirmation links, or signed media URLs.
Do not reset databases, delete shared volumes, force-push, or rewrite applied migrations.

## Required product behavior

- Visitors can upload MP4/MOV and process without creating an account first.
- Free input ceiling remains 104857600 bytes (the existing displayed 100 MB limit), 2 minutes,
  1080p60. Server/storage checks, not browser declarations, enforce the limits.
- A completed result shows a sign-in/create-account gate. Login must return to that exact result.
- First successful download claims the guest workspace for that account and invalidates its
  former guest capability. This preserves membership and account-deletion ownership semantics.
- Verified Free gets one distinct video download per UTC day. Re-downloading the same unlocked
  result does not spend another allowance. Concurrent requests cannot over-admit.
- Result metadata contains no signed URL. `POST /v1/jobs/:id/download` is the only application
  issuance point; URLs expire after five minutes and use attachment download disposition.
- Storage RLS blocks direct output reads/self-signing/client overwrites, including by members.
- Three processing attempts/day and one active job remain separate resource protection limits.
  Guest sessions also have three uploads/session, three sessions/network/day, a 24-hour capability
  lifetime, and a global maximum of eight queued/active guest jobs.

## Source import

The owner authorized copying `https://github.com/yusosadick/zahorozanzibar.git`.
Auth screens/components/imagery and email lookup were imported from revision
`2fd32cf9a35017a8be256e3a4ff53708864eb596`; attribution and original license are under
`third_party/zahorozanzibar/`. Preserve the imported email-first layout and its existing/new-user
steps, recovery screens, and Hasheem branding. Do not redesign the approved landing page.
Use Hasheem's own Supabase project and credentials only. Do not copy Zahoro auth users or secrets.

## Deployment sequence

1. Discover the actual checkout, Git status, remote HEAD, Compose project, current running release,
   database marker and migration ledger, and backup/restore health. Preserve any existing VPS edits.
   Fetch `origin/main` and use a clean checkout of the exact reviewed SHA; report that SHA.
2. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, and the production web build using the
   real Hasheem `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL`. Do not expose
   credentials in the command line or logs. Inspect the existing deployment scripts/Dockerfiles.
3. Inspect trusted ingress/proxy addresses. Set `API_TRUST_PROXY` ONLY to known proxy IPs/CIDRs.
   Never use blanket `true`, `0.0.0.0/0`, or trust arbitrary incoming X-Forwarded-For. Without the
   correct proxy setting, all public guests may share the proxy IP's three-session daily allowance.
   Confirm ingress strips/spells forwarded headers appropriately and add project-scoped edge rate
   limits if needed. `ENABLE_GUEST_PROCESSING=false` is available as a temporary server kill switch.
4. Coordinate the API and frontend switch. A previous API still issues links directly on GET;
   do not leave an old API instance serving alongside the new gated frontend after deployment.
   Apply migrations 0013 and 0014 using the repository migration runner and the ACTUAL discovered
   environment configuration. This VPS historically called its live stack `local`; do not blindly
   assume the inventory's `production` stanza is provisioned. Verify Hasheem's DB marker and the
   exact target before applying. Use the pushed SHA; verify the ledger afterward. Never edit 0001–0014.
5. Rebuild/restart only this project's API/web and any required project auth services using its
   existing Compose/deployment workflow. The worker's media recipes remain unchanged. Verify readiness.
   Signed URLs issued before the switch remain usable until their former TTL (up to 15 minutes).
6. Confirm frontend can reach /v1/guest-sessions and the HEAD/PATCH guest TUS proxy. Verify CORS,
   request size/timeouts and upload-offset exposure. Preserve direct authenticated TUS uploads too.

## Remaining authentication configuration

- Supabase redirect allowlist must include the exact Hasheem `/auth/callback` and `/reset-password`
  URLs for production (plus deliberate development origins). Keep SITE_URL correct.
- Configure a dedicated Hasheem Google OAuth client if the owner has provided it. The copied Google
  button is currently disabled until `/auth/v1/settings` reports the provider enabled. Test the real
  consent/callback journey and return to the processed video. Do not borrow Zahoro credentials.
- Verify real registration, email confirmation, password login, session refresh, logout, password
  reset link and recovery-code paths. Configure recovery OTP length to match the imported six-digit
  code UI, or adapt the UI to the actual configured length. Check the real email template includes
  the recovery code before promising that path. Confirm actual inbox receipt separately from SMTP 200.
- Verification screens must require a real verified Supabase user; do not restore the source's old
  success-from-URL-parameters behavior. Strict internal return paths prevent open redirects.

## Remaining payment work — not implemented or claimed complete

Neither the imported auth flow nor Hasheem contains a configured paid checkout for video downloads.
The daily-limit response sets `checkoutAvailable: false` and tells users to return after the reset.
No amount, provider, or successful charge has been fabricated. Pro Beta is an existing operator-assigned
entitlement (20 downloads/day), NOT proof of a payment or an automatic paid subscription.

Inspect the owner's approved payment configuration. If provider/price/credentials are missing, ask
for those exact inputs and record the blocker while completing the rest of deployment. Once supplied:
implement checkout, server-side verified/idempotent payment webhooks, durable entitlement/payment
records, failed/cancelled-payment handling, and reconciliation. Unlock only after verified payment;
never on a browser success redirect. Preserve the processed video through checkout. Test with the
provider's supported test mode, then the owner's authorized live verification process.

## Verification and evidence

Local evidence already exists under `docs/evidence/guest-download-gate/`; do not relabel it VPS/live.
Use isolated disposable test users/videos; clean up only those exact resources. Commands:

```
pnpm typecheck
pnpm --filter @hasheemstudio/web build
TEST_API_URL=http://127.0.0.1:8787 pnpm test:guest-download
TEST_WEB_URL=https://hasheemstudio.com pnpm test:guest-browser
```

The integration test expects the dedicated database/storage on local published ports, loaded from
`HASHEEMSTUDIO_ENV_FILE` (Linux default `/etc/hasheemstudio/local.env`). Check that these resolve to
this deployed project. The browser test requires Playwright Chromium or an explicitly configured
`PLAYWRIGHT_CHROMIUM_EXECUTABLE`. Guest admission is deliberately limited: do not run more than the
three allowed parallel test sessions from the same network. Do not disable security checks to pass.

Also rerun existing authenticated upload/remux/encode and retention/account-deletion checks after
reviewing their environment paths. Validate a guest workspace claimed by an account follows that
account's deletion path and physical-file cleanup. Verify expired unclaimed guest uploads/outputs
are swept; add a bounded expired guest workspace/metadata cleanup job if needed. Audit finalized-
-but-never-queued inputs and abandoned/aborted upload sessions so guest traffic cannot accumulate
unbounded storage. Keep active-job safeguards. Do not mark cleanup successful if storage deletion fails.

Test on desktop and mobile: guest upload → process → blocked download → sign in → same result →
real downloaded bytes. Check second distinct video is blocked at download, repeat download is free,
UTC reset, two concurrent claims, wrong/expired guest token, wrong account, unauthenticated download,
raw output-storage read/self-sign denial, 100 MB edge, expired outputs, interrupted upload retries,
email-first existing/new-account branching, Google when configured, email/reset and logout.

Finish by updating docs/STATUS.md and docs/DECISIONS.md, saving sanitized live evidence, committing
any fixes in reviewable commits, and pushing. Report release SHA, migration versions/ledger verification,
container health, live browser evidence, and any remaining owner-input blockers explicitly. Do not
claim payment, OAuth, inbox delivery, or VPS deployment success without the corresponding evidence.
