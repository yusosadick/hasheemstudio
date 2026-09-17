# Capacity model

> Split from `docs/MASTER-PLAN-ORIGINAL.md` §13. Updated 2026-09-17 with real measured data — see
> "Measured results" below. An executable calculator implementing the formulas below from
> arbitrary inputs is still not built (`scripts/verify/capacity.mjs`); the measurements below were
> computed by hand from real `tests/load/*` runs, not by that calculator.

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

## Current host snapshot (observed 2026-09-17, NOT reserved capacity)

- 12 logical CPUs, ~47 GiB RAM total (~6.2 GiB free / ~22 GiB "available" at inspection time — the difference is reclaimable page cache), 387 GB root disk with 248 GB free.
- This is a shared VPS already running Hasheem Gaming, its dedicated Supabase stack, Coolify, Immich, Penpot, Strapi, GlitchTip, Firecrawl, monitoring (Prometheus/Grafana/Loki/Uptime Kuma), VPN, and other services — see `docs/ENVIRONMENTS.md` for the full inventory.
- **Material, disclosed confound on every measurement below:** at the time of testing, 4 long-running `certutil -N -d sql:/home/pentester/.pki/nssdb --empty-password` processes (owned by users `yuso`/`ubuntu`, running since 2026-08-29, part of an unrelated security-sandbox/Strix project on this same host) were each consuming ~72-73% of one core continuously, i.e. roughly 3 cores' worth of sustained background load. 1-minute load average during testing was ~24-32 on a 12-core host. These processes are **out of scope for Hasheem Studio and were not touched** — they belong to another project on this shared VPS — but they are real, current contention that the numbers below were measured under, not a clean/idle baseline. Re-measure once that contention is gone or on dedicated infrastructure before treating these as ceilings.
- Current free disk (248 GB) is less than one day of the example 300 GB/day input volume in the original planning scenario above. **Do not launch at that demand using local disk and long retention.** Start admitted beta throughput conservatively, use short retention, and obtain a budget-approved separate object-storage/failure domain before scaling. Never count this host's unused disk as allocated storage for both Hasheem Studio and other projects simultaneously.

## Initial worker concurrency

Conservative starting point (subject to measured isolation): one encode slot and one remux slot. Apply hard CPU/RAM/PID/scratch budgets and reserve headroom for existing services. This is an initial test setting, not an advertised SLA. Reject or queue admission when storage watermark or compute budget is reached; do not crash other apps.

## Measured results (2026-09-17, this host, under the contention disclosed above)

Real runs via `tests/load/api-latency.mjs` and `tests/load/queue-throughput.mjs`, against the local `dev:up` stack (same containerised, sandboxed worker and Postgres/Supavisor topology as staging/production — see `docs/ARCHITECTURE.md`). Raw evidence: `docs/evidence/phase7-capacity/api-latency-report.json`, `docs/evidence/phase7-capacity/queue-throughput-remux-report.json`.

### API latency — `GET /v1/jobs/:id` (authenticated, indexed lookup + join)

PRD target: p95 < 300ms, error rate < 1%, excluding auth providers/uploads/media work.

| Concurrency | Requests | Errors | p50 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| 10 | 100 | 0 | 68ms | 139ms | 207ms | 207ms |
| 25 | 250 | 0 | 105ms | 191ms | 209ms | 216ms |
| 50 | 500 | 0 | 250ms | **391ms** | 409ms | 437ms |

**Verdict: does NOT meet the PRD's p95 < 300ms target at concurrency=50**, under host load ~31-33 (vs. an earlier same-day run at lower host load ~26 that did meet it, p95=289ms — both runs are real; the difference is host contention, not code changes). Error rate is 0% at every tested level. This is reported as an honest, contention-sensitive result, not smoothed to the more favorable run. Action: re-test once the host is not sharing ~3 cores with the unrelated `certutil` processes above, and consider this a soft-real-time budget, not a hard guarantee, on shared infrastructure.

### Queue throughput — remux recipe, one job per distinct tenant (isolates worker throughput from per-tenant quota limits)

- 10/10 jobs succeeded, 0 failed, 0 timed out.
- Total wall clock: 194.0s for 10 jobs → **0.052 jobs/sec ⇒ ~4,454 jobs/day at the current `concurrency: 1` setting.**
- Per-job total time (submission to terminal state): p50=8.16s, p95=14.24s, max=14.24s.
- Worker container CPU sampled every ~2s during the run: near-0% between jobs, spiking to 98-127% (i.e. essentially one full core) only while actively transcoding — confirms jobs are processed **strictly serially**, never overlapping.
- Worker container memory stayed low throughout: ~56 MiB idle, peaking at 171 MiB during the largest job — RAM is not the constraint at this concurrency.

**Known, documented bottleneck: `apps/worker/src/queue.ts` hard-codes BullMQ `concurrency: 1`.** The ~4,454 jobs/day figure is a direct consequence of that single line, not a hardware ceiling — CPU and memory both have visible headroom between job spikes on a 12-core/47GiB host even under the current unrelated contention. Raising `concurrency` (e.g. to 2-4, then re-measuring, not guessing) is the first lever before any hardware change; it must be re-validated against the sandboxed worker's per-job resource limits and the shared host's actual free capacity (currently reduced by the `certutil` load above), not assumed safe.

### Reconciling against the original planning scenario

The Phase-0 planning example above (3,000 jobs/day at 10,000 registered / 1,000 DAU) is **comfortably below** the measured ~4,454 jobs/day ceiling at `concurrency: 1` for the remux recipe specifically. It does **not** mean the platform is capacity-safe at that scale: encode-recipe throughput has not yet been separately benchmarked (encode jobs are expected to take materially longer than remux per the original scenario notes, and PRD explicitly requires separate encode/remux benchmarks — not done in this pass, tracked as a gap below), the measurement was taken under contended host conditions that inflate wall-clock time, and disk headroom (248 GB free) remains the tighter constraint at real 10,000-account scale, as already noted above.

## Known gaps in this capacity pass

- Encode-recipe throughput (H.264 re-encode path) has not been separately load-tested — only remux. PRD requires separate encode/remux benchmarks; only remux is done.
- `scripts/verify/capacity.mjs`, an executable calculator from the formulas above given arbitrary inputs, is still not built — the numbers above were computed by hand from real test-script output, not generated by such a calculator.
- No sustained/burst test in isolated staging infrastructure has been run (PRD calls for that in addition to this local measurement) — this pass reused the local `dev:up` stack on the same shared production VPS, under real but uncontrolled contention from an unrelated project's processes.
- Disk IOPS and network egress were not separately measured in this pass — only CPU, memory, host load, and end-to-end latency/throughput.

## Load tests (Phase 7, staging only)

10,000 synthetic accounts in staging only; 500 dashboard sessions; concurrent upload tests starting small; realistic mixed-media queue workloads; measure queue wait, processing time, CPU, memory, disk IOPS and egress. Run sustained and burst tests only in isolated approved infrastructure. Provide p50/p95/p99 and per-recipe breakdown, not one average. **Status: partially done — see "Measured results" above for what has actually been run so far; the full staging-scale version described in this paragraph remains outstanding.**
