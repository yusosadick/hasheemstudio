# Environment inventory (non-secret)

> Per `docs/MASTER-PLAN-ORIGINAL.md` §18. Values here are observed or explicitly proposed —
> marked which. No secret values, private keys, full DSNs, kubeconfigs or auth tokens are recorded
> here, only identifiers and file *locations*.

## Host

| Field | Value | Status |
|---|---|---|
| Hostname | `vmi3464308` | Observed 2026-09-16 |
| Public IPv4 | `169.58.72.101` | Observed |
| SSH user | `yuso` | Observed (member of `docker`, `sudo` groups) |
| OS | Ubuntu 24.04.4 LTS, kernel 6.8.0-136-generic | Observed |
| CPU / RAM / disk | 12 logical CPUs, ~47 GiB RAM (~22 GiB available at snapshot time), 387 GB root disk (~260 GB free) | Observed snapshot, not reserved capacity — see `docs/CAPACITY.md` |
| Firewall | UFW active; 80/443/22 allowed globally, plus project-specific allow rules for existing services | Observed — **do not modify** |
| Existing reverse proxy | `coolify-proxy` (Traefik v3.6, container), binds 0.0.0.0:80 and 0.0.0.0:443 | Observed — **new services must attach via Coolify-managed routing, never claim 80/443 directly** |

## Existing services sharing this host (do not modify, do not reuse)

Observed via `docker ps` on 2026-09-16. Non-exhaustive list of what must be preserved:

- Coolify (`coolify`, `coolify-db`, `coolify-redis`, `coolify-realtime`, `coolify-sentinel`, `coolify-proxy`)
- A dedicated self-hosted Supabase stack for another product (`supabase-db`, `supabase-auth`, `supabase-rest`, `supabase-storage`, `supabase-studio`, `supabase-kong`, `supabase-pooler`, `supabase-meta`, `supabase-imgproxy`, `supabase-edge-functions`, `clip-sidecar`) — **Hasheem Studio must never reuse this stack, its DB, its keys, or its auth users**
- `hasheem-web-*` (multiple release/candidate containers) and `hasheem-gaming/` project directory
- G0DM0D3, Immich, Penpot, Nextcloud, Strapi + its Postgres, GlitchTip + its Postgres/Redis, Firecrawl (+RabbitMQ/Postgres/Redis), Stirling PDF, MTProto Telegram proxy, FreeRADIUS (nasek)
- Monitoring/ops stack: `hermes-prometheus`, `hermes-grafana`, `hermes-loki`, `hermes-blackbox`, `hermes-node-exporter`, `hermes-uptime-kuma`, `hermes-minio`, `hermes-postgres` (pgvector), `hermes-redis`, `hermes-vaultwarden`
- WireGuard / OpenVPN / Tailscale VPN routes; Wazuh agent/enroll/API restricted to `tailscale0`

Docker networks already in use (observed, for collision avoidance): `bridge`, `compose_default`, `coolify`, `firecrawl_backend`, `g0dm0d3_default`, `glitchtip_internal`, `hermes-system_infra`, `supabase_default`, `telegram-proxy_default`, and several per-app auto-generated names. **Hasheem Studio uses its own `hasheemstudio`-prefixed Compose project, network and volume names — confirmed none exist yet as of 2026-09-16.**

Ports already bound on the host (observed, avoid reusing): 22, 53, 80, 443, 443/udp, 1194/udp (OpenVPN), 1514/1515/55000 (Wazuh, tailscale-only), 2053 (MTProto), 3000-3002, 3005, 3100, 5432, 5433, 6001-6002, 6379, 6380, 6543, 8000-8004, 8010, 8080-8081, 8087, 8443-8444, 8890-8891, 9000-9001, 9090, 9100, 9115, 9200, 9300, 20241, 32770-32777, 51820/udp (WireGuard), 55000.

## hasheemstudio environments

| Environment | SSH alias | Compose project / K8s namespace | Status |
|---|---|---|---|
| local (developer laptop) | n/a | `hasheemstudio` (Compose) | To be defined in Phase 2 |
| staging | `hasheemstudio-staging` (proposed, not yet in `~/.ssh/config`) | `hasheemstudio-staging` | Not provisioned |
| production | `hasheemstudio-prod` (proposed; candidate host `169.58.72.101`) | `hasheemstudio` | Not provisioned |

No dedicated deploy SSH key exists yet for Hasheem Studio. `~/.ssh/id_ed25519` (comment `vps-hermes`) currently authenticates to GitHub as `yusosadick` and has confirmed read access to `github.com:yusosadick/hasheemstudio.git`; using the owner's own key for initial bootstrap is acceptable per `docs/MASTER-PLAN-ORIGINAL.md` §19, but deploy automation should transition to a dedicated least-privilege key once provisioned.

## Ingress URLs

None resolve yet. `hasheemstudio.com` NS records point to Cloudflare (`christian.ns.cloudflare.com`, `cora.ns.cloudflare.com`) as observed 2026-09-16, but no A/AAAA/CNAME records are published for apex, `www`, `api`, `supabase`, or `media`. See `docs/DECISIONS.md` for the DNS access blocker.

## Supabase database identity marker

Not yet created. Per `docs/MIGRATIONS.md`, the first migration must create an explicit bootstrap
marker (e.g. a `_hasheemstudio_bootstrap` marker table/row) so the remote migration runner can
distinguish this project's database from any other Postgres instance on the host, rather than
guessing from an existing schema.

## Secret file locations (names/paths only — no values)

Not yet created. Planned: `/etc/hasheemstudio/<env>.env`, owned by a dedicated service user, mode
0600, referenced by Compose/K8s secret mounts — never checked into git. See `docs/SECURITY.md`.

## Backup destination

Not yet selected — owner-approved off-host object storage/provider decision pending, see
`docs/DECISIONS.md`.

## Last restore evidence

None. No backup has been taken yet.
