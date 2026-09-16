# Backup and restore

> Split from `docs/MASTER-PLAN-ORIGINAL.md` §8 (RPO/RTO targets) and §16 (backup requirements).
> Not yet implemented — see `docs/STATUS.md`.

## Targets (to validate, not yet measured)

- Database RPO target 15 minutes with tested WAL/offsite backup configuration.
- RTO target 2 hours after restore rehearsal. Nightly dumps alone do not meet the RPO target.
- 99.5% beta availability target with honest single-host limitations; consider 99.9% only after redundant infrastructure and recovery tests.

## Requirements

Encrypted off-host Postgres base backups plus WAL archiving for the stated RPO, configs and necessary storage metadata. Temporary media retention may intentionally exclude originals from backups, but this must be stated in UX/privacy and recovery docs — distinguish media recoverability from DB recoverability clearly to users. Test a restore into isolated staging and compare critical records; record restore duration and actual RPO. Kubernetes etcd backup is not a Postgres backup and does not substitute for one.

## Current status

No backup destination or encryption key has been provisioned. This is an owner-input blocker (approved off-host backup/object-storage provider, region, budget) — see `docs/DECISIONS.md`. No restore rehearsal has been performed.
