# ============================================
# Dockerfile — Mission Runner
# Multi-stage build: compile TypeScript, then run minimal Node.js image.
# Build context is the monorepo root (set in docker-compose.yml).
# Uses pnpm workspace filter to install only this service's deps.
# ============================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable

# Copy workspace structure + all workspace package.json files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/walkAi/mission-runner/package.json ./packages/walkAi/mission-runner/
COPY packages/ai/package.json ./packages/ai/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/types/package.json ./packages/types/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter @smartout/mission-runner... --ignore-scripts

# Copy shared build script
COPY scripts/fix-esm-imports.mjs ./scripts/

# Copy workspace package sources (needed for tsc)
COPY packages/typescript-config/ ./packages/typescript-config/
COPY packages/types/ ./packages/types/
COPY packages/supabase/ ./packages/supabase/
COPY packages/ai/ ./packages/ai/
COPY packages/walkAi/mission-runner/tsconfig.json ./packages/walkAi/mission-runner/
COPY packages/walkAi/mission-runner/src ./packages/walkAi/mission-runner/src

# Build workspace deps in order, then mission-runner
RUN pnpm --filter @smartout/types build && \
    pnpm --filter @smartout/ai build && \
    pnpm --filter @smartout/mission-runner build

# ── Stage 2: Production ────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/walkAi/mission-runner/package.json ./packages/walkAi/mission-runner/
COPY packages/ai/package.json ./packages/ai/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/types/package.json ./packages/types/
COPY packages/typescript-config/package.json ./packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter @smartout/mission-runner... --ignore-scripts --prod

# Copy built output from all workspace deps
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/ai/dist ./packages/ai/dist
COPY --from=builder /app/packages/supabase/src ./packages/supabase/src
COPY --from=builder /app/packages/walkAi/mission-runner/dist ./packages/walkAi/mission-runner/dist

WORKDIR /app/packages/walkAi/mission-runner
EXPOSE 5010
ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]
