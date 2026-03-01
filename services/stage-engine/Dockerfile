# ============================================
# Dockerfile — Stage Engine
# Multi-stage build: compile TypeScript, then run minimal Node.js image.
# Connected to: docker-compose.yml (orchestration)
# ============================================

# Build stage — compile TypeScript to JavaScript
# Build context is the monorepo root (set in docker-compose.yml).
# This lets us access the root pnpm-lock.yaml for deterministic installs.
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml ./
COPY services/stage-engine/package.json ./
RUN pnpm install --frozen-lockfile
COPY services/stage-engine/tsconfig.json ./
COPY services/stage-engine/src ./src
RUN pnpm build

# Runtime stage — minimal image with only compiled output
FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml ./
COPY services/stage-engine/package.json ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
