# Smartout Infra Consolidation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate all 4 backend services (stage-engine, contract-service, shift-mcp, scrapling) into a unified Docker Compose stack with correct inter-service networking, health checks, and security. Fix all URL references so local dev and production work correctly.

**Architecture:** Per ADR-0035, infrastructure orchestration lives in a dedicated `infra/` directory (to be extracted to `smartout-infra` repo later). All services share a Docker bridge network (`smartout-internal`). Caddy reverse proxy handles HTTPS termination for external services. Internal services (scrapling) are only reachable within the Docker network. Each service keeps its Dockerfile in its own `services/` directory. Three-file compose strategy: base + dev override + prod overlay.

**Tech Stack:** Docker Compose, Caddy 2, Node.js 22 Alpine, Python 3.12 Alpine, pnpm

**Reference Docs (read before starting):**

- `docs/decisions/0035-docker-network-infra.md` — Infrastructure ADR
- `docs/decisions/0036-shift-mcp-server.md` — Shift MCP service
- `docs/protocols/SECURITY.md` — Security rules
- `CLAUDE.md` — Project conventions

---

## Service Port Map (Source of Truth)

| Service          | Internal Port | Docker Name        | External Domain            | Auth                          |
| ---------------- | ------------- | ------------------ | -------------------------- | ----------------------------- |
| stage-engine     | 3000          | `stage-engine`     | `engine.smartout.ai`       | Dual-auth (API key + JWT)     |
| shift-mcp        | 3001          | `shift-mcp`        | `schedule-mcp.smartout.ai` | Dual-auth (API key + JWT)     |
| contract-service | 3100          | `contract-service` | `contract.smartout.ai`     | Service key (`x-service-key`) |
| scrapling        | 8000          | `scrapling`        | None (internal only)       | None (network-isolated)       |
| caddy            | 80/443        | `caddy`            | `*.smartout.ai`            | HTTPS termination             |

---

## Summary of Changes

| File                                                         | Action  | Why                                               |
| ------------------------------------------------------------ | ------- | ------------------------------------------------- |
| `infra/docker-compose.yml`                                   | Create  | Unified base compose with all 5 services          |
| `infra/docker-compose.override.yml`                          | Create  | Dev overrides (exposed ports, volume mounts)      |
| `infra/docker-compose.prod.yml`                              | Create  | Prod overlay (restart, resource limits, prod env) |
| `infra/Caddyfile`                                            | Create  | Routes for all 3 external services                |
| `infra/Caddyfile.dev`                                        | Create  | Local dev Caddyfile (localhost, no HTTPS)         |
| `infra/.env.example`                                         | Create  | All env vars for the stack                        |
| `infra/README.md`                                            | Create  | How to run locally and deploy                     |
| `services/scrapling/Dockerfile`                              | Create  | Python multi-stage build                          |
| `services/contract-service/Dockerfile`                       | Rewrite | Upgrade to multi-stage pnpm build (match others)  |
| `services/stage-engine/docker-compose.yml`                   | Delete  | Superseded by unified compose                     |
| `services/stage-engine/Caddyfile`                            | Delete  | Superseded by unified Caddyfile                   |
| `supabase/functions/scrape-raw-data/index.ts`                | Fix     | Correct scrapling fallback URL                    |
| `supabase/functions/extract-workspace-data/index.ts`         | Fix     | Correct scrapling fallback URL                    |
| `supabase/functions/gather-workspace-intelligence/index.ts`  | Fix     | Correct scrapling fallback URL + path bug         |
| `apps/web/src/app/api/platform-admin/health/status/route.ts` | Update  | Add shift-mcp health check                        |
| `docs/reference/ENV_VARS.md`                                 | Update  | Document infra env vars                           |

---

### Task 1: Create Scrapling Dockerfile

**Files:**

- Create: `services/scrapling/Dockerfile`

**Step 1: Create multi-stage Python Dockerfile**

```dockerfile
# ============================================
# Dockerfile — Scrapling Service
# Multi-stage build: install dependencies, then run minimal Python image.
# Port 8000 — internal only, no external Caddy route.
# Connected to: infra/docker-compose.yml (orchestration)
# ============================================

# ── Stage 1: Dependencies ───────────────────────────────────
FROM python:3.12-slim AS builder
WORKDIR /app

# Install system dependencies for lxml and scrapling
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libxml2-dev \
    libxslt1-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir --target=/app/deps -r requirements.txt

# ── Stage 2: Production ────────────────────────────────────
FROM python:3.12-slim
WORKDIR /app

# Runtime dependencies for lxml
RUN apt-get update && apt-get install -y --no-install-recommends \
    libxml2 \
    libxslt1.1 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/deps /app/deps
ENV PYTHONPATH=/app/deps
COPY main.py ./

EXPOSE 8000
USER nobody
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Step 2: Verify Dockerfile builds locally**

Run: `cd services/scrapling && docker build -t smartout-scrapling .`
Expected: Image builds successfully

**Step 3: Commit**

```bash
git add services/scrapling/Dockerfile
git commit -m "feat(scrapling): add multi-stage Python Dockerfile"
```

---

### Task 2: Upgrade Contract Service Dockerfile

The existing Dockerfile uses `npm` and a single-stage build. Upgrade to match the multi-stage pnpm pattern used by stage-engine and shift-mcp.

**Files:**

- Modify: `services/contract-service/Dockerfile`

**Step 1: Rewrite to multi-stage pnpm build**

Replace the full content of `services/contract-service/Dockerfile` with:

```dockerfile
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
```

**Step 2: Verify it builds**

Run: `cd /c/Users/sxtnl/Dev/smartout_v3 && docker build -f services/contract-service/Dockerfile -t smartout-contract-service .`
Expected: Image builds successfully (build context = monorepo root)

**Step 3: Commit**

```bash
git add services/contract-service/Dockerfile
git commit -m "fix(contract-service): upgrade to multi-stage pnpm Dockerfile"
```

---

### Task 3: Create Unified Docker Compose — Base

**Files:**

- Create: `infra/docker-compose.yml`

**Step 1: Create the base compose file**

```yaml
# ============================================
# docker-compose.yml — Smartout Infrastructure (base)
# Defines all services on a shared Docker network.
# Caddy handles HTTPS for external-facing services.
# Override with docker-compose.override.yml (dev) or
# docker-compose.prod.yml (production).
#
# Build context for Node services: monorepo root (../)
# Build context for Python services: service directory
#
# Connected to: ADR-0035 (Docker Network Infrastructure)
# ============================================

networks:
  smartout-internal:
    driver: bridge

services:
  # ── Reverse Proxy ─────────────────────────────────────────
  caddy:
    image: caddy:2-alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - smartout-internal
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80"]
      interval: 30s
      timeout: 5s
      retries: 3

  # ── Stage Engine (AI agent orchestration) ─────────────────
  stage-engine:
    build:
      context: ../
      dockerfile: services/stage-engine/Dockerfile
    environment:
      - PORT=3000
      - ENGINE_URL=${ENGINE_URL}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - ULTRAVOX_API_KEY=${ULTRAVOX_API_KEY}
      - LOG_LEVEL=${LOG_LEVEL:-info}
      - SESSION_EXPIRY_HOURS=${SESSION_EXPIRY_HOURS:-24}
      - CLEANUP_INTERVAL_MINUTES=${CLEANUP_INTERVAL_MINUTES:-5}
    networks:
      - smartout-internal
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    depends_on:
      - caddy

  # ── Shift MCP (schedule management tools for AI) ──────────
  shift-mcp:
    build:
      context: ../
      dockerfile: services/shift-mcp/Dockerfile
    environment:
      - PORT=3001
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    networks:
      - smartout-internal
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3001/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    depends_on:
      - caddy

  # ── Contract Service (DocuSeal e-signatures) ──────────────
  contract-service:
    build:
      context: ../
      dockerfile: services/contract-service/Dockerfile
    environment:
      - PORT=3100
      - SERVICE_KEY=${CONTRACT_SERVICE_KEY}
      - NODE_ENV=production
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - DOCUSEAL_API_KEY=${DOCUSEAL_API_KEY}
      - DOCUSEAL_API_URL=${DOCUSEAL_API_URL:-https://api.docuseal.com}
      - DOCUSEAL_WEBHOOK_SECRET=${DOCUSEAL_WEBHOOK_SECRET}
      - SMARTOUT_COMPANY_NAME=${SMARTOUT_COMPANY_NAME:-Smartout AS}
      - SMARTOUT_ORG_NUMBER=${SMARTOUT_ORG_NUMBER:-}
      - SMARTOUT_CONTACT_EMAIL=${SMARTOUT_CONTACT_EMAIL:-pontus@smartout.io}
      - APP_URL=${APP_URL:-https://app.smartout.ai}
    networks:
      - smartout-internal
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3100/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    depends_on:
      - caddy

  # ── Scrapling (web scraping — internal only) ──────────────
  scrapling:
    build:
      context: ../services/scrapling
      dockerfile: Dockerfile
    environment:
      - PORT=8000
    networks:
      - smartout-internal
    healthcheck:
      test:
        [
          "CMD",
          "python",
          "-c",
          "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')",
        ]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  caddy_data:
  caddy_config:
```

**Step 2: Commit**

```bash
git add infra/docker-compose.yml
git commit -m "feat(infra): add unified docker-compose with all 4 services + Caddy"
```

---

### Task 4: Create Caddyfile (Production + Dev)

**Files:**

- Create: `infra/Caddyfile`
- Create: `infra/Caddyfile.dev`

**Step 1: Create production Caddyfile**

```
# ============================================
# Caddyfile — Smartout reverse proxy (production)
# Auto-provisions HTTPS via Let's Encrypt.
# Internal services (scrapling) have no route — network-isolated.
# Connected to: infra/docker-compose.yml (caddy service)
# Connected to: ADR-0035 (infrastructure decisions)
# ============================================

# Stage Engine — AI agent orchestration gateway
engine.smartout.ai {
  reverse_proxy stage-engine:3000
}

# Shift MCP — Schedule management tools for AI agents
schedule-mcp.smartout.ai {
  reverse_proxy shift-mcp:3001
}

# Contract Service — DocuSeal e-signature management
contract.smartout.ai {
  reverse_proxy contract-service:3100
}
```

**Step 2: Create dev Caddyfile (localhost, no HTTPS)**

```
# ============================================
# Caddyfile.dev — Smartout reverse proxy (local development)
# No HTTPS — uses localhost with port-based routing.
# Use: docker compose -f docker-compose.yml -f docker-compose.override.yml up
# ============================================

:3070 {
  reverse_proxy stage-engine:3000
}

:3071 {
  reverse_proxy shift-mcp:3001
}

:3072 {
  reverse_proxy contract-service:3100
}

:3073 {
  reverse_proxy scrapling:8000
}
```

**Step 3: Commit**

```bash
git add infra/Caddyfile infra/Caddyfile.dev
git commit -m "feat(infra): add production and dev Caddyfiles for all services"
```

---

### Task 5: Create Docker Compose Overrides (Dev + Prod)

**Files:**

- Create: `infra/docker-compose.override.yml`
- Create: `infra/docker-compose.prod.yml`

**Step 1: Create dev override**

```yaml
# ============================================
# docker-compose.override.yml — Development overrides
# Exposes service ports directly for local debugging.
# Mounts Caddyfile.dev instead of production Caddyfile.
# Auto-applied by `docker compose up` (no -f flag needed).
# ============================================

services:
  caddy:
    volumes:
      - ./Caddyfile.dev:/etc/caddy/Caddyfile
    ports:
      - "3070:3070"
      - "3071:3071"
      - "3072:3072"
      - "3073:3073"
      - "80:80"

  stage-engine:
    environment:
      - ENGINE_URL=http://localhost:3070
      - LOG_LEVEL=debug

  shift-mcp:
    environment:
      - LOG_LEVEL=debug

  contract-service:
    environment:
      - NODE_ENV=development
      - APP_URL=http://localhost:3050

  scrapling:
    ports:
      - "8000:8000"
```

**Step 2: Create production overlay**

```yaml
# ============================================
# docker-compose.prod.yml — Production overlay
# Adds restart policies, resource limits, and production env.
# Usage: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
# ============================================

services:
  caddy:
    restart: always

  stage-engine:
    restart: always
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "0.5"

  shift-mcp:
    restart: always
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.25"

  contract-service:
    restart: always
    deploy:
      resources:
        limits:
          memory: 256M
          cpus: "0.25"

  scrapling:
    restart: always
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: "0.5"
```

**Step 3: Commit**

```bash
git add infra/docker-compose.override.yml infra/docker-compose.prod.yml
git commit -m "feat(infra): add dev override and prod overlay compose files"
```

---

### Task 6: Create .env.example for Infra

**Files:**

- Create: `infra/.env.example`

**Step 1: Create the env example with all required variables**

```bash
# ============================================
# Smartout Infrastructure — Environment Variables
# Copy to .env and fill in real values.
# NEVER commit .env with real secrets.
# Use 1Password: op run --env-file=.env.template
# ============================================

# ── Shared (all services) ────────────────────────────────
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-REPLACE_ME
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-REPLACE_ME

# ── Stage Engine ─────────────────────────────────────────
ENGINE_URL=https://engine.smartout.ai
ULTRAVOX_API_KEY=your-ultravox-key-REPLACE_ME
LOG_LEVEL=info
SESSION_EXPIRY_HOURS=24
CLEANUP_INTERVAL_MINUTES=5

# ── Contract Service ─────────────────────────────────────
CONTRACT_SERVICE_KEY=your-service-key-min-16-chars-REPLACE_ME
DOCUSEAL_API_KEY=your-docuseal-key-REPLACE_ME
DOCUSEAL_API_URL=https://api.docuseal.com
DOCUSEAL_WEBHOOK_SECRET=your-webhook-secret-REPLACE_ME
SMARTOUT_COMPANY_NAME=Smartout AS
SMARTOUT_ORG_NUMBER=
SMARTOUT_CONTACT_EMAIL=pontus@smartout.io
APP_URL=https://app.smartout.ai

# ── Scrapling ────────────────────────────────────────────
# No secrets — runs on internal network only
```

**Step 2: Add .gitignore for infra secrets**

Create `infra/.gitignore`:

```
.env
*.pem
*.key
```

**Step 3: Commit**

```bash
git add infra/.env.example infra/.gitignore
git commit -m "feat(infra): add .env.example and .gitignore for secrets"
```

---

### Task 7: Fix Edge Function Scrapling URLs

The 3 Edge Functions that call scrapling use `host.docker.internal:8000` as fallback. This works when Supabase runs locally in Docker and scrapling runs on the host. But the fallback URL for `gather-workspace-intelligence` appends `/extract` to the base URL, which is inconsistent — when `SCRAPLING_SERVICE_URL` is set with a base URL, the other two append `/scrape-raw` but this one bakes `/extract` into the fallback. Standardize all three: use base URL from env, append path in fetch call.

**Files:**

- Modify: `supabase/functions/scrape-raw-data/index.ts`
- Modify: `supabase/functions/extract-workspace-data/index.ts`
- Modify: `supabase/functions/gather-workspace-intelligence/index.ts`

**Step 1: Fix scrape-raw-data/index.ts**

In `supabase/functions/scrape-raw-data/index.ts`, find lines 47-48:

```typescript
const scraplingUrl = Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";
```

Replace with:

```typescript
// Base URL for scrapling service — no trailing slash, no path
// Docker: http://scrapling:8000 | Local: http://host.docker.internal:8000
const scraplingBase = Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";
```

Then find the fetch call that uses `scraplingUrl` and update it to use `scraplingBase`:

Find:

```typescript
    const extractionResponse = await fetch(`${scraplingUrl}/scrape-raw`, {
```

Replace with:

```typescript
    const extractionResponse = await fetch(`${scraplingBase}/scrape-raw`, {
```

Also update any log lines that reference `scraplingUrl` to `scraplingBase`.

**Step 2: Fix extract-workspace-data/index.ts**

In `supabase/functions/extract-workspace-data/index.ts`, find lines 49-50:

```typescript
const scraplingUrl =
  Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000/extract";
```

The fallback has `/extract` baked in — remove it so the pattern is consistent:

Replace with:

```typescript
// Base URL for scrapling service — no trailing slash, no path
const scraplingBase = Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";
```

Then find the fetch call and update:

Find:

```typescript
    const extractionResponse = await fetch(scraplingUrl, {
```

Replace with:

```typescript
    const extractionResponse = await fetch(`${scraplingBase}/extract`, {
```

Also update any log lines that reference `scraplingUrl` to `scraplingBase`.

**Step 3: Fix gather-workspace-intelligence/index.ts**

In `supabase/functions/gather-workspace-intelligence/index.ts`, find lines 43-44:

```typescript
const scraplingUrl =
  Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000/extract";
```

Same issue — `/extract` baked into fallback:

Replace with:

```typescript
// Base URL for scrapling service — no trailing slash, no path
const scraplingBase = Deno.env.get("SCRAPLING_SERVICE_URL") || "http://host.docker.internal:8000";
```

Then find the fetch call and update:

Find:

```typescript
          const res = await fetch(scraplingUrl, {
```

Replace with:

```typescript
          const res = await fetch(`${scraplingBase}/extract`, {
```

**Step 4: Verify Edge Functions still work**

Run: `npx supabase functions serve --env-file supabase/.env.local` (if local Supabase is running)
Expected: Functions serve without syntax errors

**Step 5: Commit**

```bash
git add supabase/functions/scrape-raw-data/index.ts supabase/functions/extract-workspace-data/index.ts supabase/functions/gather-workspace-intelligence/index.ts
git commit -m "fix(edge-functions): standardize scrapling URL pattern — base URL + path

All 3 functions now use SCRAPLING_SERVICE_URL as base URL (no path),
then append /scrape-raw or /extract in the fetch call. Consistent
pattern regardless of env var or fallback."
```

---

### Task 8: Add Shift-MCP to Platform Health Check

The platform admin health dashboard (`apps/web/src/app/api/platform-admin/health/status/route.ts`) checks stage-engine, contract-service, and scrapling — but not shift-mcp. Add it.

**Files:**

- Modify: `apps/web/src/app/api/platform-admin/health/status/route.ts`

**Step 1: Read the current health check file**

Read the full file to understand the pattern used for other service checks.

**Step 2: Add SHIFT_MCP_URL to env.ts**

In `apps/web/src/env.ts`, add to the `server` section (after `SCRAPLING_SERVICE_URL`):

```typescript
    SHIFT_MCP_URL: z.string().url().optional(),
```

**Step 3: Add shift-mcp health check to the status route**

Follow the exact same pattern as the existing contract-service and scrapling checks. Add a `checkShiftMcp()` function and include it in the `Promise.all()` array.

The health endpoint for shift-mcp is `GET /health` which returns `{ status: "ok", service: "shift-mcp", version: "0.1.0", timestamp: "..." }`.

**Step 4: Commit**

```bash
git add apps/web/src/env.ts apps/web/src/app/api/platform-admin/health/status/route.ts
git commit -m "feat(health): add shift-mcp service to platform health dashboard"
```

---

### Task 9: Remove Old Stage-Engine Docker Files

The old stage-engine-specific compose and Caddyfile are superseded by the unified infra.

**Files:**

- Delete: `services/stage-engine/docker-compose.yml`
- Delete: `services/stage-engine/Caddyfile`

**Step 1: Remove the files**

Run:

```bash
git rm services/stage-engine/docker-compose.yml services/stage-engine/Caddyfile
```

**Step 2: Update stage-engine Dockerfile comment**

In `services/stage-engine/Dockerfile`, update the header comment:

Find:

```
# Connected to: docker-compose.yml (orchestration)
```

Replace with:

```
# Connected to: infra/docker-compose.yml (orchestration)
```

**Step 3: Commit**

```bash
git add services/stage-engine/Dockerfile
git commit -m "refactor(infra): remove old stage-engine compose — superseded by infra/"
```

---

### Task 10: Create Infra README

**Files:**

- Create: `infra/README.md`

**Step 1: Write the README**

````markdown
# Smartout Infrastructure

Unified Docker Compose stack for all Smartout backend services.

## Services

| Service          | Port   | Domain                   | Description            |
| ---------------- | ------ | ------------------------ | ---------------------- |
| caddy            | 80/443 | \*.smartout.ai           | HTTPS reverse proxy    |
| stage-engine     | 3000   | engine.smartout.ai       | AI agent orchestration |
| shift-mcp        | 3001   | schedule-mcp.smartout.ai | Shift management MCP   |
| contract-service | 3100   | contract.smartout.ai     | DocuSeal e-signatures  |
| scrapling        | 8000   | (internal)               | Web scraping           |

## Local Development

```bash
# 1. Copy env and fill in values
cp .env.example .env

# 2. Start all services (auto-applies override for dev)
cd infra
docker compose up --build

# 3. Services available at:
#    Stage Engine:      http://localhost:3070
#    Shift MCP:         http://localhost:3071
#    Contract Service:  http://localhost:3072
#    Scrapling:         http://localhost:3073 (also direct at :8000)
```
````

## Production

```bash
# Use production overlay (no dev overrides)
cd infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Adding a New Service

1. Create `Dockerfile` in `services/<name>/`
2. Add service block to `infra/docker-compose.yml`
3. Add Caddy route in `infra/Caddyfile` (if externally facing)
4. Add env vars to `infra/.env.example`
5. Create DNS A record for subdomain

See ADR-0035 for full details.

````

**Step 2: Commit**

```bash
git add infra/README.md
git commit -m "docs(infra): add README with local dev and production instructions"
````

---

### Task 11: Full Verification

**Step 1: Verify all Dockerfiles build**

Run each build in sequence:

```bash
cd /c/Users/sxtnl/Dev/smartout_v3

# Stage Engine
docker build -f services/stage-engine/Dockerfile -t smartout-stage-engine .

# Shift MCP
docker build -f services/shift-mcp/Dockerfile -t smartout-shift-mcp .

# Contract Service
docker build -f services/contract-service/Dockerfile -t smartout-contract-service .

# Scrapling
docker build -f services/scrapling/Dockerfile -t smartout-scrapling services/scrapling/
```

Expected: All 4 images build successfully.

**Step 2: Verify compose syntax**

Run:

```bash
cd infra && docker compose config
```

Expected: Valid merged config output, no errors.

**Step 3: Verify no hardcoded service URLs remain**

Run grep for hardcoded localhost URLs in source code (not configs/dockerfiles):

```bash
grep -r "localhost:3000\b" --include="*.ts" --include="*.tsx" apps/ packages/ supabase/functions/ | grep -v node_modules | grep -v ".next" | grep -v "dist/"
grep -r "localhost:3001\b" --include="*.ts" --include="*.tsx" apps/ packages/ supabase/functions/ | grep -v node_modules
grep -r "localhost:3100\b" --include="*.ts" --include="*.tsx" apps/ packages/ supabase/functions/ | grep -v node_modules
grep -r "localhost:8000\b" --include="*.ts" --include="*.tsx" apps/ packages/ supabase/functions/ | grep -v node_modules
```

Expected: Zero matches in app/packages source. Fallbacks in Edge Functions and test files are acceptable.

**Step 4: Verify scrapling URL consistency**

Run:

```bash
grep -r "SCRAPLING_SERVICE_URL" --include="*.ts" supabase/functions/
```

Expected: All 3 Edge Functions use the base URL pattern (no path appended to env var).

**Step 5: TypeScript check**

Run:

```bash
pnpm --filter web exec -- npx tsc --noEmit
```

Expected: Clean compilation (env.ts changes valid).

**Step 6: Commit any fixes discovered during verification**

---

### Task 12: Write ADR for Infrastructure Consolidation

**Files:**

- Create: `docs/decisions/0037-infra-consolidation.md`
- Modify: `docs/decisions/0000-decision-log.md`

**Step 1: Write the ADR**

Use the template at `docs/templates/decision.md`. Key points:

- Title: "ADR-0037: Infrastructure Consolidation"
- Context: 4 services previously ran independently with separate Docker configs. Stage-engine had its own compose; others had no Docker setup at all.
- Decision: Unified `infra/` directory with three-file compose strategy, all services on shared `smartout-internal` network, Caddy for external routing, scrapling internal-only.
- Consequences: Good — single `docker compose up` starts everything. Bad — all services must have working Dockerfiles.

**Step 2: Register in decision log**

Add entry to `docs/decisions/0000-decision-log.md`.

**Step 3: Commit**

```bash
git add docs/decisions/0037-infra-consolidation.md docs/decisions/0000-decision-log.md
git commit -m "docs(adr-0037): infrastructure consolidation — unified compose stack"
```

---

## Verification Checklist

After all tasks:

- [ ] `services/scrapling/Dockerfile` exists and builds
- [ ] `services/contract-service/Dockerfile` is multi-stage pnpm (not npm)
- [ ] `infra/docker-compose.yml` defines all 5 services (caddy + 4 backends)
- [ ] `infra/docker-compose.override.yml` exposes dev ports (3070-3073)
- [ ] `infra/docker-compose.prod.yml` adds restart + resource limits
- [ ] `infra/Caddyfile` routes 3 external domains
- [ ] `infra/Caddyfile.dev` routes 4 localhost ports
- [ ] `infra/.env.example` documents all required env vars
- [ ] Old `services/stage-engine/docker-compose.yml` deleted
- [ ] Old `services/stage-engine/Caddyfile` deleted
- [ ] All 3 Edge Functions use consistent `SCRAPLING_SERVICE_URL` + path pattern
- [ ] `apps/web/src/env.ts` includes `SHIFT_MCP_URL`
- [ ] Platform health check includes shift-mcp
- [ ] `docker compose config` validates in `infra/`
- [ ] All 4 Dockerfiles build successfully
- [ ] Zero hardcoded localhost URLs in app source code
- [ ] ADR-0037 written and registered
- [ ] `APP_URL` defaults to `https://app.smartout.ai` (not localhost) in compose

## Security Notes

| Rule                        | How Enforced                                                       |
| --------------------------- | ------------------------------------------------------------------ |
| No secrets in compose files | All secrets via `${ENV_VAR}` references → `.env` (gitignored)      |
| No plaintext keys           | Service keys are SHA-256 hashed in `platform_api_key`              |
| Scrapling network isolation | No Caddy route, no external port in prod compose                   |
| HTTPS on external services  | Caddy auto-provisions Let's Encrypt certificates                   |
| Non-root containers         | All services run as `node` or `nobody` user                        |
| Service auth                | stage-engine + shift-mcp: dual-auth; contract-service: service key |
