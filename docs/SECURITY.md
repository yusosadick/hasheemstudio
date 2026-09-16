# Security

> Split from `docs/MASTER-PLAN-ORIGINAL.md` §16 and relevant parts of §11/§20. Secret *values*
> never appear in this repository — only names, purposes and storage locations.

## Threat model

Must cover cross-tenant access, hostile media, SSRF, command injection, upload abuse, role escalation, leaked signing URLs, queue replay, webhook replay, invitation abuse, credential leakage and resource exhaustion.

## Auth and authorization

JWT validation checks signature, issuer, audience and expiration; authorisation uses current membership/entitlements. Admin MFA and recent-auth requirements for critical actions; no automatic promotion of the first registered user. Bootstrap an owner only after owner email is confirmed. Rate-limit by IP and identity with safe reverse-proxy trust configuration. CSP, explicit CORS origins, CSRF protection wherever cookie auth is used, security headers and dependency/image scans.

## Secret inventory (names only — values are never committed)

| Secret | Purpose | Storage |
|---|---|---|
| Supabase DB/auth signing/encryption secrets | Dedicated Supabase project auth | Protected file on VPS (see `docs/ENVIRONMENTS.md`) / secret manager |
| API credentials | Internal service-to-service auth | Protected file on VPS |
| Redis ACL credentials | Dedicated Redis instance | Protected file on VPS |
| Media storage keys | Private object storage access | Protected file on VPS |
| Resend credentials (SMTP + API key) | Auth + transactional email | Protected file on VPS |
| Backup encryption key | Off-host encrypted backups | Protected file on VPS, separate from DB host if possible |
| Registry/deploy credentials | CI image push, VPS deploy | GitHub Actions secrets + protected file on VPS |
| Optional OAuth secrets (P1) | Google/Telegram/Discord sign-in | Protected file on VPS |

Generate with official supported tooling and validate format/compatibility; do not copy sample defaults. Store protected runtime secrets outside repo, e.g. `/etc/hasheemstudio/` owned by appropriate service identities. Git ignores are not sufficient: scan history and built frontend bundles for accidental leaks before every push.

## Media processing sandbox

- Non-root worker, dropped capabilities, no privileged containers, read-only root filesystem, scoped writable scratch, seccomp/AppArmor where available. No host Docker socket.
- FFmpeg protocols restricted to required local inputs; deny remote URLs/playlists/SSRF and arbitrary filesystem traversal.
- Never execute file names as shell fragments — pinned FFmpeg/FFprobe invoked via argument arrays only.
- Cap probe/processing time, threads, output size and scratch disk. Decode failures are errors, not success with a broken file.

## Monitoring

`/health/live` must be cheap; `/health/ready` tests required dependencies without leaking details; startup probe tolerates startup. Alert on error rate, queue age, stale leases, storage watermarks, Redis persistence/memory, DB connection pressure, backup age, email failures, certificate expiry and host capacity. Redact emails/tokens/filenames where not necessary. Debounce critical alerts; avoid routine recovery spam.

## Current status

No secrets have been generated or provisioned for this project yet (see `docs/STATUS.md`). Threat model and security test suite (`tests/security/`) are Phase 3+ deliverables, not yet implemented.
