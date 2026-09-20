# Decisions requiring owner input

> Split from `docs/MASTER-PLAN-ORIGINAL.md` §24, kept current as items resolve. Unblocked work
> continues in parallel with all open items below — see `docs/STATUS.md`.

## Open — blocking specific downstream work only

| # | Decision needed | Blocks | Status as of 2026-09-16 |
|---|---|---|---|
| 1 | DNS provider and secure record-management access for `hasheemstudio.com` | Phase 2 (DNS/TLS), Phase 6 (Resend domain verification) | **Resolved 2026-09-17.** `CLOUDFLARE_API_TOKEN` retrieved from the owner's Vaultwarden (item `hasheem studio DNS`) via `scripts/ops/fetch-vaultwarden-secret.sh`, following a first failed attempt caused by a stale local `bw sync` (fixed by the owner re-syncing). A/records for apex, `www`, `api`, `supabase` were added and real Let's Encrypt TLS certs are live — see `docs/ENVIRONMENTS.md` "Ingress URLs" and `docs/evidence/phase7-launch/public-launch-verification.json`. **Incident:** while later editing `/etc/hasheemstudio/local.env` with a raw `sed` command (not the safe helper scripts), the session harness's automatic file-diff notification printed this token's raw value into the conversation transcript. Not a deliberate print, but the value should be treated as exposed — **recommend rotating `CLOUDFLARE_API_TOKEN`** and re-provisioning via the same Vaultwarden flow. |
| 2 | Resend key/domain access and an approved inbox for delivery verification | Phase 6 (email) | **Resolved 2026-09-17, with one open gap.** `RESEND_API_KEY` retrieved from Vaultwarden (item `hasheemstudio-resend-api`) and wired into `SMTP_PASS`/GoTrue. Real public signup through the live browser at `https://hasheemstudio.com/signup` returns a real 200 with `confirmation_sent_at` populated and no SMTP error — **provider acceptance is verified**. The domain's SPF/DKIM records were already present in Cloudflare (added by the owner before this session, under `send.hasheemstudio.com`/`rsend.hasheemstudio.com`/`resend._domainkey.hasheemstudio.com`) and were left untouched. **Inbox receipt is NOT yet independently verified** — the Gmail MCP connector available in this environment needs re-authentication (`/mcp`) and two attempts this session both failed; the owner should either re-authenticate it or manually confirm receipt at `yuso.sadick+hasheemstudio-publicsignup-1789621992@gmail.com` (sent 2026-09-17T05:13:19Z). **Same incident as item 1 above applies to `RESEND_API_KEY`** — recommend rotating it too. |
| 3 | Confirmed platform-owner email for admin bootstrap | Phase 6 (admin RBAC bootstrap) | Not yet provided. |
| 4 | Approved off-host backup/object-storage provider, region and budget | Phase 2 (backups), possibly ADR-0003 (media storage) | Not yet approved. Current VPS free disk (260 GB) is insufficient for the planning-scenario retention volume — see `docs/CAPACITY.md`. |
| 5 | Whether production Kubernetes nodes exist or need budget approval | Phase 8 | Not yet answered. Default: Stage A (Docker Compose) only; Kubernetes stays at rehearsal level until nodes are approved. |
| 6 | Commercial plan prices, payment provider and legal entity details | Phase 9 / billing | Not needed for P0. Checkout stays disabled. |
| 7 | Final support/reply-to address and policy approval | Phase 6, `docs/PRD.md` §7 legal/terms | Not yet provided. |

## Defaults in effect until the above resolve

Dedicated existing-VPS beta isolation, free/invite beta with hard limits, English/Swahili-ready UI,
no paid checkout, no GPU feature, no public production claim while a launch gate is blocked.

## Exact steps to unblock items 1 and 2 (Resend + DNS) — safe provisioning, no chat secrets

The owner previously said the values are saved in the self-hosted Vaultwarden on this VPS as
items named `hasheemstudio-resend-api` and `hasheem studio DNS`. `bw status` still shows the vault
**locked** as of 2026-09-17 — the agent cannot and will not ask for the master password. To hand
off access securely:

1. In a terminal **you** control (a separate SSH session — not through this chat), run:
   ```
   bw unlock
   ```
   and enter your master password there. It prints a line like `export BW_SESSION="..."`.
2. Still in that separate terminal, save just the session key to a file (never paste the value
   into this chat):
   ```
   umask 077 && echo 'BW_SESSION="<the value from step 1>"' > ~/.hasheemstudio_bw_session
   ```
3. Tell the agent the file is ready. It will then run, for each secret, without ever printing the
   value:
   ```
   source ~/.hasheemstudio_bw_session && export BW_SESSION
   scripts/ops/fetch-vaultwarden-secret.sh "hasheemstudio-resend-api" RESEND_API_KEY /etc/hasheemstudio/local.env
   scripts/ops/fetch-vaultwarden-secret.sh "hasheem studio DNS" CLOUDFLARE_API_TOKEN /etc/hasheemstudio/local.env
   ```
4. Once `RESEND_API_KEY` is present, the agent wires it into `SMTP_PASS`/the transactional client,
   restarts Auth, and verifies real signup/reset email — see `docs/STATUS.md` for the verification
   steps and what "verified" means here (provider acceptance is not the same as inbox receipt).
5. Once `CLOUDFLARE_API_TOKEN` is present, the agent adds only the specific records needed
   (apex/`www`/`api`/`supabase` A or CNAME, plus Resend's returned SPF/DKIM/DMARC values) — never a
   blanket zone import, never touching unrelated existing records.

A `BW_SESSION` key is itself a bearer credential (like the vault's own equivalent of an OAuth
token) — treat the file the same as any other secret: mode 600, delete it once no longer needed,
never paste its contents into chat either.

## Non-blocking discovery notes (not decisions, just recorded facts)

- The candidate VPS (`169.58.72.101`, `yuso`) is confirmed to be reachable and is the environment
  this session is running in — it is a real, shared, already-loaded production host, not a fresh
  box. See `docs/ENVIRONMENTS.md`.
- SSH access to `github.com:yusosadick/hasheemstudio.git` is confirmed working (read access
  verified via `git ls-remote`; write access to be confirmed by the actual first push — recorded in
  `docs/STATUS.md` once done).

## Owner update: guest processing and gated downloads — 2026-09-20

- Authorized journey: guests may upload and process; downloading requires login/free allowance
  or payment. Free access is one video per day with a maximum 100 MB input. Apply the download
  allowance at the download boundary rather than treating it as the existing processing-attempt
  counter. Preserve the completed job through registration/login and repeat downloads.
- AUTH-SOURCE (owner input): provide the licensed repository URL and any non-default branch.
  The owner authorizes copying its authentication source and wants the same complete flow.
  Repository identification is missing; no request for additional copying permission is needed.
- DOWNLOAD-CHECKOUT (owner input): confirm whether that repository supplies the desired payment
  flow; otherwise provide processor and download price. No payment provider or pricing is assumed.

### Resolution and implementation follow-up — 2026-09-20

- AUTH-SOURCE resolved: owner supplied `https://github.com/yusosadick/zahorozanzibar.git` and
  explicitly reaffirmed permission. Copied/adapted auth at 2fd32cf with Apache-2.0 attribution.
- Daily free access is enforced as one distinct downloadable video per account per UTC day,
  separate from processing-attempt abuse limits. The first granted guest download adopts its
  workspace for that account; repeat downloads are idempotent while the output is retained.
- DOWNLOAD-CHECKOUT remains unconfigured: the copied auth source has no video checkout/provider
  integration to import. VPS handoff directs the deploy agent to use approved owner configuration
  and verify webhooks; do not invent pricing or treat Pro Beta assignment as a completed payment.


## Google OAuth exact-item provisioning blocker — 2026-09-21

Owner authorized only organization item `hasheemstudio-google-oauth`, using the compatible
Bitwarden CLI 2026.8.0 handoff. The retrieved response failed the combined exact-name / organization
check before credentials were extracted or the environment written. The vault is locked and
handoff deleted. Exact failed metadata condition was not retained; the helper now distinguishes
those conditions on future authorized retries. Owner action: confirm exact item and organization
assignment, or explicitly clarify personal-vault usage, then prepare a fresh protected handoff.
No credential paste is needed. Google remains disabled; no service restart occurred.


### Google provisioning blocker resolved — 2026-09-21

Owner confirmed organization Bisso VPS Automation / collection Hasheem Studio and corrected
exact item `hasheemstudio-google-oauth`. The new CLI 2026.8.0 retrieval passed exact-name and
organization-assignment checks. Protected provisioning and cleanup passed; only Hasheem Studio
Auth was recreated. Google is enabled and fresh Chromium reaches the provider login with PKCE
and correct callbacks. Remaining owner acceptance is real consent, authenticated return,
refresh and logout; no Google Cloud redirect change is required by the observed evidence.
