# Production API image. Built from the monorepo root as build context (see
# infra/compose/docker-compose.yml "api" service: `context: ../.. , dockerfile: apps/api/Dockerfile`),
# since pnpm needs the whole workspace manifest to resolve a frozen-lockfile install correctly even
# though this image only ships apps/api's own code. Mirrors apps/worker/Dockerfile's structure.
FROM node:22-bookworm-slim

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy only manifests first for better layer caching; the full workspace manifest set is needed
# for a correct --frozen-lockfile install even when filtering to one package.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile --filter @hasheemstudio/api...

COPY apps/api apps/api

# Non-root, no login shell, no home directory writes needed.
RUN groupadd --system hasheemstudio \
  && useradd --system --gid hasheemstudio --home-dir /app --shell /usr/sbin/nologin apiuser \
  && chown -R apiuser:hasheemstudio /app

USER apiuser
WORKDIR /app/apps/api

CMD ["node", "--import", "tsx/esm", "src/index.ts"]
