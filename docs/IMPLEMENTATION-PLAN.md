# Implementation Plan

> Split from `docs/MASTER-PLAN-ORIGINAL.md` Part IV. Live status against this plan is in
> `docs/STATUS.md` — this file is the fixed plan, not the tracker.

## Delivery method

For each phase: break into small named tasks; add failing tests for testable behaviour; implement; run tests; run integration/browser checks; independently review; commit; update docs/STATUS.md and evidence. Parallelise bounded frontend/backend/infra work using separate worktrees and file ownership. One migration owner and one deployment coordinator prevent conflicts. Do not let parallel agents independently change production.

### Phase 0 — discovery and first GitHub push

Files: `README.md`, `CLAUDE.md`, `AGENTS.md`, `docs/*`, `.gitignore`, `.env.example`, workspace scaffold.

Tasks: inventory repo/access, domains, host capacity, existing services and DNS; select runtime versions from current upstream support; threat model and ADRs; create first commit; scan secrets; push and remote-readback. Establish a requirements checklist with P0/P1/P2 status.

Gate: remote SHA evidence exists; no production changes; constraints and remaining credentials identified.

### Phase 1 — design system and interaction prototype

Files: `packages/ui/src/tokens.css`, UI primitives, `apps/web/src/routes`, component stories/tests, `docs/DESIGN-SYSTEM.md`.

Tasks: exact tokens, accessible derived colours, typography/spacing, dual theme, landing/upload/result prototypes, mobile states, screenshot review and owner feedback. Implement keyboard/focus tests and visual baselines.

Gate: three key screens rendered at required widths in both themes; no clipping, fake functionality or unreadable contrast. Visual approval status recorded.

### Phase 2 — isolated infrastructure and environment automation

Files: `infra/compose/*`, `scripts/ops/doctor.*`, setup/config validation scripts, env inventory, ingress and secret templates.

Tasks: independent Supabase stack, Redis, private storage, scoped proxy routes, healthchecks/resources, protected secrets, backup destination and DNS/TLS. Validate dry-run output then deploy staging. Test restart/persistence. Idempotent provisioning must leave healthy unchanged services untouched.

Gate: service health AND real auth/DB/storage connectivity, private-port verification, no shared-app regression. Missing DNS or paid resources remains a specific blocker.

### Phase 3 — schema, auth, tenancy and migration runner

Files: ordered `supabase/migrations/*.sql`, `scripts/db/remote.mjs`, API auth/tenancy modules, `tests/security/rls.*`, `tests/integration/migrations.*`.

Tasks: schema and constraints; registration workspace creation; complete identity flows; RLS negative tests; operational migration interface; staging migration over SSH and live readback.

Gate: user A cannot read/write user B's resources; cannot self-promote; real live migration verified. Generated type definitions reflect migrated schema.

### Phase 4 — upload-to-download vertical slice

Files: API uploads/jobs modules, worker probe/remux modules, storage adapter, frontend upload/results, media fixtures and E2E tests.

Tasks: quota reservation, resumable private upload, finalisation, outbox dispatch, sandbox probe/remux, output verification, playback/download/delete and expiry sweeper.

Gate: a real fixture uploaded through browser, processed on VPS, downloaded and decoded; interrupted upload recovers; access denial and output expiry tested. No mock success in production code.

### Phase 5 — compatibility recipes and reliability

Files: encode recipes, preset versioning, attempt leases/reconciler, fair queue, usage ledger, worker constraints and cancellation.

Tasks: H.264/AAC conversions; rotation/VFR/HDR policies; worker kill/queue duplicate/Redis restart tests; exactly-once settlement semantics; bounded retries and storage admission.

Gate: fixture matrix passes; unsupported cases explained; repeat delivery does not duplicate charges/output; processes cannot escape limits.

### Phase 6 — Resend, administration and compliance UX

Files: `packages/emails` if needed, API outbox/webhooks/admin modules, frontend settings/admin, privacy/terms drafts.

Tasks: secure SMTP/API config, verified DNS, real auth/job emails, replay-safe webhooks, audited admin actions, export/deletion and retention.

Gate: observed delivery plus approved inbox evidence, admin RBAC negative tests, actual object deletion evidence. No live payment UI until billing is approved and tested.

### Phase 7 — performance, resilience and launch gate

Files: `tests/load`, `scripts/verify`, CI workflows, backup/restore and capacity reports.

Tasks: unit/integration/security/E2E suite, browser matrix, image scans, off-host backup and isolated restore, bounded staging load, API/media benchmarks, accessibility, documentation and rollback rehearsal.

Gate: honest measured report versus SLOs, unresolved issues list, working production domain, visible UI and complete user journey. A passing localhost curl is insufficient.

### Phase 8 — Kubernetes expansion

Files: `infra/k8s`, node bootstrap/decommission runbooks, autoscaling configs, network policies and scale-out ADR.

Tasks: real-cluster rehearsal; dedicated-node inventory/approval; production deployment if nodes available; private stateful-service connectivity; scaling/draining; node-failure and backup checks; cutover/rollback.

Gate: render/apply manifests, real rollout status, workload tests, queue scaling evidence and node capacity limits. If only rehearsal hardware exists, label Kubernetes as tested rehearsal and production expansion pending.

### Phase 9 — growth features

Deliver P1 one feature at a time after usage/cost evidence: batch/ZIP, team invitations, saved presets, crop preview, billing and later API access. Re-run quotas, tenant isolation and resource tests for each.

## Definition of done — evidence matrix

| Area | Required evidence |
|---|---|
| GitHub | pushed branch, matching remote SHA, clean secret scan |
| Design | both themes and mobile/desktop screenshots, approval status, accessibility findings |
| DNS/TLS | authoritative records and actual HTTPS browser load |
| Auth | real registration/verification/reset, tested sessions and redirects |
| Migration | SSH target identity, version ledger, live schema/RLS readback |
| Upload | allowed max-size and interrupted/retry test through actual ingress |
| Processing | real input/output, media reports, playback and downloadable file |
| Isolation | tenant A/B negative tests, admin escalation denial, worker constraints |
| Reliability | killed worker, duplicate job, cancellation, Redis restart and reconciler tests |
| Email | Resend event + inbox evidence where available; explicit gaps otherwise |
| Operations | reboot/restart recovery, expiry cleanup, monitoring alert test |
| Recovery | off-host backup and isolated restore with measured timing |
| Capacity | dated environment, recipe corpus, raw metrics and honest limitations |
| Kubernetes | real-cluster validation, rollback and explicit deployed/not-deployed status |
| Mac handoff | fresh-clone instructions and actual remote migration workflow |

Evidence must be sanitised. Never commit test customers' media or credentials. Every report includes failures and unverified items. No declaration of 10,000-user readiness before relevant capacity and isolation gates pass.
