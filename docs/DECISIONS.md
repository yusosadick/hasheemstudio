# Decisions requiring owner input

> Split from `docs/MASTER-PLAN-ORIGINAL.md` §24, kept current as items resolve. Unblocked work
> continues in parallel with all open items below — see `docs/STATUS.md`.

## Open — blocking specific downstream work only

| # | Decision needed | Blocks | Status as of 2026-09-16 |
|---|---|---|---|
| 1 | DNS provider and secure record-management access for `hasheemstudio.com` | Phase 2 (DNS/TLS), Phase 6 (Resend domain verification) | NS records point to Cloudflare (`christian.ns.cloudflare.com`, `cora.ns.cloudflare.com`), confirmed via `dig`. No Cloudflare API token or dashboard access found on the VPS. **Need: either a scoped Cloudflare API token for this zone, or the owner to add records manually from instructions we provide.** |
| 2 | Resend key/domain access and an approved inbox for delivery verification | Phase 6 (email) | No Resend credentials found anywhere accessible on the VPS. **Need: Resend account access or API key with domain-verification scope, plus an inbox we can check for test delivery.** |
| 3 | Confirmed platform-owner email for admin bootstrap | Phase 6 (admin RBAC bootstrap) | Not yet provided. |
| 4 | Approved off-host backup/object-storage provider, region and budget | Phase 2 (backups), possibly ADR-0003 (media storage) | Not yet approved. Current VPS free disk (260 GB) is insufficient for the planning-scenario retention volume — see `docs/CAPACITY.md`. |
| 5 | Whether production Kubernetes nodes exist or need budget approval | Phase 8 | Not yet answered. Default: Stage A (Docker Compose) only; Kubernetes stays at rehearsal level until nodes are approved. |
| 6 | Commercial plan prices, payment provider and legal entity details | Phase 9 / billing | Not needed for P0. Checkout stays disabled. |
| 7 | Final support/reply-to address and policy approval | Phase 6, `docs/PRD.md` §7 legal/terms | Not yet provided. |

## Defaults in effect until the above resolve

Dedicated existing-VPS beta isolation, free/invite beta with hard limits, English/Swahili-ready UI,
no paid checkout, no GPU feature, no public production claim while a launch gate is blocked.

## Non-blocking discovery notes (not decisions, just recorded facts)

- The candidate VPS (`169.58.72.101`, `yuso`) is confirmed to be reachable and is the environment
  this session is running in — it is a real, shared, already-loaded production host, not a fresh
  box. See `docs/ENVIRONMENTS.md`.
- SSH access to `github.com:yusosadick/hasheemstudio.git` is confirmed working (read access
  verified via `git ls-remote`; write access to be confirmed by the actual first push — recorded in
  `docs/STATUS.md` once done).
