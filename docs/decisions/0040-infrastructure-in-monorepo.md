---
title: "Infrastructure stays in monorepo"
id: ADR_0040
status: accepted
layer: decision
created: 2026-03-01
updated: 2026-03-01
---

# ADR-0040: Infrastructure stays in monorepo

## Context and Problem Statement

ADR-0035 decided that infrastructure orchestration (Docker Compose, Caddy, scripts) should live in a separate `smartout-infra` repository. A partial extraction was done -- `smartout-infra` contained stage-engine + n8n + Caddy, while the monorepo's `infra/` directory contained all 4 services. This created split-brain: two sources of truth for Docker configuration, stale service copies, and divergent compose files.

## Decision Drivers

- Solo developer -- multi-repo overhead is pure cost with no team coordination benefit
- Shared types and packages (`@smartout/types`, `@smartout/supabase`) require monorepo imports
- Features spanning frontend + services require coordinated changes -- one PR vs two
- Vercel only deploys `apps/web` and `apps/landing` -- services are already ignored
- The Droplet deployment is simple: clone monorepo, run `docker compose` from `infra/`

## Considered Options

1. **Keep separate `smartout-infra` repo** -- finish the extraction started by ADR-0035
2. **Consolidate everything into monorepo `infra/`** -- reverse the extraction decision
3. **Hybrid: infra repo references monorepo services** -- git submodule or image registry

## Decision Outcome

Chosen option: **"Consolidate everything into monorepo `infra/`"**, because the extraction created more problems than it solved. A solo developer maintaining two repos for the same system is unnecessary overhead.

**Supersedes:** ADR-0035 (Docker Network Infrastructure -- separate repo decision)
**Extends:** ADR-0039 (Infrastructure Consolidation -- unified compose)

## Rules & Consequences

- **Good, because** single source of truth for all infrastructure config
- **Good, because** one PR for changes that span frontend + services + infra
- **Good, because** shared packages just work without cross-repo sync
- **Bad, because** monorepo clone is larger on the Droplet (includes apps/ and packages/)
- **Agent Impact:** All Docker and Caddy configuration lives in `infra/`. Deploy scripts in `infra/scripts/`. Never create a separate infra repository. When adding a new service: Dockerfile in `services/`, compose entry in `infra/docker-compose.yml`, Caddy route if external.

## Service Map

| Service          | Port   | Subdomain                | Auth              | Status       |
| ---------------- | ------ | ------------------------ | ----------------- | ------------ |
| Caddy            | 80/443 | \*.smartout.ai           | HTTPS termination | Active       |
| Stage Engine     | 3000   | engine.smartout.ai       | Dual-auth         | Active       |
| Shift MCP        | 3001   | schedule-mcp.smartout.ai | Dual-auth         | Active       |
| Contract Service | 3100   | contract.smartout.ai     | Service key       | Active       |
| Scrapling        | 8000   | None (internal)          | None              | Active       |
| n8n              | 5678   | n8n.smartout.ai          | Basic auth        | Not deployed |
