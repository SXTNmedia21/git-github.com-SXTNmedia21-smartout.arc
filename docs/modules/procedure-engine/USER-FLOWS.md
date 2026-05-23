---
title: Procedure Engine — User Flows
status: archived
superseded_by: docs/domains/procedure-engine/
updated: 2026-05-22
created: 2026-05-20
module: procedure-engine
tags: [module, procedure-engine, user-flows, journeys, manager, employee, agent]
---

# Procedure Engine — User Flows

> Flows across the full pipeline: template authoring → day-line composition → instantiation → assignment → completion. Marked ✅ shipped, 🟡 partial, 🔴 not built.

## Flow A — Manager creates a location task list (the Phase-1 promise)
**Precondition:** workspace bootstrapped (I1); department has ≥1 location in `department_location`; a `department_session` exists for the date.

1. Manager opens Dagslinjen (WebDayControl) for a date → System loads day_lines per area (`useDayLines`) → Manager sees one strip per location. ✅
2. Manager picks an area strip and "Add task" → System opens AddTaskDialog/slot-picker → Manager enters title + optional time within the strip's `planned_open`/`planned_close`. 🟡 (dialog exists; binding the task to `day_line_id` is via `add-day-line-item-action` → `task.create_session{day_line_id}`)
3. System writes `session_task` with `day_line_id` set + optional `scheduled_at` → emits `task created`. ✅ (write path) / 🟡 (UI not wired to pass day_line_id consistently)
4. Manager (optional) attaches a routine to the strip → AttachRoutineDialog → System expands the routine into tasks under the day_line. 🔴 (routine expansion stub — G6/G7)

**Postcondition:** day_line carries N area-anchored tasks within its time window.
**Error paths:** no location on department → strip cannot be created; gate denies non-manager → refusal.

## Flow B — Employee sees their shift's tasks (🔴 the missing surface)
**Precondition:** employee has a published `schedule_shift` for today; `shift_session` auto-created by `ensure_shift_session()`.

1. Employee opens their shift (mobile TaskFeed / web) → System should resolve `shift_session → shift_session_day_line → day_line → session_task`. 🔴 (no query renders this chain — G2)
2. Today instead: mobile `useMyTasks` shows the whole inbox via `fn_list_my_tasks` with no day_line/shift filter. 🟡 (G5)
3. Employee taps a task → TaskModal → completes (+ evidence for HACCP) → `complete.execute({source:'session'})`. ✅
4. System sets `status='completed'`, `completed_at`, `completed_by`; emits `task completed`. ✅

**Postcondition:** task done; visible to manager via session metrics.
**Gap:** step 1 is the Phase-1 deliverable.

## Flow C — Cascade/cron instantiates tasks from a procedure
1. `session-hook-executor` cron finds active `session_hook` with `linked_procedure_id` → fetches `procedure_step` rows → inserts one `session_task` per step into the live `department_session`. ✅
2. Tasks appear in TasksTab grouped under the hook. ✅
3. **Gap:** spawned tasks have no `day_line_id` → never reach a shift via the area chain (G3).

## Flow D — Routine on a schedule (🔴 partial)
1. Routine seeded (e.g. "alcohol check, Fri/Sat 22:00") via SQL template; `routine.trigger_config={times,days}`. ✅ (seed)
2. A `session_hook.linked_routine_id` fires → System currently creates **one flat task** "Rutine: …" with routine UUID in description, not the procedure's steps. 🔴 (G6)
3. Intended: expand routine's `procedure_step` rows into individual `session_task` rows under the relevant day_line. 🔴

## Flow E — Personal & agent (Emma) tasks
1. User asks Botsson "remind me to call the supplier" → `create_personal` → `personal_task`. ✅ (chat-only)
2. Botsson auto-schedules a reminder → `emma_task` (max 3 active); cron flips `pending`→`triggered` at `due_at`. ✅
3. Both surface in Min Dag / mobile feed via `fn_list_my_tasks`; completed via `complete{source:personal|emma}`. ✅

## Flow F — Manager ad-hoc day task
1. Manager: "add a day task for tomorrow: deep-clean" → `create_day_ad_hoc` → `schedule_day_task` (date-anchored, no session). ✅
2. Surfaces in Min Dag for the date; completed via `complete{source:day_ad_hoc}`. ✅

## Authority decision points
- Any `create_*` / `complete` → `gate_action(p_capability='task', action_type)`; fail-closed.
- `create_session` via `day_line_id` → requires `actor_capability` + `delegated_via` (audit symmetry).
- Voice → `create_*` refused (chat-only V1); `list_mine` + `complete` allowed.
- Mobile → execute-only; no authoring (ADR-0133).

## Journey backlog (to author under docs/journeys/)
- JOURNEY-task-manager-create-location-task-list (Flow A)
- JOURNEY-task-manager-employee-shift-tasks (Flow B)
- JOURNEY-task-manager-attach-routine-to-line (Flow D)
- JOURNEY-task-manager-cascade-procedure-instantiation (Flow C)
- JOURNEY-task-manager-personal-and-emma (Flow E)
