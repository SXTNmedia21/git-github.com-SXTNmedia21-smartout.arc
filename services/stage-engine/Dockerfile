# ============================================
# Dockerfile — Stage Engine
# Multi-stage build: compile TypeScript, then run minimal Node.js image.
# Build context is the monorepo root (set in docker-compose.yml).
# Uses pnpm workspace filter to install only this service's deps.
# Connected to: infra/docker-compose.yml (orchestration)
# ============================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable

# Copy workspace structure so pnpm can resolve the lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/stage-engine/package.json ./services/stage-engine/
RUN pnpm install --frozen-lockfile --filter @smartout/stage-engine... --ignore-scripts

WORKDIR /app/services/stage-engine
COPY services/stage-engine/tsconfig.json ./
COPY services/stage-engine/src ./src
RUN pnpm build

# ── Stage 2: Production ────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/stage-engine/package.json ./services/stage-engine/
RUN pnpm install --frozen-lockfile --filter @smartout/stage-engine... --ignore-scripts --prod

WORKDIR /app/services/stage-engine
COPY --from=builder /app/services/stage-engine/dist ./dist

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
