# ADR-0004: Use Supabase's official Envoy gateway, not Kong

**Status:** Accepted
**Date:** 2026-09-16

## Context

`docs/MASTER-PLAN-ORIGINAL.md` (written 2026-09-16) refers to "Kong" as the API gateway in front
of Auth/REST/Storage/Meta, matching Supabase's self-hosted Docker Compose reference at the time the
master plan was researched. When actually fetching the current official
`supabase/supabase` `docker/docker-compose.yml` (also on 2026-09-16, same day), the upstream
project has replaced Kong with its own Envoy-based gateway (service name `api-gw`, container
`supabase-envoy` upstream), with Kong-compatible network aliases (`envoy`, `kong`) kept for
backward compatibility. See https://github.com/orgs/supabase/discussions/48048 (referenced in the
fetched compose file's own comment).

## Decision

Use the current official Envoy gateway as fetched, not a pinned older Kong-based release. This
keeps us on "official pinned self-hosted Supabase components" (a hard constraint from the master
plan, §9) rather than reconstructing an outdated Kong config by hand. Container renamed
`hasheemstudio-envoy` (from upstream's `supabase-envoy`) to avoid colliding with the *other*
project's `supabase-kong` container already running on this shared VPS.

Trimmed from the upstream reference: `realtime` and `functions` services are not included (not
needed for any P0 requirement in `docs/PRD.md`). The gateway's static routes for
`/realtime/*` and `/functions/*` will error if hit; this is accepted and documented in
`docs/ENVIRONMENTS.md`, not silently hidden.

## Consequences

- Any future reference to "Kong" in `docs/MASTER-PLAN-ORIGINAL.md` should be read as "the Supabase
  API gateway," currently Envoy — the original document is retained unedited per its own rule, this
  ADR is the correction layer.
- If upstream Supabase changes the gateway again, re-fetching `docker/docker-compose.yml` and
  diffing against `infra/compose/docker-compose.yml` is the way to pick up the change, rather than
  hand-patching individual settings indefinitely.
- Realtime/Functions can be added later (Phase 9+ or if a P1/P2 feature needs them) by fetching
  those service blocks from the same upstream file and re-adding them, plus a compose config
  validation pass.
