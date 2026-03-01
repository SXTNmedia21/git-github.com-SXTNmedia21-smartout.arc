# ============================================
# Dockerfile — Contract Service
# Multi-stage build: compile TypeScript, then run with prod deps only.
# Build context is the monorepo root (accesses root pnpm-lock.yaml).
# Port 3100 — routed via Caddy at contract.smartout.ai.
# Connected to: infra/docker-compose.yml (orchestration)
# ============================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml ./
COPY services/contract-service/package.json ./
RUN pnpm install --frozen-lockfile

COPY services/contract-service/tsconfig.json ./
COPY services/contract-service/src ./src
RUN pnpm build

# ── Stage 2: Production ────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml ./
COPY services/contract-service/package.json ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

EXPOSE 3100
ENV NODE_ENV=production
USER node
CMD ["node", "dist/server.js"]
