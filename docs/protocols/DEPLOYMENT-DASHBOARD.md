---
title: "Deployment Dashboard"
status: in_progress
updated: 2026-03-23
created: 2026-03-23
module: cross-cutting
tags: [deployment, ci, vercel, supabase, docker]
---

# Deployment Dashboard — 2026-03-23

## Current Run

| Field   | Value                               |
| ------- | ----------------------------------- |
| Branch  | `development`                       |
| Trigger | Test run of deploying skill         |
| Started | 2026-03-23                          |
| Status  | **All gates green — ready to push** |

## Agent Progress

| Agent       | Status  | Result                                                                           | Learnings                                                                       |
| ----------- | ------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| gate-runner | Done    | typecheck 24/24, lint 0 errors/356 warnings, build 10/10, prettier fixed 2 files | NEW: Next.js 16.1.6 deprecates middleware->proxy; Sentry config needs migration |
| env-checker | Done    | 67 op:// refs confirmed, all validators CI-safe, 0 mismatches                    | CONFIRMED: 67 op://, all `.optional()`, env layer separation intentional        |
| git-checker | Done    | Clean tree, 188 migrations, 34 EFs, no config traps, no Docker rebuild needed    | CONFIRMED: counts match skill, verify_jwt coverage complete                     |
| ci-monitor  | Pending | —                                                                                | —                                                                               |

## Pipeline Health

| Gate            | Result            | Notes                                   |
| --------------- | ----------------- | --------------------------------------- |
| Git state       | Clean             | Doc commits only                        |
| Env consistency | Pass              | All 3 layers aligned                    |
| Supabase config | Pass              | No traps detected                       |
| Docker rebuild  | Not needed        | No service/infra changes                |
| Typecheck       | Pass (24/24)      | 100% turbo cached                       |
| Lint            | Pass (0 errors)   | 356 warnings (React Compiler, TanStack) |
| Build           | Pass (10/10)      | web 75s, landing 21s                    |
| Prettier        | Pass (auto-fixed) | 2 files fixed                           |

## Counts (verified this run)

| Resource                     | Count | Verified by |
| ---------------------------- | ----- | ----------- |
| Migrations                   | 188   | git-checker |
| Edge Functions               | 34    | git-checker |
| op:// refs in .env.template  | 67    | env-checker |
| env.ts server vars           | 23    | env-checker |
| Docker compose vars          | 23    | env-checker |
| verify_jwt=false entries     | 20    | git-checker |
| Turbo packages               | 24    | gate-runner |
| Lint warnings (pre-existing) | 356   | gate-runner |

## Known Issues (non-blocking)

| Issue                                            | Severity | Action needed                                                                          |
| ------------------------------------------------ | -------- | -------------------------------------------------------------------------------------- |
| Next.js 16.1.6 middleware deprecation            | Low      | Future migration to proxy convention                                                   |
| Sentry config needs instrumentation migration    | Low      | 4 config files to update                                                               |
| Stage Engine crash-loops locally without op run  | Medium   | Start Docker: `cd infra && op run --env-file=../.env.template -- docker compose up -d` |
| Contract Service + Shift MCP not running locally | Medium   | Same op run fix                                                                        |
