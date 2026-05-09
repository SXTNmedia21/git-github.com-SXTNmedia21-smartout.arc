---
title: "Infrastructure Consolidation"
id: ADR-0039
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-03-01
---

# ADR-0039: Infrastructure Consolidation

## Context and Problem Statement

Smartout has 4 backend services (stage-engine, contract-service, shift-mcp, scrapling) that evolved independently. Stage-engine had its own docker-compose and Caddyfile; the other 3 had no Docker setup at all. Edge Functions calling scrapling used inconsistent URL patterns — some baked `/extract` into the fallback, others didn't. There was no unified way to start all services locally or deploy them together.

## Decision Drivers

- Single `docker compose up` must start all services for local development
- Production deploy must use the same compose base with a prod overlay
- All service URLs must come from environment variables, not hardcoded
- Scrapling must remain internal-only (no external Caddy route, no auth)
- Security: no secrets in compose files, non-root containers, HTTPS on external services

## Considered Options

1. **Unified `infra/` directory with three-file compose** — single location for all orchestration
2. **Per-service compose files** — each service manages its own Docker config
3. **Move to Kubernetes** — full container orchestration

## Decision Outcome

Chosen option: **"Unified `infra/` directory with three-file compose"**, because it provides a single source of truth for all service orchestration while keeping the three-file strategy from ADR-0035 (base + dev override + prod overlay).

### What changed

- Created `infra/` directory with `docker-compose.yml`, `docker-compose.override.yml`, `docker-compose.prod.yml`
- Created `Caddyfile` (production) and `Caddyfile.dev` (localhost ports 3070-3073)
- Created Scrapling Dockerfile (multi-stage Python 3.12)
- Upgraded contract-service Dockerfile from npm single-stage to pnpm multi-stage
- Fixed 3 Edge Functions to use consistent `scraplingBase` URL pattern
- Added shift-mcp to platform health dashboard
- Removed old `services/stage-engine/docker-compose.yml` and `Caddyfile`

## Rules & Consequences

- **Good, because** `docker compose up` in `infra/` starts all 5 services (caddy + 4 backends)
- **Good, because** all service URLs are env-var driven with sensible fallbacks
- **Good, because** scrapling is network-isolated (internal Docker network, no Caddy route)
- **Good, because** production overlay adds restart policies and resource limits
- **Bad, because** all services must have working Dockerfiles before the stack can start
- **Bad, because** builds for Node services use monorepo root as context (slower than single-service builds)
- **Agent Impact:** When running services locally, use `cd infra && docker compose up --build`. Never create per-service compose files — they're superseded. Edge Functions calling scrapling must use `SCRAPLING_SERVICE_URL` as base URL and append the path in the fetch call.

---
