---
title: "Docker Network Infra"
status: done
updated: 2026-04-10
created: 2026-03-01
module: meta
tags: []
---

# Smartout Docker Network Infrastructure Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up a unified Docker network for all Smartout microservices — Caddy reverse proxy, Stage Engine, n8n — with local dev and production deployment on DigitalOcean.

**Architecture:** One Docker bridge network (`smartout-internal`). Caddy is the only internet-facing service (ports 80/443, auto HTTPS). All other services use `expose` only — reachable by service name internally. Three compose files: base, dev override, production overlay. Separate `smartout-infra` repo orchestrates everything.

**Tech Stack:** Docker Compose, Caddy 2, Node.js 22, n8n, DigitalOcean (Ubuntu 24.04)

**Reference Docs (read before starting):**

- `services/stage-engine/PRD.md` — Stage Engine product spec
- `services/stage-engine/ARCHITECTURE.md` — Schema SQL, API spec
- `services/stage-engine/DECISIONS.md` — 15 locked decisions
- `CLAUDE.md` — Project conventions and security rules
- `docs/protocols/SECURITY.md` — Security protocol (secrets handling)

**Existing State:**

- `services/stage-engine/` — Already built. Has its own Dockerfile, docker-compose.yml, Caddyfile. Hono on port 3000 with `/health` endpoint.
- `services/stage-engine/Dockerfile` — Currently expects monorepo root as build context (copies `pnpm-lock.yaml` from root). **Must be updated to standalone.**
- `services/contract-service/Dockerfile` — Already standalone (copies only `package.json` + `dist/`).
- n8n — Running standalone somewhere. Needs to be brought into the network.

---

## Network Architecture

```
INTERNET
    |
    v
+------------------------------------------------------------------+
|  DigitalOcean Droplet (Ubuntu 24.04)                              |
|                                                                    |
|  Caddy (port 443/80) - auto HTTPS via Let's Encrypt               |
|    engine.smartout.ai        -> stage-engine:3000                  |
|    schedule-mcp.smartout.ai  -> shift-mcp:3001                     |
|    n8n.smartout.ai           -> n8n:5678                           |
|                                                                    |
|  Docker Network: smartout-internal                                 |
|    +----------------+  +------------+  +-----------+               |
|    | stage-engine   |  | shift-mcp  |  |    n8n    |               |
|    | :3000          |  | :3001      |  |   :5678   |               |
|    +----------------+  +------------+  +-----------+                               |
|                                                                    |
|  Internal: http://service-name:port (no internet roundtrip)        |
+------------------------------------------------------------------+
```

---

## Service Registry

| Service       | Port   | Subdomain                | Status           |
| ------------- | ------ | ------------------------ | ---------------- |
| Caddy         | 443/80 | (reverse proxy)          | To deploy        |
| Stage Engine  | 3000   | engine.smartout.ai       | Building now     |
| n8n           | 5678   | n8n.smartout.ai          | Migrate in       |
| Shift MCP     | 3001   | schedule-mcp.smartout.ai | Built (ADR-0036) |
| Interview MCP | 3004   | mcp.smartout.ai          | Future           |
| Salary MCP    | 3002   | mcp.smartout.ai          | Future           |
| Webhook Relay | 3003   | hooks.smartout.ai        | Future           |
| Director      | 3010   | (internal only)          | Future           |

---

## Build Order

| Phase                      | Tasks | Depends On |
| -------------------------- | ----- | ---------- |
| 1. Repo scaffold           | 1-3   | None       |
| 2. Stage Engine Dockerfile | 4-6   | Phase 1    |
| 3. Docker Compose (base)   | 7-9   | Phase 2    |
| 4. Dev & Prod overlays     | 10-12 | Phase 3    |
| 5. Caddy configs           | 13-15 | Phase 3    |
| 6. Scripts                 | 16-19 | Phase 5    |
| 7. Local verification      | 20-22 | Phase 6    |
| 8. Production prep         | 23-25 | Phase 7    |
| 9. Documentation           | 26-27 | Phase 8    |

---

## Phase 1: Repo Scaffold

### Task 1: Create the smartout-infra repo

**Files:**

- Create: `smartout-infra/` (new repo, sibling to smartout_v3)

**Step 1: Create the repo directory**

```bash
cd ~/Dev
mkdir smartout-infra
cd smartout-infra
git init
```

**Step 2: Verify the directory exists**

Run: `ls -la ~/Dev/smartout-infra/.git`
Expected: `.git` directory exists

**Step 3: Commit**

```bash
cd ~/Dev/smartout-infra
git commit --allow-empty -m "chore: initialize smartout-infra repo"
```

---

### Task 2: Create directory structure and .gitignore

**Files:**

- Create: `smartout-infra/.gitignore`
- Create: `smartout-infra/services/` (directory)
- Create: `smartout-infra/scripts/` (directory)

**Step 1: Create directories**

```bash
cd ~/Dev/smartout-infra
mkdir -p services scripts
```

**Step 2: Create .gitignore**

```gitignore
# Environment files — secrets never in git
.env
.env.prod
.env.local
*.secrets

# Docker volumes (if bind-mounted locally)
volumes/

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
```

**Step 3: Verify structure**

Run: `find ~/Dev/smartout-infra -not -path '*/.git/*' -not -path '*/.git' | sort`
Expected:

```
smartout-infra/
smartout-infra/.gitignore
smartout-infra/scripts/
smartout-infra/services/
```

**Step 4: Commit**

```bash
git add .gitignore scripts/.gitkeep services/.gitkeep
git commit -m "chore: add directory structure and .gitignore"
```

---

### Task 3: Create .env.example

**Files:**

- Create: `smartout-infra/.env.example`

**Step 1: Write the environment template**

```bash
# ============================================
# Smartout Infrastructure — Environment Variables
# Copy to .env and fill in values
# NEVER commit .env to git
# ============================================

# --- Supabase (shared by all services) ---
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=REPLACE_ME
SUPABASE_SERVICE_ROLE_KEY=REPLACE_ME

# --- Stage Engine ---
ENGINE_URL=https://engine.smartout.ai
ULTRAVOX_API_KEY=REPLACE_ME
SESSION_EXPIRY_HOURS=24
CLEANUP_INTERVAL_MINUTES=5
LOG_LEVEL=info

# --- n8n ---
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=REPLACE_ME
N8N_ENCRYPTION_KEY=REPLACE_ME
GENERIC_TIMEZONE=Europe/Oslo
```

**Step 2: Verify**

Run: `cat ~/Dev/smartout-infra/.env.example`
Expected: File contains all variables with `REPLACE_ME` placeholders, no real secrets

**Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add environment variable template"
```

---

## Phase 2: Stage Engine Dockerfile

### Task 4: Copy stage-engine source into infra repo

**Files:**

- Create: `smartout-infra/services/stage-engine/` (copy from monorepo)

**Step 1: Copy the stage-engine service**

```bash
cd ~/Dev/smartout-infra
cp -r ~/Dev/smartout_v3/services/stage-engine services/stage-engine
```

**Step 2: Remove monorepo-specific files**

The old `docker-compose.yml` and `Caddyfile` inside stage-engine are superseded by the infra-level ones.

```bash
rm services/stage-engine/docker-compose.yml
rm services/stage-engine/Caddyfile
rm -rf services/stage-engine/node_modules
rm -rf services/stage-engine/.turbo
```

**Step 3: Verify the source code is present**

Run: `ls services/stage-engine/src/`
Expected: `config.ts`, `core/`, `index.ts`, `lib/`, `middleware/`, `routes/`, `types/`

**Step 4: Commit**

```bash
git add services/stage-engine/
git commit -m "feat: add stage-engine service source"
```

---

### Task 5: Generate standalone pnpm-lock.yaml for stage-engine

**Files:**

- Modify: `smartout-infra/services/stage-engine/` (generate lockfile)

The current Dockerfile copies `pnpm-lock.yaml` from the monorepo root. For a standalone service, stage-engine needs its own lockfile.

**Step 1: Install dependencies to generate lockfile**

```bash
cd ~/Dev/smartout-infra/services/stage-engine
pnpm install
```

**Step 2: Verify lockfile was created**

Run: `ls -la ~/Dev/smartout-infra/services/stage-engine/pnpm-lock.yaml`
Expected: File exists

**Step 3: Clean up node_modules (Docker will install fresh)**

```bash
rm -rf node_modules
```

**Step 4: Commit**

```bash
cd ~/Dev/smartout-infra
git add services/stage-engine/pnpm-lock.yaml
git commit -m "chore: generate standalone lockfile for stage-engine"
```

---

### Task 6: Rewrite Dockerfile for standalone + multi-stage dev/prod

**Files:**

- Modify: `smartout-infra/services/stage-engine/Dockerfile`

The current Dockerfile assumes monorepo root as build context. Rewrite it to:

1. Work with `context: ./services/stage-engine` (standalone)
2. Support `target: development` (hot reload) and `target: production` (minimal image)

**Step 1: Rewrite the Dockerfile**

```dockerfile
# ============================================
# Dockerfile — Stage Engine
# Multi-stage build with dev and prod targets.
# Standalone — no monorepo dependency.
# Connected to: docker-compose.yml (base orchestration)
# Connected to: docker-compose.override.yml (dev target)
# Connected to: docker-compose.prod.yml (prod target)
# ============================================

# --- Base: shared setup for both targets ---
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml package.json ./

# --- Development: hot reload with tsx ---
FROM base AS development
RUN pnpm install
COPY tsconfig.json ./
COPY src ./src
# tsx watch is set via docker-compose override command
CMD ["pnpm", "dev"]

# --- Builder: compile TypeScript ---
FROM base AS builder
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# --- Production: minimal runtime image ---
FROM node:22-alpine AS production
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/dist ./dist
EXPOSE 3000
ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]
```

Key changes from old Dockerfile:

- No more monorepo root context — copies `pnpm-lock.yaml` from own directory
- Three stages: `development` (with tsx for hot reload), `builder` (compile TS), `production` (minimal)
- Production stage runs as non-root `node` user (security)
- Dev stage keeps full dependencies for tsx watch

**Step 2: Verify the Dockerfile syntax**

Run: `docker build --check -f services/stage-engine/Dockerfile services/stage-engine/ 2>&1 || echo "Docker check not available, will verify during compose up"`

**Step 3: Commit**

```bash
git add services/stage-engine/Dockerfile
git commit -m "feat: rewrite Dockerfile for standalone multi-stage build"
```

---

## Phase 3: Docker Compose (Base)

### Task 7: Create base docker-compose.yml — network and volumes

**Files:**

- Create: `smartout-infra/docker-compose.yml`

Start with just the network, volumes, and Caddy. We'll add services in the next tasks.

**Step 1: Write docker-compose.yml**

```yaml
# ============================================
# docker-compose.yml — Smartout Infrastructure (base)
# Defines the shared network, volumes, and all services.
# Override with docker-compose.override.yml (auto-loaded for dev)
# or docker-compose.prod.yml for production.
# Connected to: Caddyfile (production proxy config)
# Connected to: Caddyfile.dev (local dev proxy config)
# ============================================

networks:
  smartout-internal:
    driver: bridge

volumes:
  caddy_data:
  caddy_config:
  n8n_data:

services:
  # ============================================
  # Caddy — Reverse proxy, auto HTTPS
  # The ONLY service exposed to the internet.
  # All other services are internal-only.
  # ============================================
  caddy:
    image: caddy:2-alpine
    container_name: smartout-caddy
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
      test: ["CMD", "caddy", "version"]
      interval: 30s
      timeout: 5s
      retries: 3

  # ============================================
  # Stage Engine — Universal agent gateway
  # All agent communication flows through here.
  # Hono on port 3000, /health endpoint for checks.
  # ============================================
  stage-engine:
    build:
      context: ./services/stage-engine
      dockerfile: Dockerfile
    container_name: smartout-stage-engine
    expose:
      - "3000"
    env_file:
      - .env
    environment:
      - PORT=3000
      - SERVICE_NAME=stage-engine
    networks:
      - smartout-internal
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    depends_on:
      caddy:
        condition: service_healthy

  # ============================================
  # n8n — Workflow automation
  # Handles complex multi-step workflows.
  # ============================================
  n8n:
    image: n8nio/n8n:latest
    container_name: smartout-n8n
    expose:
      - "5678"
    env_file:
      - .env
    environment:
      - N8N_HOST=n8n.smartout.ai
      - N8N_PORT=5678
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=https://n8n.smartout.ai/
    volumes:
      - n8n_data:/home/node/.n8n
    networks:
      - smartout-internal
    restart: unless-stopped
    healthcheck:
      test:
        ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:5678/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3
```

**Step 2: Validate the compose file syntax**

Run: `cd ~/Dev/smartout-infra && docker compose config --quiet`
Expected: No output (valid config)

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add base docker-compose with Caddy, stage-engine, n8n"
```

---

### Task 8: Verify compose file parses correctly

**Step 1: Run config check**

Run: `cd ~/Dev/smartout-infra && docker compose config`
Expected: Expanded YAML output showing all three services, the `smartout-internal` network, and three named volumes.

**Step 2: Check service names resolve**

Look for these in the output:

- `services.caddy` with ports 443 and 80
- `services.stage-engine` with expose 3000
- `services.n8n` with expose 5678
- `networks.smartout-internal` with driver bridge

No commit needed — this is a verification step.

---

## Phase 4: Dev & Prod Overlays

### Task 9: Placeholder — create .env for local dev

**Files:**

- Create: `smartout-infra/.env` (from template, gitignored)

**Step 1: Copy template**

```bash
cd ~/Dev/smartout-infra
cp .env.example .env
```

**Step 2: Fill in local values**

Edit `.env` and set real values for local development. At minimum:

```bash
SUPABASE_URL=<your local or production Supabase URL>
SUPABASE_ANON_KEY=<your anon key>
SUPABASE_SERVICE_ROLE_KEY=<your service role key>
ENGINE_URL=http://localhost:3000
ULTRAVOX_API_KEY=<your Ultravox key>
N8N_BASIC_AUTH_PASSWORD=<local password>
N8N_ENCRYPTION_KEY=<generate with: openssl rand -hex 32>
```

**Step 3: Verify .env is gitignored**

Run: `cd ~/Dev/smartout-infra && git status`
Expected: `.env` does NOT appear in untracked files

No commit — `.env` is gitignored.

---

### Task 10: Create docker-compose.override.yml (dev)

**Files:**

- Create: `smartout-infra/docker-compose.override.yml`

This file is auto-loaded by `docker compose up` (no flags needed). It adds dev-specific settings: hot reload, debug ports, localhost routing.

**Step 1: Write docker-compose.override.yml**

```yaml
# ============================================
# docker-compose.override.yml — Local Development
# Auto-loaded when you run: docker compose up
# Adds: hot reload, debug ports, localhost Caddy config.
# Connected to: Caddyfile.dev (localhost routing)
# ============================================

services:
  caddy:
    volumes:
      - ./Caddyfile.dev:/etc/caddy/Caddyfile

  stage-engine:
    build:
      target: development
    volumes:
      - ./services/stage-engine/src:/app/src
    ports:
      - "3000:3000"
      - "9229:9229"
    environment:
      - LOG_LEVEL=debug
      - NODE_ENV=development
      - ENGINE_URL=http://localhost:3000

  n8n:
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=localhost
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://localhost:5678/
```

**Step 2: Verify combined config**

Run: `cd ~/Dev/smartout-infra && docker compose config | grep -A2 "target:"`
Expected: Shows `target: development` for stage-engine

**Step 3: Commit**

```bash
git add docker-compose.override.yml
git commit -m "feat: add dev override with hot reload and debug ports"
```

---

### Task 11: Create docker-compose.prod.yml

**Files:**

- Create: `smartout-infra/docker-compose.prod.yml`

Used with: `docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d`

**Step 1: Write docker-compose.prod.yml**

```yaml
# ============================================
# docker-compose.prod.yml — Production Overrides
# Use with: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
# Adds: resource limits, production build target, log rotation.
# Connected to: Caddyfile (production proxy config)
# ============================================

services:
  caddy:
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile

  stage-engine:
    build:
      target: production
    deploy:
      resources:
        limits:
          cpus: "1"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 128M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"

  n8n:
    deploy:
      resources:
        limits:
          cpus: "1"
          memory: 1G
        reservations:
          cpus: "0.25"
          memory: 256M
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "5"
```

**Step 2: Verify production config merges correctly**

Run: `cd ~/Dev/smartout-infra && docker compose -f docker-compose.yml -f docker-compose.prod.yml config | grep -A2 "target:"`
Expected: Shows `target: production` for stage-engine (NOT development)

**Step 3: Commit**

```bash
git add docker-compose.prod.yml
git commit -m "feat: add production overlay with resource limits and log rotation"
```

---

## Phase 5: Caddy Configs

### Task 12: Create production Caddyfile

**Files:**

- Create: `smartout-infra/Caddyfile`

**Step 1: Write the production Caddyfile**

```
# ============================================
# Caddyfile — Production reverse proxy
# Auto-provisions HTTPS via Let's Encrypt.
# Each subdomain routes to its Docker service.
# Connected to: docker-compose.yml (caddy service)
# ============================================

engine.smartout.ai {
    reverse_proxy stage-engine:3000
    encode gzip

    log {
        output file /var/log/caddy/engine.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}

n8n.smartout.ai {
    reverse_proxy n8n:5678
    encode gzip

    log {
        output file /var/log/caddy/n8n.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}

# Future services — uncomment when ready:
#
# mcp.smartout.ai {
#     reverse_proxy mcp-router:3001
#     encode gzip
# }
#
# hooks.smartout.ai {
#     reverse_proxy webhook-relay:3003
#     encode gzip
# }
```

**Step 2: Verify syntax**

Run: `docker run --rm -v "$(pwd)/Caddyfile:/etc/caddy/Caddyfile" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile 2>&1`
Expected: `Valid configuration` (or will fail because DNS doesn't resolve — that's OK locally)

**Step 3: Commit**

```bash
git add Caddyfile
git commit -m "feat: add production Caddyfile with subdomain routing"
```

---

### Task 13: Create dev Caddyfile

**Files:**

- Create: `smartout-infra/Caddyfile.dev`

**Step 1: Write the dev Caddyfile**

```
# ============================================
# Caddyfile.dev — Local development proxy
# No HTTPS. Routes by path prefix on localhost:80.
# Connected to: docker-compose.override.yml (caddy volumes override)
# ============================================

:80 {
    # Stage Engine — default and /engine prefix
    handle /engine/* {
        uri strip_prefix /engine
        reverse_proxy stage-engine:3000
    }

    # n8n — /n8n prefix
    handle /n8n/* {
        uri strip_prefix /n8n
        reverse_proxy n8n:5678
    }

    # Default route: Stage Engine
    handle {
        reverse_proxy stage-engine:3000
    }
}
```

**Step 2: Verify syntax**

Run: `docker run --rm -v "$(pwd)/Caddyfile.dev:/etc/caddy/Caddyfile" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile 2>&1`
Expected: `Valid configuration`

**Step 3: Commit**

```bash
git add Caddyfile.dev
git commit -m "feat: add dev Caddyfile with localhost path-based routing"
```

---

## Phase 6: Scripts

### Task 14: Create health-check.sh

**Files:**

- Create: `smartout-infra/scripts/health-check.sh`

**Step 1: Write the health check script**

```bash
#!/bin/bash
# ============================================
# health-check.sh — Ping all service health endpoints
# Run after deploy or to verify stack health.
# Connected to: docker-compose.yml (service definitions)
# ============================================

set -euo pipefail

echo "Checking services..."

check() {
  local name="$1"
  local url="$2"
  if curl -sf --max-time 5 "$url" > /dev/null 2>&1; then
    echo "  OK  $name"
  else
    echo "  FAIL  $name ($url)"
    FAILED=1
  fi
}

FAILED=0

check "Caddy"        "http://localhost:80"
check "Stage Engine"  "http://localhost:3000/health"
check "n8n"           "http://localhost:5678/healthz"

if [ "$FAILED" -eq 1 ]; then
  echo ""
  echo "Some services failed health check!"
  exit 1
else
  echo ""
  echo "All services healthy."
fi
```

**Step 2: Make executable**

```bash
chmod +x scripts/health-check.sh
```

**Step 3: Commit**

```bash
git add scripts/health-check.sh
git commit -m "feat: add health check script"
```

---

### Task 15: Create setup.sh

**Files:**

- Create: `smartout-infra/scripts/setup.sh`

**Step 1: Write the setup script**

```bash
#!/bin/bash
# ============================================
# setup.sh — First-time setup for smartout-infra
# Creates .env from template and verifies Docker is available.
# Connected to: .env.example (template)
# ============================================

set -euo pipefail

echo "=== Smartout Infra Setup ==="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
  echo "ERROR: Docker is not installed."
  echo "Install: https://docs.docker.com/get-docker/"
  exit 1
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
  echo "ERROR: Docker Compose plugin not found."
  echo "Install: https://docs.docker.com/compose/install/"
  exit 1
fi

echo "Docker: $(docker --version)"
echo "Compose: $(docker compose version)"
echo ""

# Create .env if missing
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from template."
  echo "IMPORTANT: Edit .env and fill in your values before starting."
else
  echo ".env already exists — skipping."
fi

echo ""
echo "Setup complete. Next steps:"
echo "  1. Edit .env with your values"
echo "  2. Run: docker compose up"
echo ""
```

**Step 2: Make executable**

```bash
chmod +x scripts/setup.sh
```

**Step 3: Commit**

```bash
git add scripts/setup.sh
git commit -m "feat: add first-time setup script"
```

---

### Task 16: Create deploy.sh

**Files:**

- Create: `smartout-infra/scripts/deploy.sh`

**Step 1: Write the deploy script**

```bash
#!/bin/bash
# ============================================
# deploy.sh — Pull latest code, rebuild, restart on production
# Run on the DigitalOcean Droplet.
# Connected to: docker-compose.yml + docker-compose.prod.yml
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Smartout Deploy ==="
echo "Working directory: $INFRA_DIR"
echo ""

cd "$INFRA_DIR"

# Pull latest infra config
echo "Pulling latest infra..."
git pull

# Pull latest service code
echo "Pulling latest stage-engine..."
cd services/stage-engine && git pull && cd "$INFRA_DIR"

# Rebuild and restart
echo "Rebuilding and restarting..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Wait for services to start
echo "Waiting for services to start..."
sleep 5

# Health check
echo "Running health checks..."
"$SCRIPT_DIR/health-check.sh"

echo ""
echo "=== Deploy complete ==="
```

**Step 2: Make executable**

```bash
chmod +x scripts/deploy.sh
```

**Step 3: Commit**

```bash
git add scripts/deploy.sh
git commit -m "feat: add production deploy script"
```

---

### Task 17: Create backup.sh

**Files:**

- Create: `smartout-infra/scripts/backup.sh`

**Step 1: Write the backup script**

```bash
#!/bin/bash
# ============================================
# backup.sh — Backup Docker volumes
# Saves n8n data and Caddy certificates.
# Connected to: docker-compose.yml (volume definitions)
# ============================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/smartout/$(date +%Y-%m-%d_%H%M)}"
mkdir -p "$BACKUP_DIR"

echo "=== Smartout Backup ==="
echo "Saving to: $BACKUP_DIR"
echo ""

# Backup n8n data
echo "Backing up n8n data..."
docker compose exec -T n8n tar czf - /home/node/.n8n > "$BACKUP_DIR/n8n-data.tar.gz"
echo "  Saved: n8n-data.tar.gz"

# Backup Caddy data (certificates)
echo "Backing up Caddy certificates..."
docker compose exec -T caddy tar czf - /data > "$BACKUP_DIR/caddy-data.tar.gz"
echo "  Saved: caddy-data.tar.gz"

echo ""
echo "=== Backup complete: $BACKUP_DIR ==="
ls -lh "$BACKUP_DIR"
```

**Step 2: Make executable**

```bash
chmod +x scripts/backup.sh
```

**Step 3: Commit**

```bash
git add scripts/backup.sh
git commit -m "feat: add volume backup script"
```

---

## Phase 7: Local Verification

### Task 18: Build the stage-engine image

**Step 1: Build the development image**

```bash
cd ~/Dev/smartout-infra
docker compose build stage-engine
```

Expected: Build completes with no errors. Look for:

- `[builder] pnpm install --frozen-lockfile`
- `[development] COPY src ./src`
- Successfully tagged image

**Step 2: Verify the image exists**

Run: `docker images | grep stage-engine`
Expected: Image listed with recent timestamp

No commit — verification only.

---

### Task 19: Start the full stack locally

**Step 1: Ensure .env is populated**

Run: `grep -c "REPLACE_ME" ~/Dev/smartout-infra/.env`
Expected: `0` (no remaining placeholders)

**Step 2: Start the stack**

```bash
cd ~/Dev/smartout-infra
docker compose up -d
```

Expected: All three containers start:

- `smartout-caddy` → running
- `smartout-stage-engine` → running
- `smartout-n8n` → running

**Step 3: Verify all containers are running**

Run: `docker compose ps`
Expected: Three services with status `Up` or `healthy`

No commit — verification only.

---

### Task 20: Run health checks and test inter-service communication

**Step 1: Run health check script**

```bash
cd ~/Dev/smartout-infra
./scripts/health-check.sh
```

Expected:

```
Checking services...
  OK  Caddy
  OK  Stage Engine
  OK  n8n
All services healthy.
```

**Step 2: Test Stage Engine via Caddy**

```bash
curl http://localhost/health
```

Expected: JSON response `{"status":"ok","service":"stage-engine",...}`

**Step 3: Test inter-service DNS (from inside a container)**

```bash
docker compose exec stage-engine wget -qO- http://n8n:5678/healthz
```

Expected: n8n health response (proves services can reach each other by name)

**Step 4: Stop the stack**

```bash
docker compose down
```

No commit — verification only.

---

## Phase 8: Production Prep

### Task 21: Document DNS requirements

**Files:**

- This is a manual step — no code to write.

Set up these DNS records pointing to your DigitalOcean Droplet IP:

| Subdomain          | Type | Value        | TTL |
| ------------------ | ---- | ------------ | --- |
| engine.smartout.ai | A    | (Droplet IP) | 300 |
| n8n.smartout.ai    | A    | (Droplet IP) | 300 |

Both point to the same Droplet. Caddy routes by subdomain.

**Step 1: Add A records in your DNS provider (Cloudflare, Namecheap, etc.)**

**Step 2: Verify DNS propagation**

```bash
dig engine.smartout.ai +short
dig n8n.smartout.ai +short
```

Expected: Both return the Droplet IP.

---

### Task 22: Document Droplet setup steps

**Files:**

- This is a reference checklist for running ON the Droplet.

```bash
# SSH into Droplet
ssh root@<DROPLET_IP>

# Install Docker
curl -fsSL https://get.docker.com | sh

# Install Docker Compose plugin
apt-get update && apt-get install -y docker-compose-plugin

# Create non-root app user
adduser smartout
usermod -aG docker smartout

# Configure firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Switch to app user
su - smartout

# Clone infra repo
git clone <your-smartout-infra-repo-url>
cd smartout-infra

# Clone stage-engine into services/
git clone <your-stage-engine-repo-url> services/stage-engine

# Set up production environment
cp .env.example .env.prod
# Edit .env.prod with production values

# Start with production config
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d

# Verify
./scripts/health-check.sh
```

No commit — this is a reference checklist, not a file to create.

---

### Task 23: Create .env.prod on the Droplet

**Step 1: SSH into the Droplet and create .env.prod**

```bash
ssh smartout@<DROPLET_IP>
cd smartout-infra
cp .env.example .env.prod
```

**Step 2: Edit .env.prod with production values**

Use 1Password references or fetch from your secrets manager:

```bash
# Use op:// references if using 1Password CLI
op run --env-file=.env.example > .env.prod
```

Or manually edit with production Supabase URL, keys, etc.

**Step 3: Verify no REPLACE_ME values remain**

```bash
grep -c "REPLACE_ME" .env.prod
```

Expected: `0`

---

## Phase 9: Documentation

### Task 24: Create README.md

**Files:**

- Create: `smartout-infra/README.md`

**Step 1: Write the README**

````markdown
# Smartout Infrastructure

Docker network orchestration for Smartout microservices.

## Services

| Service      | Port | Subdomain          | Status |
| ------------ | ---- | ------------------ | ------ |
| Caddy        | 443  | (reverse proxy)    | Active |
| Stage Engine | 3000 | engine.smartout.ai | Active |
| n8n          | 5678 | n8n.smartout.ai    | Active |

## Quick Start (Local Dev)

```bash
# First time
./scripts/setup.sh
# Edit .env with your values

# Start
docker compose up -d

# Check health
./scripts/health-check.sh

# Watch logs
docker compose logs -f stage-engine

# Stop
docker compose down
```
````

## Production

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d
```

## Adding a New Service

1. Add service directory in `services/`
2. Add service definition in `docker-compose.yml`
3. Add Caddy route in `Caddyfile` (if external)
4. Add DNS A record pointing to Droplet IP
5. Deploy: `docker compose up -d --build <service-name>`

````

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with quick start and service registry"
````

---

### Task 25: Write ADR for infrastructure decision

**Files:**

- Create: `~/Dev/smartout_v3/docs/decisions/0029-docker-network-infra.md`
- Modify: `~/Dev/smartout_v3/docs/decisions/0000-decision-log.md`

**Step 1: Write the ADR**

Use template from `docs/templates/decision.md`. Key points:

- **Context:** Smartout has multiple microservices (stage-engine, n8n, future MCP servers, agents). Each currently runs independently. Need unified networking, shared reverse proxy, and reproducible local/prod environments.
- **Decision:** Separate `smartout-infra` repo with Docker Compose + Caddy. Three-file compose strategy (base, dev override, prod overlay). Bridge network for internal communication.
- **Alternatives considered:**
  - Docker Compose inside monorepo (rejected: services may come from different repos)
  - Kubernetes (rejected: overkill for current scale, adds operational complexity)
  - Traefik instead of Caddy (rejected: Caddy has simpler config and auto-HTTPS)
  - Single compose file with profiles (rejected: three-file strategy is clearer)
- **Consequences:** All services must have standalone Dockerfiles. DNS records needed per subdomain. Caddy handles HTTPS — no manual cert management.

**Step 2: Register in decision log**

Add to `docs/decisions/0000-decision-log.md`:

```
| 0029 | Docker network infra | Separate infra repo, Docker Compose, Caddy, bridge network | Active |
```

**Step 3: Commit (in smartout_v3 repo)**

```bash
cd ~/Dev/smartout_v3
git add docs/decisions/0029-docker-network-infra.md docs/decisions/0000-decision-log.md
git commit -m "docs(adr): add ADR-0029 Docker network infrastructure"
```

---

## Security Checklist (verify after all tasks)

| Check                                                      | Expected |
| ---------------------------------------------------------- | -------- |
| Only Caddy exposed to internet (ports 443/80)              | Yes      |
| All other services use `expose`, not `ports` in production | Yes      |
| `.env` and `.env.prod` in `.gitignore`                     | Yes      |
| No secrets in docker-compose files                         | Yes      |
| Stage Engine runs as non-root `node` user in production    | Yes      |
| Resource limits set in `docker-compose.prod.yml`           | Yes      |
| Health checks on every service                             | Yes      |
| Log rotation configured in production                      | Yes      |
| UFW firewall: allow only 22, 80, 443                       | Yes      |
| Supabase service role key only in `.env`, never in code    | Yes      |

---

## Adding Future Services (Reference)

When a new microservice needs to join the network:

1. **Create service** in `services/<name>/` with a `Dockerfile` and `/health` endpoint
2. **Add to `docker-compose.yml`:**

```yaml
my-service:
  build:
    context: ./services/my-service
    dockerfile: Dockerfile
  container_name: smartout-my-service
  expose:
    - "300X"
  env_file:
    - .env
  networks:
    - smartout-internal
  restart: unless-stopped
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:300X/health"]
    interval: 30s
    timeout: 5s
    retries: 3
```

3. **Add Caddy route** in `Caddyfile` (if externally accessible):

```
my-service.smartout.ai {
    reverse_proxy my-service:300X
    encode gzip
}
```

4. **Add DNS A record** pointing `my-service.smartout.ai` → Droplet IP
5. **Add to `scripts/health-check.sh`**
6. **Deploy:** `docker compose up -d --build my-service`
