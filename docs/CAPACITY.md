# Capacity model

> Split from `docs/MASTER-PLAN-ORIGINAL.md` §13. This document defines the formulas; an executable
> calculator implementing them is a Phase 7 deliverable (`scripts/verify/capacity.mjs`, not yet
> built — see `docs/STATUS.md`).

10,000 registered accounts is a data-size objective, not 10,000 encoders. Planning example, NOT measured demand:

- 10,000 registered; 1,000 daily active; 3 jobs/active user/day = 3,000 jobs/day.
- Mean 100 MB input = 300 GB input/day before output, intermediates, replication or backups.
- Hypothetical average 60-second processing time at 60% slot utilisation requires about 3.47 continuously available slots before peak headroom; round provision up only after measurement. A slot is not necessarily one CPU core.
- Encode jobs may take far longer than remux jobs, so separate benchmarks and queues are mandatory.

## Formulas (to implement in an executable calculator)

```
worker_slots >= jobs_per_day * mean_processing_seconds / (86400 * target_utilisation)
storage_bytes >= daily_input_bytes * retention_days * (1 + output_ratio) + peak_scratch + safety_margin
network_egress >= downloads * average_output_bytes + replication_egress
cost_per_success = compute + storage + bandwidth + email + shared_overhead + failed_attempt_cost
```

## Current host snapshot (observed 2026-09-16, NOT reserved capacity)

- 12 logical CPUs, ~47 GiB RAM total (~22 GiB available at inspection time), 387 GB root disk with 260 GB free.
- This is a shared VPS already running Hasheem Gaming, its dedicated Supabase stack, Coolify, Immich, Penpot, Strapi, GlitchTip, Firecrawl, monitoring (Prometheus/Grafana/Loki/Uptime Kuma), VPN, and other services — see `docs/ENVIRONMENTS.md` for the full inventory.
- Current free disk (260 GB) is less than one day of the example 300 GB/day input volume in the planning scenario above. **Do not launch at that demand using local disk and long retention.** Start admitted beta throughput conservatively, use short retention, and obtain a budget-approved separate object-storage/failure domain before scaling. Never count this host's unused disk as allocated storage for both Hasheem Studio and other projects simultaneously.

## Initial worker concurrency

Conservative starting point (subject to measured isolation): one encode slot and one remux slot. Apply hard CPU/RAM/PID/scratch budgets and reserve headroom for existing services. This is an initial test setting, not an advertised SLA. Reject or queue admission when storage watermark or compute budget is reached; do not crash other apps.

## Load tests (Phase 7, staging only)

10,000 synthetic accounts in staging only; 500 dashboard sessions; concurrent upload tests starting small; realistic mixed-media queue workloads; measure queue wait, processing time, CPU, memory, disk IOPS and egress. Run sustained and burst tests only in isolated approved infrastructure. Provide p50/p95/p99 and per-recipe breakdown, not one average.
