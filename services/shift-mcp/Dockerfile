# ============================================
# Dockerfile — Shift MCP Server
# Multi-stage build: compile TypeScript, then run with prod deps only.
# Build context is the monorepo root (accesses root pnpm-lock.yaml).
# Uses pnpm workspace filter to install only this service's deps.
# Port 5011 — routed via Caddy at schedule-mcp.smartout.ai.
# Connected to: infra/docker-compose.yml (orchestration)
# ============================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/shift-mcp/package.json ./services/shift-mcp/
RUN pnpm install --frozen-lockfile --filter @smartout/shift-mcp... --ignore-scripts

# Copy monorepo scripts (needed by build script)
COPY scripts/ ./scripts/

WORKDIR /app/services/shift-mcp
COPY services/shift-mcp/tsconfig.json ./
COPY services/shift-mcp/src ./src
RUN pnpm --filter @smartout/shift-mcp build

# ── Stage 2: Production ────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/shift-mcp/package.json ./services/shift-mcp/
RUN pnpm install --frozen-lockfile --filter @smartout/shift-mcp... --ignore-scripts --prod

WORKDIR /app/services/shift-mcp
COPY --from=builder /app/services/shift-mcp/dist ./dist

EXPOSE 5011
ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]
