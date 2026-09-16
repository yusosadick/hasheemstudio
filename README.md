# Hasheem Studio

> Your video's best upload starts here.

Hasheem Studio is a trustworthy international creator workspace that inspects, prepares, verifies and delivers video files for social publishing. It is built by Bisso Technologies Ltd for hasheemstudio.com.

**Status: early scaffold.** No production deployment, DNS, or paid service exists yet. See [`docs/STATUS.md`](docs/STATUS.md) for the authoritative, current state of every phase and blocker — read that before assuming anything here is live.

## What this is

A monorepo containing:

- `apps/web` — React + Vite + TypeScript + Tailwind frontend.
- `apps/api` — Fastify + TypeScript API.
- `apps/worker` — BullMQ + TypeScript media worker (FFmpeg/FFprobe orchestration).
- `packages/*` — shared contracts, UI primitives, config and media-recipe logic.
- `supabase/` — self-hosted Supabase migrations and config (dedicated project, never shared with other Hasheem/Bisso products).
- `infra/` — Docker Compose (Stage A) and Kubernetes manifests (Stage B, rehearsal/pending).
- `scripts/` — operational tooling, including the remote migration runner.
- `tests/` — unit, integration, security, e2e and load suites.
- `docs/` — the full product requirements, architecture, security, capacity, deployment and runbook documentation (split from the original master planning document, which is retained at `docs/MASTER-PLAN-ORIGINAL.md`).

## Start here

1. [`docs/STATUS.md`](docs/STATUS.md) — current phase, evidence, and open blockers. Always read this first.
2. [`docs/PRD.md`](docs/PRD.md) — product requirements and acceptance criteria.
3. [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md) — phased delivery plan and gates.
4. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system topology and reliability model.
5. [`docs/MACBOOK-TO-VPS.md`](docs/MACBOOK-TO-VPS.md) — local development and the Mac-to-VPS deployment workflow.
6. [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) — rules for any AI agent (or human) resuming work on this repository.

## Ground rules (see `docs/DECISIONS.md` §0 for the full list)

- New, dedicated Supabase stack, Redis, credentials, buckets and networks for this project only — never borrowed from Hasheem Gaming or any other product on the shared VPS.
- No claim of a working feature, deployment, migration or email delivery without recorded, verifiable evidence (`docs/evidence/`).
- No secrets in git, chat, logs, screenshots or frontend bundles.
- No destructive production operations without explicit, separate owner approval.

## License / ownership

Proprietary. © Bisso Technologies Ltd. Not for redistribution.
