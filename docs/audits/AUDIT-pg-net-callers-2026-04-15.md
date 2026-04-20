---
title: Audit — pg_net callers across Supabase migrations and functions
status: done
updated: 2026-04-15
created: 2026-04-15
module: infrastructure
tags: [audit, pg_net, event-engine, notifications, shift-lifecycle, WS-A7]
---

# Audit — `pg_net` / `net.http_post` callers

> Scope: PLAN-secure-shift-lifecycle.md WS-A7. Enumerate every caller of `pg_net` / `net.http_post` in `supabase/migrations/` and `supabase/functions/` and classify as `[IN-EE]`, `[LEGACY-DOCUMENTED]`, or `[ORPHAN]`.

## Method

```
rg "pg_net|http_post|perform net\." supabase/migrations/ supabase/functions/
```

Migration files were inspected in-place to understand each caller's purpose, trigger surface, and whether its target Edge Function is still active. "IN-EE" means the caller is part of the Event Engine dispatch loop (e.g. handled by `engine-dispatch`). "LEGACY-DOCUMENTED" means it is not Event Engine routed but has a clearly documented purpose and is still in use. "ORPHAN" would mean a caller with no documented owner and no obvious live consumer.

## Summary

| Classification | Count |
|---|---|
| `[IN-EE]` | 0 |
| `[LEGACY-DOCUMENTED]` | 13 |
| `[ORPHAN]` | 0 |

No orphaned `pg_net` callers were found. All live callers are documented either in their own migration header, in `ADR-0088` (AI Operations Intelligence cron jobs), or in the push-notification migration lineage (`20260324230000` → `20260418120000` → `20260507100300`). No orphan migration or silent HTTP call was found outside of this catalogue.

## Inventory

### Notifications / outbox path

| File | Lines | Target Edge Function | Classification | Notes |
|---|---|---|---|---|
| `supabase/migrations/20260324220000_notification_table.sql` | 86, 108, 122 | `process-notifications`, `send-morning-digest` | `[LEGACY-DOCUMENTED]` | CRITICAL fast-path trigger + 30s pg_cron poll + 07:00 morning digest. Not Event Engine; runs against the notification outbox table. Explicit purpose documented in migration header. |
| `supabase/migrations/20260324230000_refactor_push_triggers.sql` | 3 | — (comment only; no live call) | `[LEGACY-DOCUMENTED]` | Header describes the refactor away from synchronous `pg_net` push triggers into the outbox pattern. No active `net.http_post` added by this migration. |
| `supabase/migrations/20260328225650_notification_outbox_auto_dispatch.sql` | 12 | `process-notifications` | `[LEGACY-DOCUMENTED]` | AFTER INSERT trigger on `notification_outbox` invoking `process-notifications` whenever `pg_cron` is unavailable (Supabase Local dev). Explicit dev-mode fallback; documented in header. Coexists with the critical-priority trigger from `20260324220000`. |

### Push-dispatch direct path (being phased out to Event Engine)

| File | Lines | Target Edge Function | Classification | Notes |
|---|---|---|---|---|
| `supabase/migrations/20260418120000_push_dispatch_triggers.sql` | 3, 4, 11, 50, 51, 63 | `push-dispatch` | `[LEGACY-DOCUMENTED]` | Defines `dispatch_push_notification()` used by several shift/task/chat/deviation/join-request triggers. Header explicitly notes "fire-and-forget, failures drop silently (acceptable for V1)". Migration `20260507100300` already migrated the `shift_published` path away; remaining consumers (`shift_updated`, `task_assigned`, `chat_message`, `deviation_reported`, `join_request`) are documented legacy with sunset work planned (tracked in plan WS-D4, `push-dispatch` sunset decision). |
| `supabase/migrations/20260507100300_migrate_push_to_engine_notify.sql` | 6, 39, 79, 119 | — (comments only) | `[LEGACY-DOCUMENTED]` | Comments only; actual runtime path for `shift_published` now goes through `engine_event` → `shift_published_notify_v1` process → `send_notification` step. No live `net.http_post` is added by this migration. |
| `supabase/migrations/20260406150100_guardian_signal_push_trigger.sql` | 28 | `push-dispatch` | `[LEGACY-DOCUMENTED]` | AFTER INSERT on guardian signals; same push-dispatch path as above. Documented in own migration; scope is guardian alerts to managers. Same sunset path applies when push-dispatch is retired. |

### AI Operations Intelligence cron (ADR-0088)

| File | Lines | Target Edge Function | Classification | Notes |
|---|---|---|---|---|
| `supabase/migrations/20260414230100_ops_day_brief_cron.sql` | 12 | `ops-day-brief` | `[LEGACY-DOCUMENTED]` | pg_cron 05:00 UTC daily; documented against ADR-0088 Phase 1. |
| `supabase/migrations/20260414231000_ops_predict_learn_cron.sql` | 20, 34 | `ops-predict`, `ops-learn` | `[LEGACY-DOCUMENTED]` | Weekly PREDICT and LEARN jobs; ADR-0088 Phase 3. Two `net.http_post` calls, one per job. |
| `supabase/migrations/20260414240000_ops_monitor_cron.sql` | 12 | `ops-monitor` | `[LEGACY-DOCUMENTED]` | pg_cron every 15 min; ADR-0088 Phase 2 MONITOR. |

### Session lifecycle cron

| File | Lines | Target Edge Function | Classification | Notes |
|---|---|---|---|---|
| `supabase/migrations/20260428100100_daily_session_replenish_cron.sql` | 12 | `session-replenish` (planning fill) | `[LEGACY-DOCUMENTED]` | Daily 02:00 UTC; fills 7-day planning window for active seasons. |
| `supabase/migrations/20260428100200_session_lifecycle_cron.sql` | 12 | `session-lifecycle` | `[LEGACY-DOCUMENTED]` | Every 15 min; `upcoming→active`, `active→pending_signoff`, `upcoming→missed`. |
| `supabase/migrations/20260428100300_session_hook_executor_cron.sql` | 13 | `session-hook-executor` | `[LEGACY-DOCUMENTED]` | Every 5 min; materializes procedure steps into `session_task` rows when hooks fire. |

### Edge Functions

| File | Matches | Classification | Notes |
|---|---|---|---|
| `supabase/functions/push-dispatch/index.ts` | comment on line 4 | n/a (documentation only) | Edge Function is the callee of several `pg_net` triggers. No `net.http_post` invocation of its own. Sunset tracked under WS-D4. |

### Tests (informational)

| File | Lines | Purpose |
|---|---|---|
| `supabase/tests/lifecycle-processes.sql` | 12, 168 | pgTAP asserts that `trg_push_shift_published` no longer calls `dispatch_push_notification` (i.e. no longer uses `pg_net`), confirming the `20260507100300` migration. |

## Findings

- Zero orphan callers. Every `net.http_post` is traceable to either (a) the notification outbox pipeline, (b) the push-dispatch lineage that is actively being retired, or (c) the ADR-0088 / session cron job set.
- The push-dispatch path is documented legacy with a pending sunset decision (WS-D4 in PLAN-secure-shift-lifecycle.md).
- None of these callers live inside `engine-dispatch` itself; `engine-dispatch` is reached via an `engine_event` insert path (no `pg_net` required).
- No caller inside shift-lifecycle code uses `pg_net` directly — shift-lifecycle events flow through `emit()` → `engine_event` → engine dispatcher, per ADR-0095.

## Action items

This audit does not migrate anything. Per plan scope for WS-A7: audit only, flag orphans only. None flagged. Sunset work for `push-dispatch` remains scheduled under WS-D4.
