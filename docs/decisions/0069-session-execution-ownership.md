---
title: "Session Execution Ownership: Edge Functions + Engine Side-Effects"
id: ADR_0069
status: accepted
layer: decision
created: 2026-03-28
updated: 2026-03-28
---

# ADR-0069: Session Execution Ownership — Edge Functions + Engine Side-Effects

## Context and Problem Statement

The HMS/Drift session system has two parallel execution paths for session lifecycle and hook management:

1. **Cron Edge Functions** (`session-lifecycle`, `session-hook-executor`) — currently active, handle all status transitions and task materialization directly via DB writes.
2. **Engine Processes** (`department_session_lifecycle`, `session_hook_dispatcher`) — seeded in migrations, designed for notifications + escalation, but never invoked because the Edge Functions don't emit events.

This dual-path architecture creates split-brain risk: neither path knows about the other. The Edge Functions do the work silently (no telemetry, no engine events). The Engine processes are dead infrastructure. Council review (2026-03-28) identified this as the single most critical architectural gap blocking production.

## Decision Drivers

- Edge Functions are battle-tested cron executors that already work correctly for state transitions
- Engine processes have richer workflow capabilities (notifications, escalation timers, wait-for-event)
- CLAUDE.md mandates: "No mutation without emit" — both Edge Functions currently violate this
- Cascade model requires single canonical pipeline per dimension (D6 Production)
- Notification delivery to employees requires the engine's `send_notification` action handler
- Dual write paths risk duplicate task creation if both are activated simultaneously

## Considered Options

1. **Option A: Engine-only** — Remove Edge Functions, make everything event-driven through the engine. Higher architectural consistency but bigger change and less proven.
2. **Option B: Edge Function-only** — Remove engine processes, add notification logic directly to Edge Functions. Simpler but loses the engine's escalation/timeout capabilities.
3. **Option C: Hybrid** — Edge Functions own execution (state transitions + task materialization). Engine owns side-effects only (notifications, escalation, audit). Edge Functions emit events that trigger engine processes, but engine processes never duplicate the execution work.

## Decision Outcome

Chosen option: **"Option C — Hybrid"**, because it leverages the proven Edge Function execution model while enabling the engine's superior side-effect handling (notifications, escalation, timeouts) without risking duplicate writes.

### Ownership Contract

| Concern                                                            | Owner                                    | How                                                                  |
| ------------------------------------------------------------------ | ---------------------------------------- | -------------------------------------------------------------------- |
| Session state transitions (upcoming→active→pending_signoff→missed) | `session-lifecycle` Edge Function        | Direct DB update + emit event                                        |
| Hook fire time calculation + task materialization                  | `session-hook-executor` Edge Function    | Direct DB insert + emit event                                        |
| Employee notifications on task creation                            | `session_hook_dispatcher` Engine Process | Listens for `session.hook_fired`, runs `send_notification` step only |
| Escalation on overdue tasks                                        | `session_hook_dispatcher` Engine Process | `wait_for_event` step with timeout                                   |
| Daily close orchestration                                          | `daily_close` Engine Process             | Listens for `department_session.pending_signoff`                     |

### Migration Steps

1. Add `emit()` calls to `session-lifecycle` Edge Function for: `session opened`, `session pending_signoff`, `session missed`
2. Add `emit()` call to `session-hook-executor` for: `session hook_fired` after each successful task batch insert
3. Remove `create_session_task` and `upsert_session` steps from engine processes (they now only handle side-effects)
4. Keep `send_notification` and `wait_for_event` steps in engine processes

## Rules & Consequences

- **Good, because** Edge Functions continue to be the proven execution path — no behavioral change for working functionality
- **Good, because** Engine processes gain visibility into session state and can handle notifications/escalation
- **Good, because** Single ownership per concern eliminates duplicate write risk
- **Bad, because** Two systems must be kept in sync (Edge Function emits what Engine expects)
- **Agent Impact:** All Edge Functions that mutate D6 tables must emit corresponding events. Engine processes must never duplicate execution work — they are side-effect-only consumers.

---

> Registered in `docs/decisions/0000-decision-log.md`.
