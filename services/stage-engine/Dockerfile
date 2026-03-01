# ============================================
# Dockerfile — Stage Engine
# Multi-stage build: compile TypeScript, then run minimal Node.js image.
# Connected to: docker-compose.yml (orchestration)
# ============================================

# Build stage — compile TypeScript to JavaScript
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# Runtime stage — minimal image with only compiled output
FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
