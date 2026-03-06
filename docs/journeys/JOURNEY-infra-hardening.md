---
title: "Journey — infra-hardening"
status: done
updated: 2026-04-10
created: 2026-04-10
module: infra
tags: [journey, docker, caddy, security, production]
---

# Journey — Infrastructure Production Hardening

## Journey: DevOps — Deploy to Production

**Precondition:** Code is on `development`, DO droplet has Docker + Compose installed, `infra/.env` is populated.

1. DevOps runs `./infra/scripts/deploy.sh` → Script pulls latest code, runs `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` → All 6 services start with:
   - Non-root containers (USER node / USER nobody)
   - Log rotation (10m x 3 files per service)
   - Resource limits (memory + CPU)
   - Loopback-only port bindings (127.0.0.1)
2. Deploy script waits 5s → Runs `health-check.sh` → Curls all 6 service health endpoints on localhost
3. All services respond OK → Deploy reports success

**Postcondition:** All services running, Caddy auto-provisions HTTPS, security headers active on all routes.

**Error paths:**

- Missing `SUPABASE_URL` in `.env` → `docker compose` refuses to start with error: "SUPABASE_URL is required"
- Missing `N8N_ENCRYPTION_KEY` → n8n starts but cannot encrypt credentials (empty key, user must generate)
- Health check fails → Deploy reports FAIL with specific service name and URL

## Journey: DevOps — First-Time Setup

**Precondition:** Fresh DO droplet with Docker installed.

1. DevOps runs `./infra/scripts/setup.sh` → Script checks Docker + Compose versions → Copies `.env.example` to `infra/.env`
2. DevOps edits `infra/.env` → Fills in Supabase URL, keys, API keys → N8N_ENCRYPTION_KEY section warns to generate own key (`openssl rand -hex 32`)
3. DevOps runs `cd infra && docker compose up --build` → Override auto-applies → Caddyfile.dev mounted → Services start with dev fallbacks

**Postcondition:** Local dev stack running with all services accessible on direct ports.

**Error paths:**

- Docker not installed → Setup script prints error and link to install docs
- Missing `.env` values → Fail-fast for SUPABASE_URL; other services degrade gracefully

## Journey: DevOps — Automated Backups

**Precondition:** Stack running in production, cron installed.

1. DevOps runs `crontab -e` → Adds line: `0 3 * * * /path/to/infra/scripts/backup-cron.sh`
2. Cron fires at 3:00 AM → `backup-cron.sh` calls `backup.sh` → Backs up n8n data + Caddy certificates to `~/backups/smartout/YYYY-MM-DD_HHMM/`
3. Cron wrapper prunes backups older than 7 days → Prunes logs older than 30 days

**Postcondition:** Daily backups with automatic rotation. Logs in `~/backups/smartout/logs/`.

**Error paths:**

- `backup.sh` fails (Docker not running, service down) → Cron wrapper logs "FAILED" and exits 1
- Disk full → `find -exec rm` in prune step frees space from old backups

## Journey: Developer — CI Catches Dockerfile Error

**Precondition:** Developer pushes a branch with a broken Dockerfile.

1. Developer pushes to `development` or opens PR → CI triggers
2. `docker-build` job runs 4 parallel matrix builds (stage-engine, shift-mcp, contract-service, scrapling)
3. Broken Dockerfile fails → CI reports which specific service failed → Developer fixes and re-pushes

**Postcondition:** Dockerfile errors caught before deploy. Other CI jobs (lint, typecheck, build) run independently.

**Error paths:**

- All 4 builds fail → Full matrix results shown (fail-fast: false)
- Build succeeds but runtime fails → Not caught by CI (build-only verification)

## Journey: External Client — Receives Security Headers

**Precondition:** Client makes HTTPS request to any `*.smartout.ai` service endpoint.

1. Client sends request → Caddy terminates TLS (auto Let's Encrypt) → Applies security_headers snippet
2. Response includes: `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, no `Server` header
3. For `engine.smartout.ai`: Caddy also enables `flush_interval -1` for SSE streaming with 300s upstream timeouts

**Postcondition:** All responses hardened. Browser enforces HTTPS on return visits. No information disclosure via Server header.

**Error paths:**

- Caddy config invalid → Caddy refuses to start (validate before deploy)
- Streaming response > 300s → Upstream transport timeout kills connection (increase if needed)
