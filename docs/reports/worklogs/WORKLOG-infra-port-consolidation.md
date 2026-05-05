---
title: "Worklog — infra-port-consolidation"
status: in_progress
updated: 2026-03-29
created: 2026-03-29
module: infra
tags: [ports, docker, env-vars, secrets]
---

# Worklog — infra-port-consolidation

> Branch: `feat/infra-port-consolidation` | Worktree: wt-2 | Started: 2026-03-29

## Status: 🟡 In Progress

## Done

- [x] Phase 1a: Service config defaults (3 files → 5010/5011/5012)
- [x] Phase 1b: Dockerfile EXPOSE (3 files)
- [x] Phase 1c: docker-compose.yml PORT + healthcheck (3 services)
- [x] Phase 1d: docker-compose.override.yml (port mappings + ENGINE_URL)
- [x] Phase 1e: Caddyfile (prod) reverse_proxy upstreams
- [x] Phase 1f: Caddyfile.dev reverse_proxy upstreams
- [x] Phase 1g: health-check.sh ports
- [x] Phase 1h: App code fallbacks (route.ts, useGuardianSocket, useJourneySocket)
- [x] Phase 1i: Test files (run-evals, agent-chat.e2e, e2e)
- [x] Phase 2a: .env.example — fix Supabase port, service URLs, add missing vars
- [x] Phase 2b: .env.template — full rewrite with op:// refs, fixed typos
- [x] Phase 2c: infra/.env.example — new file with Docker Compose vars
- [x] Phase 2d: setup.sh — verified, no changes needed
- [x] Phase 5: Docs updated (infra/README, ENV_VARS, SERVICES_ARCHITECTURE)
- [x] Phase 6: ADR-0050 — Port standardization + Vault secrets strategy
- [x] Typecheck: 18/18 passes

## Remaining

- [ ] Phase 3: Docker build verification (needs Docker running)
- [ ] Phase 4: Stack verification (docker compose up + health-check.sh)

## Decisions

| Date       | Decision                            | Reason                                                |
| ---------- | ----------------------------------- | ----------------------------------------------------- |
| 2026-03-29 | ADR-0050: 5000-series port standard | Eliminate 6 conflicting port numbers for Stage Engine |
| 2026-03-29 | Vault as production secrets SSOT    | Single SQL query for rotation, no restarts needed     |

## Log

| Date       | Time | Event                                         |
| ---------- | ---- | --------------------------------------------- |
| 2026-03-29 | —    | Feature started                               |
| 2026-03-29 | —    | Phase 1 complete: all port changes (25 files) |
| 2026-03-29 | —    | Phase 2 complete: env var consolidation       |
| 2026-03-29 | —    | Phase 5+6 complete: docs + ADR-0050           |
| 2026-03-29 | —    | Typecheck 18/18 clean                         |
