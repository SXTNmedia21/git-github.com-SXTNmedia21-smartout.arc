---
title: Journey — Day Line Item Push Notification
status: accepted
created: 2026-05-18
updated: 2026-05-18
module: daytimeline
tags: [journey, day-line, push, notifications, engine-dispatch, shift-session, idempotency, adr-0367, d6]
---

# Journey: Day Line Item Push Notification

> Captures the 1-minute engine-dispatch tick path from `dispatchDayLinePush` through the shift_session fan-out and the idempotency gate on `engine_event`, to the `day_line_item.notified` telemetry emit. This is Option A (engine-side fan-out) per ADR-0367 Rule 4. Option B (device-side topic subscribe API) is DEFERRED.
>
> Relevant ADRs: ADR-0367 (Rule 4, Rule 10), ADR-0334 (ephemeral presence precedent for push topology).

---

## Journey: Engine-Dispatch Sends Push Notification for a Scheduled Day Line Item

**Precondition:**
- `engine-dispatch` cron is running (1-minute tick, existing infrastructure).
- A `session_task` row exists with:
  - `day_line_id IS NOT NULL` (area-anchored item)
  - `scheduled_at` within the now-window `[now()-60s, now()+60s)`
  - `status = 'pending'`
- At least one `shift_session` row exists in `clocked_in` status for the area linked to this `session_task.day_line_id`.
- At least one clocked-in employee has a valid `expo_push_token`.
- No prior `engine_event` row with `idempotency_key = '<session_task_id>:<shift_session_id>'` for this pair (i.e. not yet sent).

**Happy path:**

1. Engine-dispatch 1-minute cron tick fires.
   → `dispatchDayLinePush` function is invoked.

2. Query phase — `dispatchDayLinePush` selects candidates:
   ```
   SELECT st.id AS task_id, st.day_line_id, st.scheduled_at, st.title,
          ss.shift_session_id, ss.employee_id
   FROM session_task st
   JOIN shift_session_day_line ssdl ON ssdl.day_line_id = st.day_line_id
   JOIN shift_session ss ON ss.shift_session_id = ssdl.shift_session_id
   WHERE st.scheduled_at BETWEEN now() - interval '60 seconds' AND now() + interval '60 seconds'
     AND st.day_line_id IS NOT NULL
     AND st.status = 'pending'
     AND ss.status = 'clocked_in'
   ```
   → Result: a list of `(task_id, shift_session_id)` pairs — one row per (task × employee-in-area).

3. For each `(task_id, shift_session_id)` pair:

   a. **Idempotency check:**
      → Construct `idempotency_key = '<task_id>:<shift_session_id>'` (composite TEXT).
      → Attempt to INSERT into `engine_event`:
        ```
        INSERT INTO engine_event (event_type, payload, workspace_id, idempotency_key, fired_at)
        VALUES ('day_line_item.notified', {...}, workspace_id, idempotency_key, now())
        ON CONFLICT (idempotency_key) DO NOTHING
        ```
      → If CONFLICT (23505 — idempotency_key already exists): skip this pair entirely. No double-send.
      → If INSERT succeeds: proceed to push send.

   b. **Push lookup:**
      → Fetch `expo_push_token` for `employee_id` WHERE `is_active = true`.
      → If no active token: skip silently (employee unregistered; no error logged).

   c. **Push send:**
      → Calls Expo Push API with payload: `{ to: token, title: day_line.location.name, body: session_task.title, data: { task_id, day_line_id, shift_session_id } }`.
      → Expo API returns success or error per token.

   d. **Telemetry emit:**
      → Calls `emit()` from `@smartout/telemetry` with event `day_line_item.notified`:
        ```
        {
          event: 'day_line_item.notified',
          workspace_id,
          actor_id: null,  // engine-dispatch is platform actor
          entity_type: 'session_task',
          entity_id: task_id,
          payload: { shift_session_id, employee_id, location_id, scheduled_at, expo_push_success }
        }
        ```
      → Routes to PostHog + Logger + `activity_trail` + `engine_event` (ADR-0358).
      → Note: `engine_event` INSERT above (step a) is the idempotency record; this `emit()` call goes to `activity_trail` for audit. They are separate writes.

4. Cron tick completes. Next tick in ~60 seconds.

**Postcondition:**
- Every `(task_id, shift_session_id)` pair in the now-window has been processed exactly once (idempotency guaranteed by DB UNIQUE on `engine_event.idempotency_key`).
- Clocked-in employees at the area have received a push notification about the scheduled task.
- `day_line_item.notified` events exist in `activity_trail` for audit.
- `session_task.status` is NOT changed by this path — push is informational; the employee still completes the task via the task capability.

**Error paths:**

| Condition | System behaviour | Observable effect |
|---|---|---|
| `shift_session.status != 'clocked_in'` | Employee not in query results | No notification sent. Employee was scheduled but not clocked in — expected for future shifts. |
| No `expo_push_token` for employee | Push lookup returns empty | Skip silently. No error logged — routine for employees who haven't enabled push. |
| Idempotency key already exists (re-run or overlapping tick) | `ON CONFLICT DO NOTHING` — no second send | Zero duplicate notifications. Idempotency idempotent. |
| Expo API error (invalid token, rate limit, etc.) | Error captured per-token; logged to Logger + `activity_trail` with `expo_push_success=false` | `day_line_item.notified` event still recorded with failure flag (for ops retry). Task status unchanged. |
| `session_task.day_line_id IS NULL` | Row excluded by query WHERE clause | No notification (dept-level task, not area-anchored). Expected for open/close routines. |
| `scheduled_at IS NULL` on `session_task` | Row excluded by WHERE `scheduled_at BETWEEN...` | No notification. Task is ad-hoc / unscheduled. |
| Engine-dispatch tick delayed > 60s | Items in the now-window accumulate; processed on next tick | Minor delay; no data loss. Window is ±60s so a 2-min delay = potential miss for items between 60s-120s ago. V2 can widen window. |

**Idempotency design (ADR-0367 Rule 4):**
- `engine_event.idempotency_key` is an existing TEXT column with a UNIQUE index per `supabase/migrations/20260304100000_engine_process_tables.sql:122`. No new migration needed for the idempotency anchor.
- Composite key `'<session_task_id>:<shift_session_id>'` ensures: same task → same employee = exactly-once. Same task → different employee = separate sends (correct — each clocked-in employee gets their own notification).

**Option B (DEFERRED):**
- Device-side subscribe/unsubscribe API would allow employees to opt in/out of specific push topics at the device level. This requires a new ADR. V1 ships with engine-side gate only: `shift_session.status='clocked_in'` is the sole filter.

**E2E coverage pointer:**
- Spec file (planned): `apps/e2e/day-line/day-line-push.spec.ts`
- Testing approach: mock Expo Push API endpoint + fast-forward cron tick; assert `engine_event` idempotency_key exists after one tick and no duplicate on second tick.
- Status: NOT YET WRITTEN — gated on Phase E (push pipeline) merge.

**ADR refs:** ADR-0367 (Rule 4, Rule 10), ADR-0334, ADR-0358.
