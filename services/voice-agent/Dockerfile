# ============================================
# Dockerfile — Voice Agent (LiveKit Agents worker)
# Standalone Node.js worker — no HTTP server, connects outbound to LiveKit cloud.
# Build context = monorepo root (set in docker-compose.yml).
# voice-agent is part of pnpm workspace (services/*) but has no @smartout/*
# workspace deps — only @livekit/* + dotenv.
# Connected to: infra/docker-compose.yml (orchestration)
# Connected to: ADR-0135 (Mobile + voice-agent on LiveKit; web stays on Ultravox)
# ============================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
RUN corepack enable

# Workspace structure
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/voice-agent/package.json ./services/voice-agent/
RUN pnpm install --frozen-lockfile --filter @smartout/voice-agent --ignore-scripts

# Sources
COPY services/voice-agent/tsconfig.json ./services/voice-agent/
COPY services/voice-agent/src ./services/voice-agent/src
RUN pnpm --filter @smartout/voice-agent build

# ── Stage 2: Production ────────────────────────────────────
FROM node:22-slim
WORKDIR /app
# ca-certificates required: @livekit/rtc-node Rust binding reads OS CA store
# for TLS to LiveKit Cloud. Without it, Room.connect() fails with
# "engine: signal failure: failed to retrieve region info: error sending request"
# even though Node's built-in fetch() works (uses bundled CAs).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/voice-agent/package.json ./services/voice-agent/
# NOTE: scripts allowed for prod install — @livekit/rtc-node fetches native
# binding (rtc-node.linux-x64-musl.node) via postinstall. --ignore-scripts here
# leaves the binary missing and the worker crashes at boot with MODULE_NOT_FOUND.
RUN pnpm install --frozen-lockfile --filter @smartout/voice-agent --prod

COPY --from=builder /app/services/voice-agent/dist ./services/voice-agent/dist

WORKDIR /app/services/voice-agent
ENV NODE_ENV=production
USER node
CMD ["node", "dist/agent.js", "start"]
