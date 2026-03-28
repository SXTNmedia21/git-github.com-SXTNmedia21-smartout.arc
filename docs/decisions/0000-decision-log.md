---
title: Decision Log
status: in_progress
updated: 2026-03-28
created: 2026-03-28
module: gamification
tags: [decisions]
---

# Decision Log — gamification-foundation

| #   | Date       | Decision                                                                                                                                                               | Status   |
| --- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | 2026-03-28 | Extend existing upsert_session handler for season activation instead of creating new action handler — reuses proven logic, avoids handler proliferation                | accepted |
| 2   | 2026-03-28 | 7-day rolling planning window for session creation — balances schedule visibility with operational flexibility                                                         | accepted |
| 3   | 2026-03-28 | Three separate cron Edge Functions (replenish 02:00, lifecycle 15min, hooks 5min) instead of one monolithic function — independent scaling and debugging               | accepted |
| 4   | 2026-03-28 | Season activation auto-archives previous active season — enforces single-active-season constraint at application level rather than DB constraint                       | accepted |
| 5   | 2026-03-28 | Postgres triggers on season.status and department_session.status emit engine_events — keeps event-driven architecture consistent with existing shift.published pattern | accepted |
| #   | Date       | Decision                                                                                                                                                               | Status   |
| --- | ----       | --------                                                                                                                                                               | ------   |
| 1   | 2026-03-28 | ADR-0065: Hospitality Operations Cockpit V1 Read/Action Contract                                                                                                       | accepted |
| 2   | 2026-03-28 | ADR-0066: Temporal Shift Lock Architecture                                                                                                                             | accepted |
| 3   | 2026-03-28 | ADR-0067: Smart Cover via Event Engine                                                                                                                                 | accepted |
