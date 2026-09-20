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
