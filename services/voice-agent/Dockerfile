# ============================================
# Dockerfile — Voice Agent (LiveKit Agents worker)
# Standalone Node.js worker — no HTTP server, connects outbound to LiveKit cloud.
# Build context = monorepo root (set in docker-compose.yml).
#
# Workspace deps (as of Phase E, ADR-0282):
#   @smartout/ai        — mission registry (room name → mission resolution)
#   @smartout/telemetry — runtime VAD telemetry hooks (ADR-0282 R6 amendment)
# Transitive (via @smartout/ai):
#   @smartout/journey-ir, @smartout/supabase, @smartout/types, @smartout/utils
#
# Build pattern mirrors services/stage-engine/Dockerfile (canonical monorepo
# service pattern). Any new @smartout/* dep MUST update both this Dockerfile
# AND .github/workflows/ci.yml docker-build matrix.
#
# Connected to: infra/docker-compose.yml (orchestration)
# Connected to: ADR-0135 (Mobile + voice-agent on LiveKit)
# Connected to: ADR-0282 (voice plane consolidation, mission-aware dispatch)
# ============================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app
RUN corepack enable

# Copy workspace structure + all workspace package.json files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/voice-agent/package.json ./services/voice-agent/
COPY packages/ai/package.json ./packages/ai/
COPY packages/journey-ir/package.json ./packages/journey-ir/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/payroll-export/package.json ./packages/payroll-export/
RUN pnpm install --frozen-lockfile --filter @smartout/voice-agent... --ignore-scripts

# Copy monorepo scripts (needed by @smartout/types build + ESM-import fixer)
COPY scripts/ ./scripts/

# Copy workspace package sources (needed for tsc)
COPY packages/typescript-config/ ./packages/typescript-config/
COPY packages/types/ ./packages/types/
COPY packages/utils/ ./packages/utils/
COPY packages/telemetry/ ./packages/telemetry/
COPY packages/journey-ir/ ./packages/journey-ir/
COPY packages/supabase/ ./packages/supabase/
COPY packages/payroll-export/ ./packages/payroll-export/
COPY packages/ai/ ./packages/ai/
COPY services/voice-agent/tsconfig.json ./services/voice-agent/
COPY services/voice-agent/src ./services/voice-agent/src

# Build workspace deps in dependency order, then voice-agent.
# @smartout/journey-ir must build before @smartout/ai (ADR-0171/0178).
# @smartout/payroll-export is a transitive dep of @smartout/ai (payroll capability
# CSV generator); must be built before @smartout/ai or tsc fails TS2307.
RUN pnpm --filter @smartout/types build && \
    pnpm --filter @smartout/utils build && \
    pnpm --filter @smartout/telemetry build && \
    pnpm --filter @smartout/journey-ir build && \
    pnpm --filter @smartout/payroll-export build && \
    pnpm --filter @smartout/ai build && \
    pnpm --filter @smartout/voice-agent build

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
COPY packages/ai/package.json ./packages/ai/
COPY packages/journey-ir/package.json ./packages/journey-ir/
COPY packages/supabase/package.json ./packages/supabase/
COPY packages/types/package.json ./packages/types/
COPY packages/utils/package.json ./packages/utils/
COPY packages/telemetry/package.json ./packages/telemetry/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/payroll-export/package.json ./packages/payroll-export/
# NOTE: scripts allowed for prod install — @livekit/rtc-node fetches native
# binding (rtc-node.linux-x64-musl.node) via postinstall. --ignore-scripts here
# leaves the binary missing and the worker crashes at boot with MODULE_NOT_FOUND.
RUN pnpm install --frozen-lockfile --filter @smartout/voice-agent... --prod

# Copy built output from all workspace deps
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/journey-ir/dist ./packages/journey-ir/dist
COPY --from=builder /app/packages/ai/dist ./packages/ai/dist
COPY --from=builder /app/packages/supabase/src ./packages/supabase/src
COPY --from=builder /app/packages/utils/dist ./packages/utils/dist
COPY --from=builder /app/packages/telemetry/dist ./packages/telemetry/dist
COPY --from=builder /app/packages/payroll-export/dist ./packages/payroll-export/dist
COPY --from=builder /app/services/voice-agent/dist ./services/voice-agent/dist
# Repoint package main fields to dist for Node ESM runtime resolution.
RUN sed -i 's|"main": "src/index.ts"|"main": "dist/index.js"|' packages/utils/package.json
RUN node -e "const fs=require('fs'); const p='packages/telemetry/package.json'; const j=JSON.parse(fs.readFileSync(p,'utf8')); j.main='dist/index.js'; j.types='dist/index.d.ts'; if(j.exports&&j.exports['.']){ j.exports['.'].types='./dist/index.d.ts'; j.exports['.']['react-native']='./dist/index.native.js'; j.exports['.']['react-server']='./dist/index.js'; j.exports['.'].default='./dist/index.js'; } if(j.exports){ j.exports['./server']='./dist/index.js'; j.exports['./react']='./dist/react.js'; } fs.writeFileSync(p, JSON.stringify(j, null, 2));"

WORKDIR /app/services/voice-agent
ENV NODE_ENV=production
USER node
CMD ["node", "dist/agent.js", "start"]
