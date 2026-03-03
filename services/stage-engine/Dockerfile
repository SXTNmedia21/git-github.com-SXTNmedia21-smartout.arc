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

# Copy workspace structure + all workspace package.json files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/stage-engine/package.json ./services/stage-engine/
COPY packages/ai/package.json ./packages/ai/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/types/package.json ./packages/types/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter @smartout/stage-engine... --ignore-scripts

# Copy workspace package sources (needed for tsc)
COPY packages/typescript-config/ ./packages/typescript-config/
COPY packages/types/ ./packages/types/
COPY packages/supabase/ ./packages/supabase/
COPY packages/ai/ ./packages/ai/

# Build workspace deps in order, then stage-engine
RUN pnpm --filter @smartout/types build && \
    pnpm --filter @smartout/ai build && \
    pnpm --filter @smartout/stage-engine build

# ── Stage 2: Production ────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/stage-engine/package.json ./services/stage-engine/
COPY packages/ai/package.json ./packages/ai/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/types/package.json ./packages/types/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter @smartout/stage-engine... --ignore-scripts --prod

# Copy built output from all workspace deps
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/ai/dist ./packages/ai/dist
COPY --from=builder /app/packages/supabase/src ./packages/supabase/src
COPY --from=builder /app/services/stage-engine/dist ./services/stage-engine/dist

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
