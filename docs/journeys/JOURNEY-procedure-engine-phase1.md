---
title: "Journey — Procedure Engine Phase 1"
feature: procedure-engine-phase1
status: verified
verified_at: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
module: procedure-engine
tags: [procedure-engine, routine, session-task, provenance, day-line, clock-in, notifications]
---

# Journey — Procedure Engine Phase 1

First operative slice of the procedure-engine: routine (template) → cron materialization →
session_task (instance) → mobile execution, plus notifications. Built parallel-team across
3 dependency waves, committed direct to `development` (b04c8e4e1..893a139cf).

Verification depth: J2/J3/J4 proven end-to-end via SQL pipe-walk against seed DB (non-destructive
ROLLBACK). J1/J5 are data-chain + unit verified; live HTTP/cron-tick not fired (no running
surfaces this session) — tracked as E2E debt in HANDOFF.

---

## Journey 1: Employee clocks in + sees Min dag

**Precondition:** Employee has a published, assigned shift today with a location; the shift's
department has a `department_session` + a single `day_line`.

1. Employee opens mobile app on shift day → System resolves today's `shift_session` → User sees BeforeShiftView with "Stemple inn nå".
2. Employee taps clock-in → Mobile POSTs `/api/mobile/shift-session/[id]/clock-in` (Bearer JWT) → BFF derives identity server-side (ADR-0151), guards ownership + status, sets `status='clocked_in'`, `clocked_in_at=now()`, emits `shift_session.clocked_in` → User lands in DuringShiftView.
3. DuringShiftView renders "DAGENS OPPGAVER" → `useDayLineItems` traverses `shift_session → shift_session_day_line → day_line → session_task` (status ∈ pending/available/in_progress) → User sees today's task timeline with start/due, or empty state.

**Postcondition:** shift_session is `clocked_in`; employee sees only their/pickup tasks for today at that location.

**Error paths:**
- Not owner of shift → BFF 403 (no forgeable identity, ADR-0151).
- Already clocked in → idempotent 200, no double-write.
- Shift not in `scheduled` → status guard rejects (optimistic-lock `.eq("status","scheduled")`).
- No day_line items → empty state "Ingen oppgaver for i dag."

**Verification:** Data chain proven (J4 smoke confirmed `shift_session_day_line` linkage). Live HTTP clock-in not fired — BFF route typecheck-clean, logic unit-shaped. E2E debt.

---

## Journey 2: Admin creates a routine bound to a procedure

**Precondition:** Admin in workspace with ≥1 protocol + procedure (with steps) + location.

1. Admin opens governance → taps "Ny rutine" → System renders shared `RoutineForm` (Sheet).
2. Admin fills name, picks procedure (protocol derived), trigger (times/days), location, optional teams → System validates.
3. Admin submits → `useCreateRoutine` → `create-routine-action` calls routine.create then assign → System inserts `routine` (workspace_id trigger-backfilled from protocol, executor_type default `human`), emits `routine.created`.

**Postcondition:** `routine` row exists bound to procedure + protocol, scoped to workspace.

**Error paths:**
- Location in another workspace → action returns refusal (L-0177 fail-fast, no silent fallback).
- Insert failure → Norwegian error surfaced, no partial emit.

**Verification:** SQL pipe-walk confirmed routine bound, workspace_id auto-filled, executor=human. Capability unit tests 31/31. Live form submit not fired — E2E debt.

---

## Journey 3: Routine assigned to location materializes per-step tasks (G6 fix)

**Precondition:** Routine bound to a procedure with N steps; target location maps to ≥1 department with a `department_session` + single `day_line` today.

1. Admin assigns routine to location → System sets `routine.location_id`, replaces `routine_team` rows (empty = location-wide), upserts a `session_hook` (linked_routine_id) per department serving that location (M:N via `department_location`), emits `routine.assigned_to_location`.
2. Cron tick (session-hook-executor) fires the hook → System resolves `procedure_id` from routine, reads `procedure_step` ordered, resolves the single `day_line` (`fn_resolve_single_day_line`, ADR-0367), inserts **one `session_task` per step** (not 1 stub — G6 fixed).
3. Each task carries the provenance triple `origin='routine'`, `generated_by='cron'`, `source_reference=routine_id` + `day_line_id`.

**Postcondition:** N session_task rows exist for that location's day_line, each provenance-stamped; none on other locations.

**Error paths:**
- 0 or >1 active day_line → `fn_resolve_single_day_line` returns NULL (never guesses, ADR-0367 single-area V1).
- 0 steps → hook skipped without marking done (retries next tick when configured).

**Verification:** SQL pipe-walk green — 3 steps → 3 tasks, 3/3 day_line set, 3/3 provenance correct. Cron source tests 12/12.

---

## Journey 4: Manager sets location on a shift

**Precondition:** Manager creating/editing a shift; shift gets assigned to an employee in a department with a `department_session` today.

1. Manager opens AddShiftDialog → picks a location in the new Select (optional) → System holds `locationId` in form state.
2. Manager saves → `addShiftAction` sets `schedule_shift.location_id` → `trg_ensure_shift_session` (on assigned shift) creates `shift_session` copying `location_id` + links `shift_session_day_line` to that location's day_lines.

**Postcondition:** `shift_session.location_id` matches the shift; Min dag filters to that location's tasks.

**Error paths:**
- Unassigned shift (no employee_id) → trigger early-returns, no shift_session (by design).
- No matching department_session → trigger early-returns.

**Verification:** SQL pipe-walk green — assigned shift propagated `location_id` to shift_session (status scheduled) + 1 day_line linked.

---

## Journey 5: Notify on overdue + newly-assigned task

**Precondition:** Workspace with session_tasks; managers/admins exist in the task's department.

1. Task passes its due time → `session-task-overdue-cron` (pg_cron */5) sets `status='overdue'` → System inserts `notification_outbox` rows for assignee + department managers, emits `session_task.overdue`.
2. Manager assigns a task (`task.create_session` with assignee) → System inserts `notification_outbox` for assignee + emits `session_task.assigned`.

**Postcondition:** Assignee + managers have notification rows; events emitted to telemetry.

**Error paths:**
- Self-assignment → no redundant notification.
- No managers in department → assignee still notified.

**Verification:** overdue-cron source tests 18/18; notification_outbox + manager-resolution patterns reused from shift-lateness-check. Live cron-tick not fired — E2E debt.
