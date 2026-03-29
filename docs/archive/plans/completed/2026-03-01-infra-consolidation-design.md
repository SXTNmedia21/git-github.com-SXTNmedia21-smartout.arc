---
title: "Infrastructure Consolidation — Monorepo"
status: completed
layer: plan
created: 2026-03-01
updated: 2026-03-01
tags: [infrastructure, docker, caddy, monorepo]
---

# Infrastructure Consolidation Design

## Problem

ADR-0035 decided infrastructure should live in a separate `smartout-infra` repo. A partial extraction happened — `smartout-infra` had stage-engine + n8n + Caddy, while the monorepo `infra/` had all 4 services. This created split-brain: two sources of truth, stale copies, divergent compose files.

## Decision

Consolidate everything into the monorepo `infra/` directory. Delete `smartout-infra` as a separate project. Documented in ADR-0040 (supersedes ADR-0035).

## Why

- Solo developer — multi-repo overhead is pure cost
- Shared types/packages require monorepo imports
- One PR for changes spanning frontend + services
- Vercel only deploys apps/ — services are already ignored
- Droplet deployment is simple: clone monorepo, run compose from infra/

## What Changed

| File                                                | Change                                            |
| --------------------------------------------------- | ------------------------------------------------- |
| `infra/docker-compose.yml`                          | Added n8n service + volume, updated ADR reference |
| `infra/Caddyfile`                                   | Added n8n.smartout.ai route                       |
| `infra/Caddyfile.dev`                               | Added n8n localhost route (port 3074)             |
| `infra/docker-compose.override.yml`                 | Added n8n dev overrides                           |
| `infra/docker-compose.prod.yml`                     | Added n8n prod resource limits                    |
| `infra/.env.example`                                | Added n8n environment variables                   |
| `infra/scripts/setup.sh`                            | New — first-time Docker setup                     |
| `infra/scripts/deploy.sh`                           | New — pull, rebuild, restart                      |
| `infra/scripts/health-check.sh`                     | New — ping all 6 services                         |
| `infra/scripts/backup.sh`                           | New — backup n8n data + Caddy certs               |
| `infra/README.md`                                   | Updated for all 6 services + scripts              |
| `docs/decisions/0040-infrastructure-in-monorepo.md` | New ADR                                           |
| `docs/decisions/0000-decision-log.md`               | ADR-0035 superseded, ADR-0040 added               |

## Service Map (Final)

| Service          | Port   | Subdomain                | Status       |
| ---------------- | ------ | ------------------------ | ------------ |
| Caddy            | 80/443 | \*.smartout.ai           | Active       |
| Stage Engine     | 3000   | engine.smartout.ai       | Active       |
| Shift MCP        | 3001   | schedule-mcp.smartout.ai | Active       |
| Contract Service | 3100   | contract.smartout.ai     | Active       |
| Scrapling        | 8000   | None (internal)          | Active       |
| n8n              | 5678   | n8n.smartout.ai          | Not deployed |

## Remaining Manual Step

Delete the `/Dev/smartout-infra/` directory once confirmed nothing unique remains. The `.env` and `.env.local` files there contain live secrets — do NOT copy them; reference values in 1Password instead.
