---
title: "Docker Network Infrastructure"
id: ADR-0035
status: superseded
layer: decision
created: 2026-03-01
updated: 2026-03-01
---

# ADR-0035: Docker Network Infrastructure

## Context and Problem Statement

Smartout has multiple microservices (stage-engine, n8n, future MCP servers, AI agents) that currently run independently without shared networking or unified orchestration. As the service count grows, we need a reproducible way to manage inter-service communication, reverse proxying, and environment parity between local development and production.

## Decision Drivers

- Multiple services need to communicate internally without exposing ports publicly
- Each external service needs its own subdomain with automatic HTTPS
- Local development and production must use the same orchestration approach
- Adding new services should follow a repeatable, documented process
- Infrastructure concerns must stay separate from application code in the monorepo

## Considered Options

1. **Separate `smartout-infra` repo with Docker Compose + Caddy** — dedicated repo for all infrastructure orchestration
2. **Docker Compose inside monorepo** — keep compose files alongside app code
3. **Kubernetes** — full container orchestration platform
4. **Traefik instead of Caddy** — alternative reverse proxy
5. **Single compose file with profiles** — one file with `--profile` flags for dev/prod

## Decision Outcome

Chosen option: **"Separate `smartout-infra` repo with Docker Compose + Caddy"**, because it cleanly separates infrastructure from application code, supports services from multiple repos, and keeps the orchestration simple enough for a small team while remaining production-ready.

### Three-file compose strategy

- `docker-compose.yml` — base service definitions, shared network, health checks
- `docker-compose.override.yml` — dev overrides (volume mounts, debug ports, hot reload)
- `docker-compose.prod.yml` — production overlay (restart policies, resource limits, production env)

### Why not the alternatives

- **Docker Compose inside monorepo** — rejected because services may come from different repos (e.g., n8n is external, stage-engine has its own build context). Infrastructure orchestration is a cross-repo concern.
- **Kubernetes** — rejected as overkill for current scale (3-5 services on a single Droplet). Adds significant operational complexity without proportional benefit.
- **Traefik instead of Caddy** — rejected because Caddy has simpler configuration syntax and automatic HTTPS out of the box with fewer moving parts.
- **Single compose file with profiles** — rejected because the three-file strategy is clearer and avoids `--profile` flag confusion. Docker Compose natively merges override files.

## Rules & Consequences

- **Good, because** all services share a Docker bridge network for internal communication without exposing ports
- **Good, because** Caddy handles HTTPS automatically — no manual certificate management
- **Good, because** adding a new service follows a documented 5-step process
- **Good, because** local dev and production use the same compose base, reducing environment drift
- **Bad, because** all services must have standalone Dockerfiles (no relying on host-installed runtimes)
- **Bad, because** DNS A records must be created per subdomain for each externally-facing service
- **Agent Impact:** When adding a new microservice, create its Dockerfile in `smartout-infra/services/`, add the compose definition, and add a Caddy route if it needs external access. Do not add Docker orchestration to the monorepo.

---
