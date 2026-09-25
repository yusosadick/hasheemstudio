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

[BLOCKED] **No approved price. No credential provisioned. No Snippe call/charge made.**
Required owner inputs: exact approved shared Snippe Vaultwarden item name (unknown; not guessed),
plan name, integer TZS price, entitlement duration, downloads/day, mobile/card/both, provider-approved
sandbox credentials/mode and test recipient. `snp_` prefix alone does not establish sandbox safety.
The official SDK maps sandbox and production to the same hostname; a mode label is not proof
that a production key cannot charge. Do not flip approval flags before provider-approved testing.

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
- **Checkout is OFF in production**: `STUDIO_CHECKOUT_ENABLED`/`STUDIO_PAYMENT_APPROVED` are false and no Snippe credentials are provisioned. The pricing UI shows the plans with "Opening soon" and cannot start a charge. The `STUDIO_PLAN_*` env vars are no longer read.

## Go-live checklist (needs the owner; nothing here was done by an agent)
Prices are now **Weekly 5,000 TZS / 20 videos / 7 days** and **Monthly 19,900 TZS / 50 videos / 30 days** (2026-09-25).
The whole chain is proven against a fake provider (`pnpm test:checkout`, 8 checks: exact provider request, pending state,
signed webhook, plan activation, paid downloads, failure/retry, forged/wrong-amount rejection). What remains is real credentials:
1. **Credentials.** This repo's rule is that Studio never copies another project's secrets from its environment, containers or
   database. Use the Snippe vault item you approve for Studio: run `bw unlock` in your own terminal, then
   `./scripts/ops/fetch-vaultwarden-secret.sh "<item>" SNIPPE_API_KEY /etc/hasheemstudio/local.env` and the same for
   `SNIPPE_WEBHOOK_SECRET`. (If Studio and Gaming share one Snippe merchant account this is the same key/secret; that is the
   owner's decision, and payments will then appear in that shared account.)
2. **Enable.** `./scripts/ops/enable-checkout.sh` sets `STUDIO_PAYMENT_METHODS=mobile`, `STUDIO_PAYMENT_APPROVED=true`,
   `STUDIO_CHECKOUT_ENABLED=true`, recreates only the `api` container and waits for `/v1/payments/plans` to report `available:true`.
3. **Webhook.** In Snippe, the webhook for these payments is `https://api.hasheemstudio.com/webhooks/snippe` (each payment also
   carries this URL per request). Its signing secret must equal `SNIPPE_WEBHOOK_SECRET`. Studio ignores events whose metadata is not
   `product: hasheemstudio`; check that the Gaming webhook likewise ignores Studio events if both are attached to one account.
4. **One real small payment** with a test recipient, then confirm the plan appears on the pricing page ("N of N videos left").
Until step 2 is done the site shows the plans with "Opening soon" and cannot start a charge.
