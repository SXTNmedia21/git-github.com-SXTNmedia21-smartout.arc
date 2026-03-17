---
title: Infrastructure Production Hardening
status: draft
updated: 2026-04-10
created: 2026-04-10
module: infra
tags: [docker, caddy, security, production, hardening]
---

# Infrastructure Production Hardening — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the Docker + Caddy infrastructure layer so it's production-safe — fix root containers, add security headers, create .dockerignore, remove localhost fallbacks, and automate backups.

**Architecture:** 8 targeted fixes across Dockerfiles, Caddyfile, docker-compose, .env.example, CI, and cron. No new services or architectural changes — purely hardening what exists.

**Tech Stack:** Docker, Docker Compose, Caddy 2, GitHub Actions, bash, cron

---

### Task 1: Add `USER node` to stage-engine Dockerfile

**Files:**

- Modify: `services/stage-engine/Dockerfile:56-58`

**Why:** stage-engine is the only Node service running as root in its container. shift-mcp and contract-service already have `USER node`. This is a container escape risk.

**Step 1: Add USER directive**

Add `USER node` before the CMD line in the production stage, matching the pattern in `services/shift-mcp/Dockerfile:38` and `services/contract-service/Dockerfile:38`.

```dockerfile
WORKDIR /app/services/stage-engine
EXPOSE 5010
ENV NODE_ENV=production
USER node
CMD ["node", "dist/index.js"]
```

**Step 2: Verify the build**

Run:

```bash
cd /home/sxtnl/dev/smartout.ai/infra && docker compose build stage-engine
```

Expected: Build succeeds with no errors.

**Step 3: Verify container runs as non-root**

Run:

```bash
cd /home/sxtnl/dev/smartout.ai/infra && docker compose run --rm stage-engine whoami
```

Expected: Output is `node`, NOT `root`.

**Step 4: Commit**

```bash
git add services/stage-engine/Dockerfile
git commit -m "fix(docker): run stage-engine as non-root user

Add USER node directive to stage-engine Dockerfile production stage,
matching shift-mcp and contract-service. Prevents container escape risk."
```

---

### Task 2: Create `.dockerignore` at monorepo root

**Files:**

- Create: `.dockerignore`

**Why:** All Node service Dockerfiles use `context: ../` (monorepo root). Without `.dockerignore`, every `COPY` sends the entire repo as build context — including `node_modules`, `.next`, `.git`, and potentially `.env.local`. This slows builds and risks leaking secrets into image layers.

**Step 1: Create the file**

```
# Dependencies (installed inside container)
node_modules
**/node_modules

# Build output (built inside container)
.next
**/dist
**/build

# Git
.git
.gitignore

# Environment (secrets)
.env
.env.local
.env.*.local
infra/.env

# IDE / OS
.vscode
.idea
*.swp
.DS_Store

# Dev artifacts
.dev-*.log
.turbo
coverage
playwright-report
test-results
artifacts

# Docker (prevent recursive context)
infra/docker-compose*.yml
infra/Caddyfile*
infra/scripts

# Documentation (not needed in images)
docs
*.md
!packages/*/README.md

# Worktrees
.local
```

**Step 2: Verify build context is smaller**

Run:

```bash
cd /home/sxtnl/dev/smartout.ai/infra && docker compose build stage-engine 2>&1 | head -5
```

Expected: Build starts faster (smaller context transfer). No errors.

**Step 3: Verify all services still build**

Run:

```bash
cd /home/sxtnl/dev/smartout.ai/infra && docker compose build
```

Expected: All 5 services build successfully.

**Step 4: Commit**

```bash
git add .dockerignore
git commit -m "feat(docker): add .dockerignore to reduce build context

Excludes node_modules, .next, .git, .env files, docs, and dev artifacts.
Faster builds and prevents accidental secret leakage into image layers."
```

---

### Task 3: Remove localhost fallback from SUPABASE_URL in docker-compose.yml

**Files:**

- Modify: `infra/docker-compose.yml:50,78,103`

**Why:** Three services have `SUPABASE_URL=${SUPABASE_URL:-http://host.docker.internal:54321}`. If production `.env` is missing this var, services silently connect to localhost instead of failing. In production, this means data goes nowhere — or worse, to a local Postgres if one happens to exist.

**Step 1: Remove the default fallback**

Change all three occurrences from:

```yaml
- SUPABASE_URL=${SUPABASE_URL:-http://host.docker.internal:54321}
```

To:

```yaml
- SUPABASE_URL=${SUPABASE_URL:?SUPABASE_URL is required}
```

This makes Docker Compose **refuse to start** if `SUPABASE_URL` is not set. The `?` syntax prints the error message and exits.

Lines to change:

- Line 50 (stage-engine)
- Line 78 (shift-mcp)
- Line 103 (contract-service)

**Step 2: Add the dev fallback to docker-compose.override.yml instead**

Add to each service in `infra/docker-compose.override.yml`:

```yaml
stage-engine:
  environment:
    - SUPABASE_URL=${SUPABASE_URL:-http://host.docker.internal:54321}
    # ... existing overrides ...

shift-mcp:
  environment:
    - SUPABASE_URL=${SUPABASE_URL:-http://host.docker.internal:54321}
    # ... existing overrides ...

contract-service:
  environment:
    - SUPABASE_URL=${SUPABASE_URL:-http://host.docker.internal:54321}
    # ... existing overrides ...
```

This way dev still works with the fallback, but production fails fast if the var is missing.

**Step 3: Test dev still works**

Run:

```bash
cd /home/sxtnl/dev/smartout.ai/infra && docker compose config | grep SUPABASE_URL
```

Expected: Shows the `host.docker.internal` fallback (override applies automatically in dev).

**Step 4: Test prod would fail without the var**

Run:

```bash
cd /home/sxtnl/dev/smartout.ai/infra && unset SUPABASE_URL && docker compose -f docker-compose.yml -f docker-compose.prod.yml config 2>&1 | head -5
```

Expected: Error message containing "SUPABASE_URL is required".

**Step 5: Commit**

```bash
git add infra/docker-compose.yml infra/docker-compose.override.yml
git commit -m "fix(docker): fail fast when SUPABASE_URL missing in production

Remove localhost fallback from base compose. Move fallback to dev
override only. Production now refuses to start without explicit URL."
```

---

### Task 4: Add security headers to Caddyfile

**Files:**

- Modify: `infra/Caddyfile`

**Why:** No HSTS, X-Frame-Options, or X-Content-Type-Options headers. Browsers won't enforce HTTPS-only, and the services are vulnerable to clickjacking and MIME-type attacks.

**Step 1: Add a security headers snippet and apply to all routes**

```caddy
# ============================================
# Caddyfile — Smartout reverse proxy (production)
# Auto-provisions HTTPS via Let's Encrypt.
# Internal services (scrapling) have no route — network-isolated.
# Connected to: infra/docker-compose.yml (caddy service)
# Connected to: ADR-0040 (Infrastructure stays in monorepo)
# ============================================

(security_headers) {
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
		X-Frame-Options "DENY"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		-Server
	}
}

# Stage Engine — AI agent orchestration gateway
engine.smartout.ai {
	import security_headers
	reverse_proxy stage-engine:5010
}

# Shift MCP — Schedule management tools for AI agents
schedule-mcp.smartout.ai {
	import security_headers
	reverse_proxy shift-mcp:5011
}

# Contract Service — DocuSeal e-signature management
contract.smartout.ai {
	import security_headers
	reverse_proxy contract-service:5012
}

# n8n — Workflow automation (when deployed)
n8n.smartout.ai {
	import security_headers
	reverse_proxy n8n:5678
}
```

Key decisions:

- `Strict-Transport-Security` with `preload` — enforces HTTPS after first visit
- `X-Frame-Options DENY` — prevents embedding in iframes (clickjacking)
- `X-Content-Type-Options nosniff` — prevents MIME-type sniffing
- `Referrer-Policy strict-origin-when-cross-origin` — limits referrer leakage
- `-Server` removes the `Server: Caddy` header (information disclosure)
- NO `Content-Security-Policy` — these are API services, not HTML pages. CSP would break JSON responses or require per-service tuning.

**Step 2: Validate Caddy config syntax**

Run:

```bash
cd /home/sxtnl/dev/smartout.ai/infra && docker compose run --rm caddy caddy validate --config /etc/caddy/Caddyfile
```

Expected: "Valid configuration" or similar success message.

**Step 3: Commit**

```bash
git add infra/Caddyfile
git commit -m "feat(caddy): add security headers to all production routes

HSTS with preload, X-Frame-Options DENY, X-Content-Type-Options nosniff,
strict Referrer-Policy, Server header removed. Applied via shared snippet."
```

---

### Task 5: Add rate limiting to Caddy

**Files:**

- Modify: `infra/Caddyfile`

**Why:** All API endpoints are currently unlimited. A single client can hammer any service with thousands of requests per second. Caddy v2 has a built-in `rate_limit` directive via the `caddy-ext/ratelimit` module — but this requires a custom Caddy build. The simpler alternative is connection limiting via `servers` block, which works with stock Caddy.

**Step 1: Check if rate_limit module is available in stock Caddy Alpine**

The stock `caddy:2-alpine` image does NOT include the rate_limit module. Two options:

**Option A (recommended — simple):** Use Caddy's built-in `max_header_size` and connection limits at the server level. This is a blunt instrument but works without custom builds.

**Option B (proper rate limiting):** Build a custom Caddy image with the rate_limit module.

For now, use Option A — add connection-level protection:

Add to top of Caddyfile:

```caddy
{
	servers {
		timeouts {
			read_body   10s
			read_header 5s
			write       30s
			idle        120s
		}
	}
}
```

This prevents slowloris attacks and limits idle connections. True per-IP rate limiting requires a custom Caddy build — document this as a future improvement.

**Step 2: Validate config**

Run:

```bash
cd /home/sxtnl/dev/smartout.ai/infra && docker compose run --rm caddy caddy validate --config /etc/caddy/Caddyfile
```

Expected: Valid configuration.

**Step 3: Commit**

```bash
git add infra/Caddyfile
git commit -m "feat(caddy): add server timeouts for connection-level protection

Prevents slowloris and idle connection abuse. True per-IP rate limiting
requires custom Caddy build — tracked as future improvement."
```

---

### Task 6: Fix N8N_ENCRYPTION_KEY example value in .env.example

**Files:**

- Modify: `.env.example:155`

**Why:** The file contains a pre-filled `N8N_ENCRYPTION_KEY=5e94d1f4...`. If someone copies `.env.example` to production without changing it, all n8n credentials are encrypted with a publicly visible key. Anyone who reads this repo can decrypt them.

**Step 1: Replace with empty value and bold warning**

Change line 155 from:

```
N8N_ENCRYPTION_KEY=5e94d1f440ace24147a5d47343ea7f91ecce616b9621f2ac74ab9c639ce270b8
```

To:

```
# IMPORTANT: Generate your own key. This encrypts all n8n credentials.
# Changing it after first run makes existing credentials unreadable.
# Generate: openssl rand -hex 32
N8N_ENCRYPTION_KEY=
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "fix(env): remove default N8N_ENCRYPTION_KEY from .env.example

Pre-filled key was publicly visible in the repo. Anyone with repo access
could decrypt n8n credentials. Now requires explicit generation."
```

---

### Task 7: Add Docker build step to CI

**Files:**

- Modify: `.github/workflows/ci.yml`

**Why:** Currently CI validates code (lint, typecheck, build) but never builds Docker images. A Dockerfile syntax error or missing dependency won't be caught until manual deploy. Adding a Docker build step catches these issues before merge.

**Step 1: Add a docker-build job**

Add after the `build` job:

```yaml
# ── Docker builds (verify images compile) ────────────────────
docker-build:
  name: Docker Build
  runs-on: ubuntu-latest
  strategy:
    fail-fast: false
    matrix:
      service:
        - name: stage-engine
          dockerfile: services/stage-engine/Dockerfile
        - name: shift-mcp
          dockerfile: services/shift-mcp/Dockerfile
        - name: contract-service
          dockerfile: services/contract-service/Dockerfile
        - name: scrapling
          dockerfile: services/scrapling/Dockerfile
          context: services/scrapling
  steps:
    - uses: actions/checkout@v4
    - name: Build ${{ matrix.service.name }}
      run: |
        docker build \
          -f ${{ matrix.service.dockerfile }} \
          -t smartout/${{ matrix.service.name }}:ci \
          ${{ matrix.service.context || '.' }}
```

Key decisions:

- `fail-fast: false` — build all 4 even if one fails (want full picture)
- `context` defaults to `.` (monorepo root) for Node services, `services/scrapling` for Python
- Tags with `:ci` — not pushed anywhere, just validates the build
- No Docker layer caching (keep simple, builds are ~2-3 min each)
- Runs in parallel with existing jobs (no `needs:`)

**Step 2: Verify syntax**

Run:

```bash
cd /home/sxtnl/dev/smartout.ai && cat .github/workflows/ci.yml | python3 -c "import sys,yaml; yaml.safe_load(sys.stdin); print('Valid YAML')" 2>&1 || echo "Install pyyaml: pip install pyyaml"
```

If pyyaml isn't available, just verify manually that indentation is correct.

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat(ci): add Docker build verification for all 4 services

Builds stage-engine, shift-mcp, contract-service, and scrapling images
in CI. Catches Dockerfile errors before manual deploy. No image push."
```

---

### Task 8: Add backup cron wrapper script

**Files:**

- Create: `infra/scripts/backup-cron.sh`
- Modify: `infra/README.md` (add cron setup instructions)

**Why:** `backup.sh` exists but has no scheduling. Without cron, backups only happen when someone remembers to run the script. A single missed backup before a failure means lost n8n workflows and Caddy certificates.

**Step 1: Create the cron wrapper**

```bash
#!/bin/bash
# ============================================
# backup-cron.sh — Cron-friendly backup wrapper
# Logs output, keeps last 7 backups, exits cleanly.
# Install: crontab -e → 0 3 * * * /path/to/backup-cron.sh
# Connected to: infra/scripts/backup.sh (actual backup logic)
# ============================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${HOME}/backups/smartout/logs"
BACKUP_BASE="${HOME}/backups/smartout"
KEEP_DAYS=7

mkdir -p "$LOG_DIR"

LOG_FILE="$LOG_DIR/backup-$(date +%Y-%m-%d_%H%M).log"

echo "=== Backup started: $(date) ===" >> "$LOG_FILE"

# Run backup
if "$SCRIPT_DIR/backup.sh" >> "$LOG_FILE" 2>&1; then
  echo "=== Backup completed: $(date) ===" >> "$LOG_FILE"
else
  echo "=== Backup FAILED: $(date) ===" >> "$LOG_FILE"
  exit 1
fi

# Prune old backups (keep last N days)
find "$BACKUP_BASE" -maxdepth 1 -type d -name "20*" -mtime +${KEEP_DAYS} -exec rm -rf {} \; >> "$LOG_FILE" 2>&1
echo "Pruned backups older than ${KEEP_DAYS} days" >> "$LOG_FILE"

# Prune old logs
find "$LOG_DIR" -name "backup-*.log" -mtime +30 -delete >> "$LOG_FILE" 2>&1
```

**Step 2: Make executable**

```bash
chmod +x infra/scripts/backup-cron.sh
```

**Step 3: Add cron instructions to README**

Add a section to `infra/README.md` after the Scripts table:

```markdown
## Automated Backups

Install the daily backup cron job (runs at 3:00 AM):

\`\`\`bash
crontab -e

# Add this line:

0 3 \* \* \* /path/to/smartout.ai/infra/scripts/backup-cron.sh
\`\`\`

Backups are saved to `~/backups/smartout/YYYY-MM-DD_HHMM/`. The cron wrapper keeps the last 7 days and logs to `~/backups/smartout/logs/`.
```

**Step 4: Commit**

```bash
git add infra/scripts/backup-cron.sh infra/README.md
git commit -m "feat(infra): add backup cron wrapper with rotation

Wraps backup.sh for cron: logs output, keeps last 7 days, prunes old
logs. Instructions added to infra/README.md."
```

---

## Summary

| Task | Category | Severity | What                                           |
| ---- | -------- | -------- | ---------------------------------------------- |
| 1    | Docker   | Critical | `USER node` in stage-engine                    |
| 2    | Docker   | Critical | `.dockerignore` at root                        |
| 3    | Docker   | Critical | Remove SUPABASE_URL localhost fallback         |
| 4    | Caddy    | Medium   | Security headers (HSTS, X-Frame-Options, etc.) |
| 5    | Caddy    | Medium   | Server timeouts (connection-level protection)  |
| 6    | Env      | Medium   | Remove pre-filled N8N_ENCRYPTION_KEY           |
| 7    | CI       | Medium   | Docker build verification in GitHub Actions    |
| 8    | Infra    | Medium   | Backup cron wrapper with rotation              |

**Total: 8 tasks, ~8 commits, ~30 minutes of implementation time.**

All tasks are independent — can be done in any order or in parallel.
