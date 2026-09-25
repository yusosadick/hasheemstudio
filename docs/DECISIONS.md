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


## 2026-09-21 Studio auth, email and payments

Owner directs landing-style auth and always-visible Get Started, replacing the tourism auth layout.
Licensed Gaming email design is authorized; only design and nonsecret Snippe source patterns reused.
No Gaming environment/database/services accessed or modified. Studio price absent: checkout disabled.
Pending owner inputs: exact shared Snippe vault item, plan name/TZS price/duration/downloads per day,
mobile/card/both, provider-approved sandbox mode/credential and test account, approved signup/recovery
inbox, support mailbox routing confirmation. Real Google consent/session still requires owner test.
No guessed price, credentials or synthetic provider-success claim.


## Download-truncation root cause found and fixed — 2026-09-22

A production report said large downloads were silently truncating on slow connections (VLC/WhatsApp
rejecting the result) even after the same-day signed-URL-expiry fix (`2c683bfc`). Investigated fresh
per explicit instruction not to assume that fix was sufficient. Real root cause: the Envoy gateway's
`/storage/v1/` route had `timeout: 30s`, applying to the whole request, not just time-to-first-byte —
confirmed directly from the storage service's own "ABORTED REQ" log at ~30.000s and Envoy's own
access log showing a "200" response short by tens of megabytes. Reproduced the exact user-facing
symptom end to end with a real throttled Chrome browser against the live production download UI, then
fixed (`timeout: 7200s`, matching the download URL's own expiry) and reverified with the same real
browser mechanism plus independent raw-HTTP downloads at two throttle profiles: byte-exact,
sha256-exact, clean `ffmpeg` decode, clean VLC playback each time. Full raw evidence:
`docs/evidence/download-truncation-fix/results.json`. No owner input was needed; this was a
project-owned dedicated Envoy config, not shared infrastructure.


## Platform-optimize recipe — 2026-09-25

Built as a selectable recipe (not the default). Owner decisions this leaves open, each with the measured trade-off in docs/evidence/platform-optimize/:

1. **Default recipe.** ~~Left as remux~~ **Changed 2026-09-25 at the owner's request: `platform_optimize` is now preselected and listed first** (remux and the others remain selectable). Cost: ~18-40 s of worker encode per 5-10 s of video; a guest waits that long.
2. **Bitrate ceilings.** Chosen from the only official per-resolution recommendation (YouTube: 1080p 8/12 Mbps at 30/60 fps, 720p 5/7.5, 480p 2.5/4) because TikTok, Instagram and WhatsApp publish only minimums, maximums and limits, never a target. Only 1 of 4 real sources clears VMAF 93 at those ceilings; hard content needs ~20-24 Mbps for 93. Raising ceilings improves hard-content quality and shrinks the size win; lowering them does the reverse.
3. **WhatsApp-safe encoding (Main profile, no B-frames)** costs 0.9-2.7 VMAF or 7-12% bitrate versus High + B-frames, adopted because Meta documents that Android WhatsApp clients reject High + B-frames. Revisit if WhatsApp guidance changes.
4. **Two-pass rejected** for this recipe: exact target adherence but it inflated an already-small source to ~3x its size and cost ~55% more time.
5. **HDR**: initially refused; **implemented 2026-09-25** as tone-mapping to SDR (hable), tested on real HDR10 footage and synthetic iPhone-style HLG/PQ clips. Not tested on a real iPhone file.
6. **In-worker VMAF** would need an ffmpeg build with libvmaf in the worker image; not done, quality remains an offline measurement.
No owner input was required to ship this; nothing here touches shared infrastructure.
