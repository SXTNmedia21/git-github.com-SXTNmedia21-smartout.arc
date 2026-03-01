# ============================================
# Dockerfile — Shift MCP Server
# Multi-stage build: compile TypeScript, then run with prod deps only.
# Build context is the monorepo root (accesses root pnpm-lock.yaml).
# Port 3001 — routed via Caddy at schedule-mcp.smartout.ai.
# Connected to: docker-compose.yml (in smartout-infra repo)
# ============================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml ./
COPY services/shift-mcp/package.json ./
RUN pnpm install --frozen-lockfile

COPY services/shift-mcp/tsconfig.json ./
COPY services/shift-mcp/src ./src
RUN pnpm build

# ── Stage 2: Production ────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
RUN corepack enable

COPY pnpm-lock.yaml ./
COPY services/shift-mcp/package.json ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist

EXPOSE 3001
ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]
