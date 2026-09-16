# Sandboxed media worker image. Built from the monorepo root as build context (see
# infra/compose/docker-compose.yml "worker" service: `context: ../.. , dockerfile:
# apps/worker/Dockerfile`), since pnpm needs the whole workspace manifest to resolve a
# frozen-lockfile install correctly even though this image only ships apps/worker's own code.
FROM node:22-bookworm-slim

# ffmpeg from Debian's own repos (includes libx264/libx265/libopus etc as of current bookworm).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy only manifests first for better layer caching; the full workspace manifest set is needed
# for a correct --frozen-lockfile install even when filtering to one package.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile --filter @hasheemstudio/worker...

COPY apps/worker apps/worker

# Non-root, no login shell, no home directory writes needed.
RUN groupadd --system hasheemstudio \
  && useradd --system --gid hasheemstudio --home-dir /app --shell /usr/sbin/nologin worker \
  && mkdir -p /scratch \
  && chown -R worker:hasheemstudio /scratch /app

USER worker
ENV WORKER_SCRATCH_DIR=/scratch
# No secrets file is mounted into this image at all — every secret it needs (POSTGRES_PASSWORD,
# REDIS_PASSWORD, SERVICE_ROLE_KEY) is injected directly as a container environment variable by
# Compose (see the "worker" service's `environment:` block), sourced from the same protected
# --env-file already used for the whole stack. apps/worker/src/env.ts's loadEnv() tolerates the
# absence of a file here and just uses what Docker already injected.
WORKDIR /app/apps/worker

CMD ["node", "--import", "tsx/esm", "src/index.ts"]
