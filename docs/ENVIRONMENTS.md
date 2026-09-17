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

**Live as of 2026-09-17.** `hasheemstudio.com` NS records point to Cloudflare
(`christian.ns.cloudflare.com`, `cora.ns.cloudflare.com`). A/records were added for apex, `www`,
`api` and `supabase`, all pointing at this host's public IP, all DNS-only (not Cloudflare-proxied).
Real Let's Encrypt certificates were issued via the existing shared `coolify-proxy` (Traefik v3)
using a new static dynamic-config file — see "Public ingress wiring" below. No `media` subdomain
exists yet (not needed; media is served through the `supabase` storage API path). Full verification
evidence: `docs/evidence/phase7-launch/public-launch-verification.json`.

| URL | Serves |
|---|---|
| `https://hasheemstudio.com`, `https://www.hasheemstudio.com` | `hasheemstudio-web` (production Vite build, served by nginx) |
| `https://api.hasheemstudio.com` | `hasheemstudio-api` (Fastify) |
| `https://supabase.hasheemstudio.com` | `hasheemstudio-envoy` (Supabase gateway — auth/rest/storage) |

## Public ingress wiring

Two new containers were added to `infra/compose/docker-compose.yml`: `api` (`apps/api/Dockerfile`)
and `web` (`apps/web/Dockerfile`, a production Vite build served by `nginxinc/nginx-unprivileged`).
Neither publishes a host port. `hasheemstudio-api`, `hasheemstudio-web` and the pre-existing
`hasheemstudio-envoy` each additionally join the host's pre-existing external `coolify` Docker
network — the same network `coolify-proxy` (Traefik) and every other routed app on this host
already share — solely so Traefik can resolve them by container name. Routing itself is defined in
a new static file, `infra/coolify-proxy-dynamic/hasheemstudio-site.yaml` (tracked in this repo),
deployed to `/data/coolify/proxy/dynamic/hasheemstudio-site.yaml` on the host (root-owned, mode
644, matching every pre-existing file in that directory). This mirrors the exact pattern already
used there for the Hasheem Gaming site and its Supabase API (`hasheemgaming-site.yaml`,
`hasheem-kong.yaml`) — found by inspecting those pre-existing files, not invented. Only a new file
was added; every pre-existing file in that directory was verified untouched (byte-identical
directory listing before/after).

## Supabase database identity marker

Not yet created. Per `docs/MIGRATIONS.md`, the first migration must create an explicit bootstrap
marker (e.g. a `_hasheemstudio_bootstrap` marker table/row) so the remote migration runner can
distinguish this project's database from any other Postgres instance on the host, rather than
guessing from an existing schema.

## Dedicated hasheemstudio Compose stack (Phase 2, running on this VPS as of 2026-09-16)

Started via `infra/compose/docker-compose.yml`, Compose project name `hasheemstudio`
(`docker compose --env-file /etc/hasheemstudio/local.env -f infra/compose/docker-compose.yml -p hasheemstudio ...`).
Adapted from the official `supabase/supabase` `docker/docker-compose.yml` reference (Envoy-based
gateway, not Kong — see `docs/adr/0004-envoy-gateway.md`), trimmed of `realtime` and `functions`
(not needed for P0; see that ADR for the tradeoff), with a dedicated Redis added. All ports below
are bound to `127.0.0.1` only — nothing here is publicly reachable yet.

| Container | Image | Purpose | Published port |
|---|---|---|---|
| `hasheemstudio-db` | `supabase/postgres:17.6.1.136` | Postgres | none (internal only) |
| `hasheemstudio-pooler` | `supabase/supavisor:2.9.12` | Connection pooler (session + transaction) | `127.0.0.1:55432` (session), `127.0.0.1:56543` (transaction) |
| `hasheemstudio-envoy` | `envoyproxy/envoy:v1.39.1` | API gateway (auth/rest/storage/meta/studio routing) | `127.0.0.1:58000` |
| `hasheemstudio-auth` | `supabase/gotrue:v2.196.0` | Auth | via gateway only |
| `hasheemstudio-rest` | `postgrest/postgrest:v14.17` | REST | via gateway only |
| `hasheemstudio-storage` | `supabase/storage-api:v1.74.0` | Storage (file backend, see ADR-0003) | via gateway only |
| `hasheemstudio-imgproxy` | `darthsim/imgproxy:v3.31.4` | Storage image-transform dependency | internal only |
| `hasheemstudio-meta` | `supabase/postgres-meta:v0.99.0` | Postgres metadata for Studio | internal only |
| `hasheemstudio-studio` | `supabase/studio:2026.09.07-sha-7996410` | Admin dashboard | via gateway only (basic-auth protected, `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD`) |
| `hasheemstudio-redis` | `redis:7.4-alpine` | Queue/dispatch backing store | `127.0.0.1:56379`, ACL password required, `appendonly yes`, `maxmemory-policy noeviction` |

Secrets generated by `scripts/ops/generate-supabase-secrets.mjs --env local` into
`/etc/hasheemstudio/local.env` (mode 600, owned by `yuso` — **not yet a dedicated service user**,
see "Known gaps" below). Values were never printed to any log or chat, with the single exception of
`ANON_KEY`, which is the Supabase anon/publishable key — intentionally public by design (embedded
in frontend bundles, protected by RLS, not a secret) — and was echoed once during connectivity
debugging on 2026-09-16.

**Verified real connectivity (2026-09-16), not just container health:**
- `GET /auth/v1/health` via the gateway → real GoTrue version response.
- `GET /storage/v1/status` via the gateway → HTTP 200.
- `GET /rest/v1/` with `SERVICE_ROLE_KEY` → real PostgREST OpenAPI schema document.
- `GET /rest/v1/no_such_table` with `ANON_KEY` → correctly passes gateway RBAC, then a real
  PostgREST 404 (`PGRST205`) — confirms anon-key requests reach PostgREST with the DB actually
  queried, and confirms the gateway's stricter `SERVICE_ROLE_KEY`-only rule on the REST root
  (openapi listing) is working as designed, not a misconfiguration.
- Direct `psql` connection through the Supavisor pooler (`127.0.0.1:55432`) → real
  `SELECT version()` result.
- `redis-cli -a <password> ping` → `PONG`; the same command with a wrong password → correctly
  rejected with `WRONGPASS`.
- Confirmed the existing Hasheem Gaming Supabase stack (`supabase-*` containers), Coolify, and
  `hasheem-web-*` all remained `healthy` throughout — no collision, no regression.

**Known gaps (honest, not yet done):**
- Runs under the `yuso` user, not a dedicated least-privilege service account.
- Not reachable publicly yet — blocked on DNS (`docs/DECISIONS.md` item 1) and on deliberately
  wiring a Coolify/Traefik route, which has not been done.
- No `supabase/migrations/*.sql` applied yet — the database has no application schema, only the
  stock Supabase bootstrap schema. `scripts/db/remote.mjs` (Phase 3) doesn't exist yet either, so
  this stack was verified with raw `psql`/`curl`, not the eventual migration runner.
- No automated backup configured for this stack yet (`docs/BACKUP-RESTORE.md`).
- `realtime` and `functions` services are intentionally not running (not needed for P0); their
  Envoy gateway routes will return errors if hit.

## Secret file locations (names/paths only — no values)

Not yet created. Planned: `/etc/hasheemstudio/<env>.env`, owned by a dedicated service user, mode
0600, referenced by Compose/K8s secret mounts — never checked into git. See `docs/SECURITY.md`.

## Backup destination

Not yet selected — owner-approved off-host object storage/provider decision pending, see
`docs/DECISIONS.md`.

## Last restore evidence

None. No backup has been taken yet.
