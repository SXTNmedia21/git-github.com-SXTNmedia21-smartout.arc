---
title: Learning Log
status: in_progress
updated: 2026-03-10
created: 2026-03-08
module: core
tags: [learnings]
---

# Learning Log — csv-mapping

status: done
updated: 2026-03-08
created: 2026-03-08
module: core
tags: [learnings, journey-engine]

---

status: done
updated: 2026-03-08
created: 2026-03-08
module: core
tags: [learnings, journey-engine]

---

# Learning Log — journey-engine

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

_No learnings logged._

---

## signup

_No learnings logged._
| # | Date | Learning | Impact |
| --- | ---- | -------- | ------ |

---

# Learning Log — adminpage-speed

| #   | Date       | Learning                                                                                                                                 | Impact                                                    |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | 2026-03-10 | `unstable_cache` with `revalidate` TTL is the simplest server-side caching for Next.js App Router — no Redis needed for admin pages      | All 12 admin pages cached with zero infrastructure change |
| 2   | 2026-03-10 | `as never` casts on Supabase query results are caused by stale `database.types.ts` — regenerating types eliminates all of them           | Removed 28 unsafe casts across 14 files                   |
| 3   | 2026-03-10 | Guardian hooks with `refetchInterval` + `refetchOnWindowFocus: true` (default) cause double-fetching on every tab switch                 | Unnecessary network traffic on admin pages with polling   |
| 4   | 2026-03-10 | Notes stored in audit log (immutable) can't be edited/deleted — separating mutable notes from immutable audit trail requires a new table | Created workspace_note table to decouple the two concerns |
