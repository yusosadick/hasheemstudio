# Production web image: build the Vite/React SPA, then serve the static output through a
# non-root nginx. Built from the monorepo root as build context (see
# infra/compose/docker-compose.yml "web" service), since pnpm needs the whole workspace manifest.
# Vite bakes VITE_* values into the bundle at BUILD time, not runtime — they're passed as build
# args, sourced from the same protected env file as everything else (see docker-compose.yml).
# None of VITE_SUPABASE_ANON_KEY/VITE_SUPABASE_URL/VITE_API_URL are secret: the anon key is the
# public/publishable Supabase key, by design meant to ship in frontend bundles (protected by RLS).
FROM node:22-bookworm-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN pnpm install --frozen-lockfile --filter @hasheemstudio/web...

COPY apps/web apps/web
COPY packages/ui packages/ui

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_API_URL=$VITE_API_URL

WORKDIR /app/apps/web
RUN pnpm build

FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080
