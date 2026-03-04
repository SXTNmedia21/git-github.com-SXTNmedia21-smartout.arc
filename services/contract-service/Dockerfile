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

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/contract-service/package.json ./services/contract-service/
RUN pnpm install --frozen-lockfile --filter @smartout/contract-service... --ignore-scripts

WORKDIR /app/services/contract-service
COPY services/contract-service/tsconfig.json ./
COPY services/contract-service/src ./src
RUN pnpm build

# ── Stage 2: Production ────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/contract-service/package.json ./services/contract-service/
RUN pnpm install --frozen-lockfile --filter @smartout/contract-service... --ignore-scripts --prod

WORKDIR /app/services/contract-service
COPY --from=builder /app/services/contract-service/dist ./dist

EXPOSE 5012
ENV NODE_ENV=production
USER node
CMD ["node", "dist/server.js"]
