# ============================================
# Dockerfile — Contract Service
# Multi-stage build: compile TypeScript, then run with prod deps only.
# Build context is the monorepo root (accesses root pnpm-lock.yaml).
# Uses pnpm workspace filter to install only this service's deps.
# Port 5012 — routed via Caddy at contract.smartout.ai.
# Connected to: infra/docker-compose.yml (orchestration)
# ============================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable

# Copy workspace structure + all workspace package.json files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/contract-service/package.json ./services/contract-service/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/utils/package.json ./packages/utils/
COPY packages/types/package.json ./packages/types/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter @smartout/contract-service... --ignore-scripts

# Copy monorepo scripts (needed by build script)
COPY scripts/ ./scripts/

# Copy workspace package sources (needed for tsc)
COPY packages/typescript-config/ ./packages/typescript-config/
COPY packages/types/ ./packages/types/
COPY packages/supabase/ ./packages/supabase/
COPY packages/utils/ ./packages/utils/

WORKDIR /app/services/contract-service
COPY services/contract-service/tsconfig.json ./
COPY services/contract-service/src ./src

# Build workspace deps in order, then contract-service
RUN pnpm --filter @smartout/types build && \
    pnpm --filter @smartout/contract-service build

# ── Stage 2: Production ────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/contract-service/package.json ./services/contract-service/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/utils/package.json ./packages/utils/
COPY packages/types/package.json ./packages/types/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter @smartout/contract-service... --ignore-scripts --prod

# Copy built output from all workspace deps
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/supabase/src ./packages/supabase/src
COPY --from=builder /app/packages/utils/src ./packages/utils/src

WORKDIR /app/services/contract-service
COPY --from=builder /app/services/contract-service/dist ./dist

EXPOSE 5012
ENV NODE_ENV=production
USER node
CMD ["node", "dist/server.js"]
