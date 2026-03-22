---
title: Learning Log
status: in_progress
updated: 2026-03-22
created: 2026-03-22
module: cross-cutting
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
