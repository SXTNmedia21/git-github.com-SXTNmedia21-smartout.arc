---
title: "Worklog — infra-hardening"
status: done
updated: 2026-04-10
created: 2026-03-06
module: infra
tags: [docker, caddy, security, production, hardening]
---

# Worklog — infra-hardening

> Branch: `feat/infra-hardening` | Worktree: wt-4 | Started: 2026-03-06

## Status: Done

## Done

- [x] Task 1: Add USER node to stage-engine Dockerfile (non-root container)
- [x] Task 2: Create .dockerignore at monorepo root (build context reduction)
- [x] Task 3: Remove SUPABASE_URL localhost fallback from base compose (fail-fast)
- [x] Task 4: Add security headers to Caddyfile (HSTS, SAMEORIGIN, nosniff, Referrer-Policy, Permissions-Policy)
- [x] Task 5: Add server timeouts to Caddy (read_body, read_header, idle + streaming override)
- [x] Task 6: Remove pre-filled N8N_ENCRYPTION_KEY from .env.example
- [x] Task 7: Add Docker build verification to CI (4-service matrix)
- [x] Task 8: Add backup cron wrapper with 7-day rotation
- [x] Gap 1: Mount Caddyfile.dev in dev override
- [x] Gap 2: Remove stage-engine port from base compose
- [x] Gap 3: Remove scrapling port from base compose + prod
- [x] Gap 4: Pin n8n image to 2.10.4
- [x] Gap 5: Add Docker log rotation (json-file, 10m x 3) to prod

## Remaining

- None

## Decisions

| Date       | Decision                            | Reason                                                                        |
| ---------- | ----------------------------------- | ----------------------------------------------------------------------------- |
| 2026-04-10 | X-Frame-Options SAMEORIGIN not DENY | May need iframe embedding in future                                           |
| 2026-04-10 | HSTS without preload                | One-way commitment, not safe until all subdomains confirmed HTTPS             |
| 2026-04-10 | No global write timeout in Caddy    | Would kill SSE/streaming at 30s regardless of upstream transport settings     |
| 2026-04-10 | Prod ports bound to 127.0.0.1 only  | Health-check.sh needs host access, but services shouldn't be internet-exposed |
| 2026-04-10 | Pin n8n to 2.10.4                   | Prevent surprise breaking changes from :latest on deploy                      |

## Log

| Date       | Time  | Event                                                                  |
| ---------- | ----- | ---------------------------------------------------------------------- |
| 2026-03-06 | 16:43 | Feature started                                                        |
| 2026-04-10 | —     | Plan created (8 tasks)                                                 |
| 2026-04-10 | —     | Batch 1 complete: USER node, .dockerignore, SUPABASE_URL fail-fast     |
| 2026-04-10 | —     | Batch 2 complete: security headers, timeouts, N8N key fix              |
| 2026-04-10 | —     | Batch 2 review: removed global write timeout, dropped HSTS preload     |
| 2026-04-10 | —     | Batch 3 complete: CI docker builds, backup cron                        |
| 2026-04-10 | —     | Audit found 5 gaps, all fixed                                          |
| 2026-04-10 | —     | Typecheck 18/19 (1 pre-existing document-mode failure)                 |
| 2026-04-10 | —     | Breaking change analysis: fixed prod port bindings for health-check.sh |
| 2026-04-10 | —     | Feature complete, committed                                            |
