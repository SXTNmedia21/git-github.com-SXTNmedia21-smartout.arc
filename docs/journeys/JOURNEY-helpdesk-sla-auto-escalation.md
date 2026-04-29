---
title: "Journey — Helpdesk SLA Auto-Escalation"
status: verified
feature: helpdesk-sla-timeout
updated: 2026-04-29
created: 2026-04-28
module: Helpdesk
tags: [journey, helpdesk, sla, system, observer]
---

# Journey — Helpdesk SLA Auto-Escalation (J1)

System-driven journey. No human actor at trigger time.

## Precondition

- Workspace has `engine_authority_config` row for capability `helpdesk_query` with `observer_escalation_hours=72` and a non-null observer `min_role` (default `manager`).
- A help desk ticket has been opened (via `openTicket` or `openPrivateTicket`). `engine_state` row exists with `process_id='helpdesk_query_lifecycle'`, `status` in (`waiting`, `active`).
- An `engine_delayed_trigger` row was spawned at ticket-open with `fire_at = ticket_started_at + 72h`, `status='pending'`, and `context.engine_state_id` populated.
- `fire-delayed-triggers` Edge Function is running on its cron schedule.

## Happy Path

1. Time advances past `fire_at`. → System: cron invokes `fire-delayed-triggers`.
2. `fire-delayed-triggers` selects pending rows where `fire_at <= NOW()`. → System: marks the row `status='fired'` in same transaction as emit.
3. Function emits event `helpdesk.query.sla_breached` with payload `{ entity_type: 'channel', entity_id: desk_channel_id, properties: { engine_state_id, workspace_id } }`. → System: event lands in `engine_event`.
4. `engine-dispatch` reacts to the event. → System: matches on `helpdesk_query_lifecycle` reaction step.
5. Lifecycle step `assign_task` executes. → System: writes `engine_state.context.sla_breached_at = NOW()` and emits a chat notification to the workspace observer (resolved via `engine_authority_config.min_role`).
6. Notification lands in `activity_trail`. → System: observer's `MinKoSection` reflects the new assignment on next poll.

## Postcondition

- `engine_state.context.sla_breached_at` is set (ISO-8601).
- `engine_delayed_trigger.status='fired'` for the linked row.
- One `helpdesk.query.sla_breached` event recorded in `engine_event`.
- One notification entry in `activity_trail` to the observer.
- UI: rep's MinKoSection desk row shows `data-testid="overdue-badge"` (Pill, calm `text-muted-foreground`).

## Error Paths

**E1. fire-delayed-triggers crashes after emit, before status update.**
- Effect: trigger remains `status='pending'`.
- Recovery: next poll re-selects the row. Lifecycle reaction is idempotent — `assign_task` skips if `context.sla_breached_at IS NOT NULL`. No double-notification.

**E2. Authority deleted between spawn and fire.**
- Effect: lifecycle reaction cannot resolve observer.
- Recovery: lifecycle logs to `activity_trail` with `severity='warn'` and skips notification. `context.sla_breached_at` is still set so UI badge appears. Manual triage required.

**E3. Workspace deleted between spawn and fire.**
- Effect: trigger fires for a non-existent workspace.
- Recovery: dispatcher reaction no-ops (workspace_id lookup returns null). Trigger marked `status='fired'`. No notification. Document as known orphan.

**E4. Resolve event fires concurrently with breach.**
- Effect: race condition where breach event lands AFTER resolve.
- Recovery: resolve step marks linked trigger `status='cancelled'` BEFORE emitting resolve event. `fire-delayed-triggers` ignores cancelled rows. If breach already in-flight, lifecycle reaction sees `engine_state.status='complete'` and no-ops.

**E5. Clock skew between PG and Edge Function.**
- Effect: trigger fires earlier or later than expected by ±seconds.
- Recovery: tolerated. PG clock is authoritative via `WHERE fire_at <= NOW()`. Skew within seconds is acceptable for 72h windows.
