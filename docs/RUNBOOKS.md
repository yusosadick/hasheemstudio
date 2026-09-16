# Runbooks

Operational runbooks for Hasheem Studio. Each runbook should be added as it becomes relevant to an
implemented, deployed capability — a runbook for a feature that doesn't exist yet is fiction, so
this file only lists runbooks that are real (tested against the actual system) versus planned.

## Status

No services are deployed yet (see `docs/STATUS.md`), so no runbook below has been exercised
end-to-end. Each entry states this explicitly until it has.

## Planned runbooks (not yet written/tested)

- **Worker stuck / queue backlog growing** — how to inspect BullMQ queue depth, dead-letter jobs,
  and safely redrive or drain.
- **Database connection exhaustion** — how to identify pool saturation via Supavisor/pooler
  metrics and safely restart affected services without data loss.
- **Certificate expiry / TLS failure on hasheemstudio.com** — verification and renewal path via the
  existing Coolify/Traefik proxy, without touching other projects' certificates.
- **Resend delivery failures / bounces spike** — how to check webhook-reported bounce/complaint
  rates and pause sending if needed.
- **Disk watermark reached on shared VPS** — how Hasheem Studio's own admission control reacts, and
  how to confirm it did not starve other projects' disk usage.
- **Redis (hasheemstudio-redis) restart / AOF recovery** — expected job-state recovery behaviour
  via the Postgres outbox, and how to confirm no accepted job was lost.
- **Rollback a bad deploy** — see `docs/ROLLBACK.md`.
- **Restore from backup into isolated staging** — see `docs/BACKUP-RESTORE.md`.

Each runbook above should be written and *validated by actually triggering the condition in
staging* before being marked complete here, per `docs/IMPLEMENTATION-PLAN.md` Phase 7.
