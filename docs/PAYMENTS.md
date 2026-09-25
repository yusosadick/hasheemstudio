# Studio paid downloads

[IMPLEMENTED] Disabled Snippe foundation, independent Studio tables and account-scoped routes:
- `GET /v1/payments/plan`: availability and approved public plan only.
- `POST /v1/payments`: verified user, accessible completed/unexpired job, server price snapshot,
  per-account serialization, three initiations/day, one open attempt per job, 30-character
  cryptographic idempotency key. Unknown provider outcomes do not automatically resend.
- `GET /v1/payments/:id`: owner-only status. A browser redirect cannot grant access.
- `POST /webhooks/snippe`: raw-body HMAC-SHA256, constant-time comparison, ±300-second timestamp,
  64KiB body bound, exact version/type/schema/correlation/currency/amount checks. Atomic event
  deduplication and one entitlement per paid intent; terminal results cannot be resurrected.
  Stores event digest and bounded metadata, not raw webhook/customer payloads.
- Download gate counts distinct grants under the existing account lock. Active, unrevoked,
  webhook-backed entitlements raise the daily allowance; output ownership/expiry/signing checks
  remain mandatory. Expired/revoked grants do not raise it. No public output storage access.

Source contracts reviewed (2026-09-21): [payments](https://docs.snippe.sh/docs/2026-01-25/payments),
[mobile](https://docs.snippe.sh/docs/2026-01-25/payments/mobile-money),
[webhooks](https://docs.snippe.sh/docs/2026-01-25/webhooks). Fixed API origin
`https://api.snippe.sh`; no redirects, 15-second timeout, 64KiB response bound. Studio metadata
is separate from Gaming order metadata. Only authorized Gaming source patterns were read.

[VERIFIED-LIVE 2026-09-26] Owner-approved commercial terms and credentials are provisioned. Mobile-money checkout is enabled; card remains disabled. Snippe accepted the installed `snp_` API key via the documented non-mutating balance endpoint (HTTP 200), and Studio's live webhook verifier accepted the installed `whsec_` secret for a correctly signed synthetic event before safely denying its nonexistent intent with no database residue.

[PARTIAL FINANCIAL PROOF] No real phone has been charged yet. Provider-originated `payment.completed`, physical handset approval, real entitlement activation and paid-download decrement remain pending an owner-approved test recipient. The official SDK maps sandbox and production to the same hostname; the key's prefix alone does not establish sandbox safety, so no unsolicited test charge was made.

Protected configuration, no defaults for commercial terms:
`SNIPPE_API_KEY`, `SNIPPE_WEBHOOK_SECRET`, `STUDIO_PLAN_NAME`, `STUDIO_PLAN_AMOUNT_TZS`,
`STUDIO_PLAN_DURATION_SECONDS`, `STUDIO_PLAN_DOWNLOADS_PER_DAY`, `STUDIO_PAYMENT_METHODS`,
`STUDIO_PAYMENT_APPROVED`, `STUDIO_CHECKOUT_ENABLED`. Both flags default false.
Use Bitwarden 2026.8.0 and the owner's exact approved item only; no broad vault search. No handoff
was present in this session, and no vault retrieval was attempted. Never reuse Gaming DB/env.

[DEFERRED] Card collection remains denied until its billing form, approved hosted checkout
origin/response contract and sandbox flow are verified. The foundation builds a server-owned
card return path, but does not advertise working card checkout. No recurring subscription,
refund/chargeback automation or financial production readiness is claimed.

[TESTED-LOCAL] Unit signature/parser/config/request tests use synthetic payloads. Database/API
security results and rollout are recorded in STATUS. Synthetic webhook tests are **not**
provider sandbox evidence. Pending/completed/failed UI states come from authenticated API status;
query strings and local state never authorize a download. Physical payment evidence remains absent.

## Plans (owner-approved 2026-09-25) — migration 0017

| Plan | Price | Quota | Window |
|---|---|---|---|
| Free | 0 | 1 video / day (unchanged, 100 MB, 2 min, 1080p60) | daily, UTC |
| Weekly | 5,000 TZS | 20 videos | 7 days |
| Monthly | 19,900 TZS | 50 videos | 30 days |

- Terms live in code (`PAID_PLANS` in `apps/api/src/payments/snippe.ts`); the browser sends only a plan **code**. Prices/quota/duration are snapshotted onto `payment_intents` and `paid_entitlements` at purchase.
- Account-level checkout (no job needed). One open attempt per account; 5 initiations/day. `GET /v1/payments/plans` (public catalogue + `available`), `GET /v1/payments/entitlement` (free use today + paid remaining), `POST /v1/payments {planCode,method:'mobile',phone,firstname,lastname}`.
- Download gate: the free daily video is used first; once it is used, one paid video is charged to the earliest-expiring active entitlement (`download_grants.entitlement_id`). Re-downloading an already-granted job never charges again. Expired/revoked/exhausted entitlements deny immediately.
- Mobile money only. Card stays disabled.
- **Checkout is ON in production for mobile money** as of 2026-09-26: `STUDIO_CHECKOUT_ENABLED=true`, `STUDIO_PAYMENT_APPROVED=true`, real `snp_`/`whsec_` credentials provisioned from the owner-approved Vaultwarden item. Card remains disabled. Real provider API authentication is verified; one owner-approved handset charge remains pending for full financial end-to-end proof.

## Go-live checklist and current state
Prices are **Weekly 5,000 TZS / 20 videos / 7 days** and **Monthly 19,900 TZS / 50 videos / 30 days** (approved 2026-09-25).
The whole chain is proven against a fake provider (`pnpm test:checkout`, 8 checks: exact provider request, pending state,
signed webhook, plan activation, paid downloads, failure/retry, forged/wrong-amount rejection). Real-provider progress:
1. **Credentials — DONE 2026-09-26.** Owner-approved Vaultwarden item `hasheemstudio-snippe-api` provisioned `SNIPPE_API_KEY` and `SNIPPE_WEBHOOK_SECRET` to protected `/etc/hasheemstudio/local.env`; vault locked/session removed. Snippe API authentication verified through `GET /v1/payments/balance`.
2. **Enable — DONE 2026-09-26.** Mobile checkout enabled; only API recreated; `/v1/payments/plans` reports `available:true`.
3. **Webhook verifier — VERIFIED.** Endpoint is `https://api.hasheemstudio.com/webhooks/snippe`. Unsigned requests reject 401; a correctly signed schema-valid unknown intent reached settlement and was safely denied with zero DB residue. The webhook secret must remain the same account signing secret shown by Snippe Settings → Webhook Secret.
4. **Real financial test — PENDING.** Make one owner-approved 5,000 TZS Weekly payment, physically approve the handset prompt, then confirm provider-originated callback, 20-video entitlement and paid-download decrement. Until this is observed, do not claim real money end-to-end.
