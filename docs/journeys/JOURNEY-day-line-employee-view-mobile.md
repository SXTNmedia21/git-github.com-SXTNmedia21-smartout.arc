---
title: Journey — Employee Views Day Lines on Mobile
status: accepted
created: 2026-05-18
updated: 2026-05-18
module: daytimeline
tags: [journey, day-line, mobile, employee, shift-session, read-only, adr-0367, adr-0133, d6]
---

# Journey: Employee Views Day Lines on Mobile

> Captures the mobile read path from the day route through `useShiftSession` + `useDayLineItems`, the defensive client-side filter for foreign items, and the multi-area section render. Mobile is read-only per ADR-0133.
>
> Relevant ADRs: ADR-0367 (Rule 3, Rule 9), ADR-0133 (mobile boundary — read+execute only, no authoring), ADR-0134 (mobile telemetry contract), ADR-0297 (workforce snapshot bootstrap), ADR-0298 (task ontology).

---

## Journey: Employee Opens Mobile Day Route and Views Their Area Lines

**Precondition:**
- Employee is authenticated and has a clocked-in or scheduled `shift_session` for the current business date.
- One or more `day_line` rows exist for `(department_session_id, location_id)` pairs matching the employee's shift(s).
- `shift_session_day_line` junction rows exist (auto-populated at shift insert by trigger, joining on `(business_date, department_id, location_id)`).
- Employee has an `expo_push_token` registered (or push is silently skipped if absent).
- `workspace_id` and `actor_id` (profile_id) are non-null per `getProfileContext()` (ADR-0134 — fail fast on missing IDs).

**Happy path:**

1. Employee opens the mobile app and taps the day route for today's date (`(app)/(calendar)/day/[date]`).
   → System: `useShiftSession` hook fires. Fetches the employee's `shift_session` row(s) for the date, joined to `day_line` via `shift_session_day_line`.
   → Parallel fetch: `useDayLineItems` fetches `session_task` rows with `day_line_id IN [...]` scoped to the employee's linked day lines (assigned_to = profile_id OR visible to all).

2. **Defensive client-side filter (`useDayLineItems`):**
   → The hook applies a client-side filter: drops any `session_task` rows where `day_line_id` is NOT in the employee's `shift_session_day_line` set (foreign items from other employees' sessions that may have leaked through an RLS gap during Phase B rollout).
   → If any items are dropped by this filter, the hook emits `shift_session.item_leak_detected` via `emit()` (PostHog + Logger + `activity_trail` for audit; NOT `engine_event` — this is an anomaly signal, not a workflow event).
   → Payload: `{ session_task_id, day_line_id, shift_session_id, actor_id, workspace_id }`.

3. Employee sees a vertical multi-area section list:
   - Each area (location) they are linked to gets its own section header (area name + `planned_open`–`planned_close` band as a compact label).
   - Section items: `session_task` rows assigned to the employee, ordered by `scheduled_at` (nulls last, then title alpha).
   - Each item shows: title, status badge, `scheduled_at` time if set.
   - Items from other areas (outside the employee's `shift_session_day_line` set) are NOT rendered.

4. Employee taps an item row.
   → System: opens detail sheet (planned: `data-testid="day-line-item-detail-sheet"`).
   → Sheet renders: task title, description, `scheduled_at`, status, `evidence` field if required.
   → Employee can mark complete (executes `task.complete` capability via Server Action — allowed per ADR-0133 "Execute" verb).
   → NO edit/delete affordance — authoring verbs are web-only.

5. Employee can see (read-only) the area name and planned hours for each strip section.
   → No slot-click affordance (web-only authoring per ADR-0133).

**Postcondition:**
- Employee has seen their area-anchored items for the day.
- Any item leak detected → `shift_session.item_leak_detected` event logged (signals RLS gap for ops review).
- No mutations to `day_line` or `shift_session` itself from this read path.

**Error paths:**

| Condition | System behaviour | Employee sees |
|---|---|---|
| No `shift_session` for date | `useShiftSession` returns empty | Day view renders "Du har ingen vakt i dag." with generic company note if available. |
| `shift_session_day_line` has zero rows (trigger failed or shift has no `location_id`) | `useDayLineItems` returns empty list | Section list renders with heading "Ingen dagslinje-oppgaver tilknyttet din vakt." |
| `workspace_id` or `actor_id` null from `getProfileContext()` | `getProfileContext()` throws at call site (ADR-0134 fail-fast, no empty-string fallback) | App surfaces an error boundary screen; no corrupt telemetry emitted. |
| Item leak detected (foreign `day_line_id`) | Items dropped client-side; `shift_session.item_leak_detected` emitted | Employee does not see foreign items — silently filtered. Ops team sees anomaly in `activity_trail`. |
| `useDayLineItems` query error | React Query error state; retry on next focus | Skeleton remains; "Kunne ikke laste oppgaver" inline error with retry button. |
| Employee taps a completed item | Detail sheet opens read-only; no re-complete affordance | "Fullført" status badge; no action button. |

**Mobile surface boundary (ADR-0133):**
- Employee may: view items, complete tasks, view area names + hours.
- Employee may NOT: create day lines, edit hours, attach routines, add items, delete items. All authoring verbs remain web-only.
- Clock-in / clock-out (via `shift-lifecycle.clock_in/out` capability extension) IS allowed on mobile as an "Execute/Witness" verb — but that flow is documented in the shift-lifecycle journey, not here.

**E2E coverage pointer:**
- Spec file (planned): `apps/e2e/day-line/day-line-employee-mobile-view.spec.ts` (mobile E2E via Playwright + mobile web harness)
- Key selectors: `testID="day-line-area-section-[location_id]"`, `testID="day-line-item-[task_id]"`, `testID="day-line-item-detail-sheet"` (planned — assigned in Phase D mobile work).
- Status: NOT YET WRITTEN — gated on Phase D (mobile) merge.

**ADR refs:** ADR-0367 (Rule 3, Rule 9, Rule 10), ADR-0133, ADR-0134, ADR-0297, ADR-0298, ADR-0358.
