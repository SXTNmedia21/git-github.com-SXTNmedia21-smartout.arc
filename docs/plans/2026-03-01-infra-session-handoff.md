---
title: "Infrastructure Session Handoff"
status: handoff
layer: plan
created: 2026-03-01
updated: 2026-03-01
tags: [infrastructure, docker, services, handoff]
---

# Infrastructure Session Handoff — 2026-03-01

## What Got Done

### 1. Full Repo Status Audit

- Mapped all 225 commits across 3-day sprint (Feb 27 – Mar 1)
- Identified Wave 0 complete, Wave 1 at ~60%, Waves 2-6 not started
- Cataloged 40 migrations, 19 Edge Functions, 39 ADRs, 18 modules

### 2. Infrastructure Consolidation (ADR-0040)

Decided to keep all infrastructure in the monorepo, reversing ADR-0035.

**Files created/modified in `infra/`:**

- `docker-compose.yml` — added n8n service + `n8n_data` volume, ref ADR-0040
- `Caddyfile` — added `n8n.smartout.ai` route
- `Caddyfile.dev` — added n8n localhost route (port 3074)
- `docker-compose.override.yml` — added n8n dev overrides (port 5678)
- `docker-compose.prod.yml` — added n8n prod resource limits (1G/1CPU)
- `.env.example` — added n8n vars (host, webhook, auth, encryption, timezone)
- `.gitignore` — added `.env.local`
- `README.md` — updated for all 6 services + scripts docs
- `scripts/setup.sh` — first-time Docker/env setup
- `scripts/deploy.sh` — pull, rebuild, restart on Droplet
- `scripts/health-check.sh` — ping all 6 service health endpoints
- `scripts/backup.sh` — backup n8n data + Caddy certs

**ADR + docs:**

- `docs/decisions/0040-infrastructure-in-monorepo.md` — new, supersedes ADR-0035
- `docs/decisions/0000-decision-log.md` — ADR-0035 marked superseded, ADR-0040 added
- `docs/plans/2026-03-01-infra-consolidation-design.md` — design doc

### 3. Docker Build & Run (All 4 Services)

- Built all 4 service images successfully
- Ran all services via `docker compose up` from `infra/`
- All 4 health endpoints responding through Caddy reverse proxy:
  - Stage Engine: `localhost:3070/health` — OK
  - Shift MCP: `localhost:3071/health` — OK
  - Contract Service: `localhost:3072/health` — OK
  - Scrapling: `localhost:8000/health` — OK
- Integration test: scrapling successfully scraped `smartout.ai`
- Stopped all containers cleanly

### 4. Local Dev Setup (Partial)

- Created `.env` files for stage-engine, shift-mcp, contract-service
- All pointing to local Supabase (127.0.0.1:55331, demo JWT keys)
- Changed stage-engine port from 3000 → 3060 (Twenty CRM conflict)
- Created `infra/.env` for Docker dev mode

---

## What's NOT Done

### Blocking: Services Don't Run Natively Yet

- `tsx` binary not found — `pnpm install` needed at monorepo root
- After install, services should start with `pnpm --filter <service> dev`

### Remaining Tasks

1. **Run `pnpm install`** from monorepo root
2. **Start services natively** and verify health endpoints
3. **Commit all changes** (nothing committed this session)
4. **Delete `/Dev/smartout-infra/`** — only `.env`/`.env.local` are unique (secrets → reference in 1Password, don't copy)
5. **Scrapling Docker fix** — if running in Docker, needs `scrapling[all]` in requirements.txt and extra system deps (curl_cffi, playwright, browserforge). User reverted these changes for now.

---

## Port Map (Local Dev)

| Service          | Port  | Notes                               |
| ---------------- | ----- | ----------------------------------- |
| Stage Engine     | 3060  | Changed from 3000 (Twenty conflict) |
| Shift MCP        | 3001  |                                     |
| Contract Service | 3100  |                                     |
| Scrapling        | 8000  | Python, run directly                |
| Twenty CRM       | 3000  | Already running, don't touch        |
| Supabase API     | 55331 | Non-standard port                   |
| Supabase DB      | 55432 |                                     |
| Supabase Studio  | 55433 |                                     |
| Dashboard (web)  | 3050  |                                     |
| Landing          | 3055  |                                     |
| n8n (future)     | 5678  | Not deployed yet                    |

---

## Learnings

### Port 3000 Is Taken

Twenty CRM runs on port 3000. Any new service targeting 3000 will get Twenty's HTML response instead. Stage-engine moved to 3060.

### Scrapling Has Deep Transitive Dependencies

The `scrapling` Python library imports `curl_cffi`, `playwright`, and `browserforge` at module load time even when only using `Fetcher` (static HTTP). For Docker:

- Use `scrapling[all]>=0.4.0` in requirements.txt
- Add `libcurl4-openssl-dev`, `libssl-dev` to build stage
- Add `libcurl4` to runtime stage
- Playwright pip package needed but browser binaries are NOT (no `playwright install` needed)

### Docker host.docker.internal Works on WSL2

Containers can reach host services (like local Supabase) via `host.docker.internal`. Resolves to `192.168.65.254`. No `extra_hosts` needed in compose.

### Services Need pnpm install Before Native Dev

tsx is declared as a dependency in each service's package.json but won't be in PATH until `pnpm install` runs. After fresh clone or node_modules wipe, always run `pnpm install` first.

### infra/ .env Files Are Permission-Restricted

Claude Code's Read/Write tools may be blocked from accessing `.env` files in `infra/`. Use agents or bash `sed` as workarounds.

### Local Supabase Uses Non-Standard Ports

This project's `supabase/config.toml` maps to port 55331 (API), 55432 (DB), 55433 (Studio). Not the Supabase defaults (54321, 54322, 54323). Always run `npx supabase status` to get actual ports.

### ADR-0040 Supersedes ADR-0035

Infrastructure stays in the monorepo. No separate infra repo needed. The `smartout-infra` repo at `/Dev/smartout-infra/` is deprecated and should be deleted.

---

## Quick Resume Commands

```bash
# 1. Install deps (fixes tsx not found)
cd /mnt/c/Users/sxtnl/Dev/smartout_v3
pnpm install

# 2. Start services natively (dev mode with hot reload)
pnpm --filter @smartout/stage-engine dev      # port 3060
pnpm --filter @smartout/shift-mcp dev          # port 3001
pnpm --filter @smartout/contract-service dev   # port 3100
cd services/scrapling && python main.py        # port 8000

# 3. Or start via Docker (all at once)
cd infra && docker compose up -d

# 4. Health check
curl http://localhost:3060/health   # stage-engine
curl http://localhost:3001/health   # shift-mcp
curl http://localhost:3100/health   # contract-service
curl http://localhost:8000/health   # scrapling
```
