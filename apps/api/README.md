# apps/api

Fastify + TypeScript API. Real for the Phase 4 vertical slice: JWT auth (`src/auth.ts`,
`src/jwt.ts`), server-side workspace membership checks (`src/workspace.ts`), Postgres access via
the Supavisor transaction pooler (`src/db.ts`), Supabase Storage client (`src/storage.ts`), and
routes for uploads (`src/routes/uploads.ts`) and jobs (`src/routes/jobs.ts`).

```bash
HASHEEMSTUDIO_ENV_FILE=/etc/hasheemstudio/local.env npx tsx src/index.ts
# or, with the default env file path:
npx tsx src/index.ts
```

Listens on `127.0.0.1:8787` (override with `API_PORT`). `GET /health/live` and `GET /health/ready`
are real. See `docs/STATUS.md` Phase 4 for what's been verified end-to-end and what's still a
known gap (no containerization yet, hardcoded plan limits instead of a real entitlements lookup,
duplicated storage/env code with `apps/worker`).
