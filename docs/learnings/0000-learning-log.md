---
title: Learning Log
status: in_progress
updated: 2026-03-10
created: 2026-03-10
module: global
tags: [learnings]
---

# Learning Log

## csv-mapping

| #   | Date       | Learning                                                                                                                                                                       | Impact                                                                         |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 1   | 2026-03-08 | executeStep() condition check runs BEFORE action_type switch — wait_for_event steps with match conditions get skipped because state.context doesn't contain the match keys yet | Critical bug: all 8 onboarding wait steps skipped, process completed instantly |
| 2   | 2026-03-08 | engine_state.entity_id set from trigger payload — if subsequent events don't carry entity_id, resumption fails because entityMatch is false                                    | Blocked workspace_setup: wizard events have no entity_id                       |
| 3   | 2026-03-08 | Docker edge runtime (supabase_edge_runtime_smartout.ai) caches Edge Function code — must `docker restart` after modifying index.ts                                             | Stale code served during testing, misleading results                           |
| 4   | 2026-03-08 | Supabase CLI `gen types` prepends "Connecting to db 5432" line to output — must strip before committing database.types.ts                                                      | Breaks TypeScript compilation                                                  |
| 5   | 2026-03-08 | Record<string,unknown> from compile output doesn't match Supabase Json type — needs `as unknown as Json` double cast                                                           | Type error in compile server action                                            |
| 6   | 2026-03-08 | WSL2 Chromium missing libnspr4.so — system deps not installed. API-driven E2E tests bypass this entirely                                                                       | Rewrote tests to use fetch instead of browser                                  |
| 7   | 2026-03-08 | Worktrees don't get .env.local (gitignored) — must symlink from main repo                                                                                                      | Web dev server crashes with "Invalid environment variables"                    |

## scrapling-extract

| #   | Date | Learning | Impact |
| --- | ---- | -------- | ------ |
