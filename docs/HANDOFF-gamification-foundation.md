---
title: "Handoff — gamification-foundation"
feature: gamification-foundation
branch: feat/gamification-foundation
closed: 2026-03-28
module: operations
---

# Handoff — gamification-foundation

## Summary

Built the WS-1 Season & Operations Loop backbone: season activation (PLAY button), automated department session creation, session lifecycle transitions, session hook firing, and daily close wiring. This completes the end-to-end operational loop where a season activates, sessions auto-create for a 7-day window, hooks fire at configured times to create tasks, and the day closes via the existing daily_close process.

## What Was Done

- [x] Task 1: Season PLAY — activateSeason + archiveSeason mutations with readiness validation, telemetry events, UI controls
- [x] Task 2: Season activation trigger — Postgres trigger + engine_event + extended upsert_session handler for season context
- [x] Task 3: Daily session replenishment — Edge Function + pg_cron (02:00 UTC daily)
- [x] Task 4: Session lifecycle auto-transitions — Edge Function + pg_cron (every 15 min)
- [x] Task 5: Session hook executor — Edge Function + pg_cron (every 5 min), materializes procedure steps into tasks
- [x] Task 6: Wire daily close — Postgres trigger on pending_signoff connects to existing daily_close process
- [x] Task 7: Operations dashboard verified — all queries use real data, compatible with session lifecycle

## Decisions Made

| Decision                                    | Reason                                                    | Impact                                                |
| ------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| Extend upsert_session for season activation | Reuses proven handler logic, avoids handler proliferation | engine-dispatch stays lean                            |
| 7-day rolling planning window               | Balances schedule visibility with operational flexibility | Sessions created incrementally, not for entire season |
| Three separate cron Edge Functions          | Independent scaling, debugging, failure isolation         | Can adjust frequency per function                     |
| Auto-archive previous active season         | Enforces single-active constraint at app level            | No DB constraint needed, simpler migration            |
| Postgres triggers emit engine_events        | Consistent with existing shift.published pattern          | Keeps event-driven architecture unified               |

## Learnings

| Learning                                                                 | Context                                                                                                             |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Plan had wrong FK for day/hour factor validation                         | Plan used `season_id` but tables use `season_budget_id` — always verify against actual schema, not plan assumptions |
| department_operating_hours uses ISO weekday (0=Mon)                      | JS getDay() returns 0=Sun — need `(getDay() + 6) % 7` conversion                                                    |
| Typecheck has 138 pre-existing errors from @smartout/ai, @smartout/types | All from missing package builds, not code errors — known tech debt                                                  |
| pg_cron uses `net.http_post` with `current_setting` for secrets          | Pattern established in notification system, reused consistently                                                     |

## Known Issues / Debt

- 138 pre-existing type errors (missing @smartout/ai, @smartout/types, @smartout/agent-sdk declarations)
- `CHART_HOURS` in operations dashboard is hardcoded 09:00-22:00 — should read from operating_hours
- `FALLBACK_HOURLY_RATE_NOK = 200` in operations hook — should use shift_cost_snapshot when available
- No E2E tests for the operational loop (recommended, not blocking)
- Season activation does not validate date overlap with other seasons

## Next Steps

- WS-2: Training & Agent Intelligence (Tasks 8-14) — auto-assign protocols, Botsson training/knowledge capabilities
- WS-3: Gamification Foundation (Tasks 15-17) — points, leaderboards, challenges
- Run migrations against local Supabase to test full loop end-to-end
- Set `WATCHDOG_CRON_SECRET` as `app.watchdog_cron_secret` in Supabase DB config for pg_cron auth
