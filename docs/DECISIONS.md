# Decisions requiring owner input

> Split from `docs/MASTER-PLAN-ORIGINAL.md` §24, kept current as items resolve. Unblocked work
> continues in parallel with all open items below — see `docs/STATUS.md`.

## Open — blocking specific downstream work only

| # | Decision needed | Blocks | Status as of 2026-09-16 |
|---|---|---|---|
| 1 | DNS provider and secure record-management access for `hasheemstudio.com` | Phase 2 (DNS/TLS), Phase 6 (Resend domain verification) | NS records point to Cloudflare (`christian.ns.cloudflare.com`, `cora.ns.cloudflare.com`), confirmed via `dig` as of 2026-09-17 — still no A/AAAA published. No Cloudflare API token or dashboard access found on the VPS. **Exact secret name needed: `CLOUDFLARE_API_TOKEN`** (a zone-scoped token for `hasheemstudio.com` with `Zone:DNS:Edit` permission only — not a global/account-wide token). **Safe provisioning method:** the owner has a self-hosted Vaultwarden on this VPS; the agent has `scripts/ops/fetch-vaultwarden-secret.sh` ready to pull a named item straight into the protected env file without ever displaying it in chat — see that item's step-by-step instructions below. Alternatively, the owner can add the DNS records manually from instructions this project provides once the record values are known (no token needed for that path, but Resend domain verification and future automation would then need to be redone by hand each time). |
| 2 | Resend key/domain access and an approved inbox for delivery verification | Phase 6 (email) | No Resend credentials found anywhere accessible on the VPS as of 2026-09-17. Confirmed directly against the live Auth service that signup currently fails with a real 500 ("Error sending confirmation email") for exactly this reason — not a guess. **Exact secret name needed: `RESEND_API_KEY`** — used both as the transactional API key and, per Resend's own docs, as the SMTP password (`SMTP_PASS`) for Supabase Auth's outgoing mail (`SMTP_USER` is the fixed literal string `resend`, not a secret). Also needed: confirmation that `mail.hasheemstudio.com` (or another subdomain) is the intended verified sending domain, and an inbox the agent or owner can check for real delivery evidence. **Safe provisioning method:** same Vaultwarden path as above — see below. |
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
