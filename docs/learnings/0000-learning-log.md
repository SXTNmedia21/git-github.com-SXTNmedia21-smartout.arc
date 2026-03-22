---
title: Learning Log
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: hms
tags: [learnings]
---

# Learning Log — hms-phase-1

| #   | Date       | Learning                                                                               | Impact                          |
| --- | ---------- | -------------------------------------------------------------------------------------- | ------------------------------- |
| 1   | 2026-03-22 | Profile table uses display_name, not first_name/last_name                              | Fixed CompetenceMatrix query    |
| 2   | 2026-03-22 | Pre-existing help_request type error in use-help-requests.ts                           | Not from HMS, ignored           |
| 3   | 2026-03-22 | DashboardShell wraps children with p-6 md:p-8 — HMS layout should not add own padding  | Avoided double padding          |
| 4   | 2026-03-22 | deviation push trigger uses `id` not `profile_id` — pre-existing bug                   | Seed data needs trigger disable |
| 5   | 2026-03-22 | `supabase gen types` captures stderr warnings in stdout — use `2>/dev/null`            | Fixed corrupt types file        |
| 6   | 2026-03-22 | `npx turbo typecheck` stricter than `npx tsc --noEmit` — catches null issues           | Must run turbo, not just tsc    |
| 7   | 2026-03-22 | Telemetry emit event name must be literal, not dynamic string — TS discriminated union | Split into if/else branches     |
| 8   | 2026-03-22 | `supabase db reset` fails on 20260422300500 channel seed FK — blocks all E2E           | Pre-existing, needs fix         |
| 9   | 2026-03-22 | public schema has 169 tables — need mandatory schema placement brainstorm              | Added to CLAUDE.md rules        |

module: cross-cutting
module: unspecified
tags: [learnings]
---

# Learning Log — cascade-foundation

| #   | Date       | Learning                                                                                                                                                                    | Impact                                                           |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | 2026-03-22 | channel_seed_data migration FK error blocks all subsequent migrations in db reset — seed data must reference existing workspace IDs                                         | High — must fix before new migrations can validate via db reset  |
| 2   | 2026-03-22 | department_operating_hours unique constraint includes location_id + season_id (NULLS NOT DISTINCT) — simple upsert onConflict doesn't work, need select-then-insert pattern | Medium — affects bootstrap and any hours upsert                  |
| 3   | 2026-03-22 | engine_process PK column is `id` (TEXT), not `process_id` as some docs suggest                                                                                              | Low — naming inconsistency, just need to verify                  |
| 4   | 2026-03-22 | date_of_birth lives on user_identity, not profile — schedule hooks need join through profile.user_id                                                                        | Medium — affects employee rule context loading                   |
| 5   | 2026-03-22 | actual_start/actual_end columns don't exist on schedule_shift yet — completion emit only sets status for now                                                                | Medium — needs schema addition before actual cost snapshots work |
| 6   | 2026-03-22 | season_budget/day_factors events don't route to engine_event by default — must explicitly add destination in telemetry registry                                             | High — engine triggers won't fire without this                   |
| 7   | 2026-03-22 | workspace_budget upsert needs 6-column unique constraint (NULLS NOT DISTINCT) including nullable location_id, department_id, hour_slot                                      | Medium — affects demand propagation upsert pattern               |
# Learning Log — fix-invitation-flow
| # | Date | Learning | Impact |
|---|------|----------|--------|
