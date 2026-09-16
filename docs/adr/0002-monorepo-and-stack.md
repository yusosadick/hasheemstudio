# ADR-0002: Monorepo layout and core stack

**Status:** Accepted
**Date:** 2026-09-16

## Context

`docs/MASTER-PLAN-ORIGINAL.md` §9 specifies React/TypeScript/Vite/Tailwind frontend, Fastify API,
BullMQ worker, self-hosted Supabase, dedicated Redis, Resend, Docker Compose then Kubernetes. This
is a fixed constraint from the owner, not an open choice.

## Decision

- pnpm workspaces monorepo (`apps/*`, `packages/*`), TypeScript strict mode throughout.
- Node 22 (active LTS, confirmed installed on the target VPS as of 2026-09-16) for API and worker.
- pnpm pinned at `9.15.0` via the root `package.json` `packageManager` field (installed globally on
  the VPS via `npm install -g pnpm@9.15.0` on 2026-09-16 to unblock local script execution —
  corepack was not available in the VPS's Node install).
- Frontend: Vite + React + TypeScript + Tailwind, React Router, TanStack Query, Zod.
- API: Fastify + TypeScript + OpenAPI.
- Worker: TypeScript + BullMQ, pinned FFmpeg/FFprobe via argument-array invocation only.

## Consequences

Never silently replace this with a different framework (e.g. Next.js, Django, a Supabase Cloud
project) per `docs/MASTER-PLAN-ORIGINAL.md` boundary #9. Any deviation requires a new ADR and
explicit owner sign-off.
