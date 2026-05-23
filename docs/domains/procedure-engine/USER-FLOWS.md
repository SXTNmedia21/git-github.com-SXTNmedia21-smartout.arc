---
title: "Procedure Engine — User Flows"
status: in_progress
mirror: mixed
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: procedure-engine
tags: [domain, procedure-engine, user-flows, journeys, manager, employee, agent, adr-0298, adr-0367, adr-0391]
---

# Procedure Engine — User Flows

> Flow index across the full pipeline: template authoring → day-line composition → instantiation → assignment → completion.
> `mirror: mixed` — verified-working flows (A, D–F) confirmed in code. Blocked/partial flows (B, C, G–I) are build targets.
> **Journeys live in `docs/journeys/`** — this file is an index + status, not the full journey spec.

## Status legend

| Icon | Meaning |
|---|---|
| ✅ | Confirmed working in code |
| 🟡 | Partial — core path works, gaps noted |
| 🔴 | Not built — target for Phase 1+ |

---

## Flow A — Manager creates a location task list (Phase-1 manager promise)

**Precondition:** workspace bootstrapped (I1); department has ≥1 location in `department_location`; `department_session` exists for the date.

1. Manager opens Dagslinjen (WebDayControl) for a date → System loads day_lines per area (`useDayLines`) → Manager sees one strip per location. ✅
2. Manager picks an area strip and "Add task" → System opens AddTaskDialog/slot-picker → Manager enters title + optional time window. 🟡 (`add-day-line-item-action → task.create_session{day_line_id}` works; UI doesn't pass `day_line_id` consistently — G4)
3. System writes `session_task` with `day_line_id` set + optional `scheduled_at`; emits `task created`. ✅ (write path) / 🟡 (UI wiring inconsistent)
4. Manager attaches a routine to the strip → AttachRoutineDialog → System should expand the routine into tasks under the day_line. 🔴 (routine expansion is stub until Phase 1 Task 6 completes in cron + RoutineForm Task 7)

**Postcondition:** day_line carries N area-anchored tasks within its time window.
**Error paths:** no location on department → strip cannot be created; gate denies non-manager → refusal string.

Journey target: `docs/journeys/JOURNEY-procedure-engine-create-location-task-list.md`

---

## Flow B — Employee sees their shift's tasks (Phase-1 deliverable)

**Precondition:** employee has a published `schedule_shift` for today; `shift_session` auto-created by `ensure_shift_session()`.

1. Employee opens Min dag (mobile `DuringShiftViewV2`) → System resolves `shift_session → shift_session_day_line → day_line → session_task`, gated on `shift_session.status ∈ {scheduled, clocked_in}` (G6). 🟡 (`use-shift-session.ts:65` + `useDayLineItems` resolve the chain on mobile; status-gate missing; clock-in BFF not yet built)
2. Employee clocks in → `shift_session.status = 'clocked_in'`; Min dag shows only this shift's tasks at this location. 🔴 (clock-in BFF `POST /api/mobile/shift-session/[id]/clock-in` not built — Plan Task 9)
3. Employee taps a task → TaskModal → completes (+ evidence for HACCP) → `complete.execute({source:'session'})`. ✅
4. System sets `status='completed'`, `completed_at`, `completed_by`; emits `task completed`. ✅

**Gap:** step 2 (clock-in BFF) and the status-gate (G6) are Phase 1 deliverables. The chain itself is wired on mobile.

Journey target: `docs/journeys/JOURNEY-procedure-engine-employee-shift-tasks.md`

---

## Flow C — Cron expands procedure into tasks per hook (partial — day_line anchor gap)

1. `session-hook-executor` cron finds active `session_hook` with `linked_procedure_id` → fetches `procedure_step` rows → inserts one `session_task` per step with provenance triple. ✅ (`session-hook-executor/index.ts:117–140`)
2. Tasks appear in TasksTab grouped under the hook. ✅
3. Each task carries `day_line_id` via `fn_resolve_single_day_line` — but only if exactly one day_line matches `(dept_session, location)`. 🟡 (fn exists; cron now calls it; if zero/multiple day_lines → NULL anchor, task visible in TasksTab but invisible in shift-chain — G3)

**Gap G3:** hook/cron tasks may still have `day_line_id = NULL` if the day_line for the hook's department+location wasn't pre-created. Full resolution requires location→hook wiring in Phase 1 Task 5.

Journey target: `docs/journeys/JOURNEY-procedure-engine-cron-procedure-instantiation.md`

---

## Flow D — Routine on a schedule (Phase 1 — cron expansion fixed)

**Pre-ADR-0391:** `linked_routine_id` → one flat stub task with routine UUID in description. **Gap G6 (closed by ADR-0391).**

1. Routine seeded with `procedure_id`, `trigger_config`, `location_id` (Phase 1), `executor_type`. ✅ (schema phase 1)
2. `session_hook.linked_routine_id` fires → `session-hook-executor:255–290` resolves `routine.procedure_id` → fetches `procedure_step` rows → inserts one `session_task` per step, each with `day_line_id` + provenance triple (origin=`routine`, generated_by=`cron`, source_reference=`routine_id`). ✅ (confirmed in code)
3. Tasks appear in shift-scoped view (on mobile) for the relevant location. 🟡 (depends on `day_line_id` being non-NULL, which requires location→day_line for the routine's location)

**Residue after ADR-0391:** `routine.attach_to_line` capability does NOT read the `routine` table — it takes free-form items and delegates to `task.create_session` (gap G7). The expansion fix is in the cron path, not the agent tool path.

Journey target: `docs/journeys/JOURNEY-procedure-engine-attach-routine-to-line.md`

---

## Flow E — Personal & agent (Emma) tasks (live)

1. User asks Botsson "remind me to call the supplier" → `create_personal` → `personal_task`. ✅ (chat-only)
2. Botsson auto-schedules reminder → `emma_task` (max 3 active); cron flips `pending→triggered` at `due_at`. ✅
3. Both surface in Min Dag / mobile feed via `fn_list_my_tasks`; completed via `complete{source:personal|emma}`. ✅

Journey target: `docs/journeys/JOURNEY-procedure-engine-personal-and-emma.md`

---

## Flow F — Manager ad-hoc day task (live)

1. Manager: "add day task for tomorrow: deep-clean" → `create_day_ad_hoc` → `schedule_day_task` (date-anchored). ✅
2. Surfaces in Min Dag for the date; completed via `complete{source:day_ad_hoc}`. ✅

Journey target: `docs/journeys/JOURNEY-procedure-engine-day-adhoc.md`

---

## Flow G — Admin creates a routine + assigns to location (Phase 1 aspirational)

**Precondition:** procedure + procedure_steps exist.

1. Admin opens governance section → "New routine" → System opens RoutineForm. 🔴 (RoutineForm not built — Plan Task 7)
2. Admin fills: name, procedure (select), trigger_config (times/days), location, teams (optional). 🔴
3. System calls `routine.create` → `routine.assign_to_location` → upserts `session_hook` with `linked_routine_id`. 🔴 (tools built ✅; UI not)
4. Routine appears in library; cron will expand it the next time the session fires for that location. 🔴

Journey target: `docs/journeys/JOURNEY-procedure-engine-admin-creates-routine.md`

---

## Flow H — Botsson setup mission (blocked — G20)

**Precondition:** workspace finalized but template bootstrap not applied.

1. Botsson is given a setup mission → guides admin through `department_session` + `session_hook` + routine assignment. 🔴 (no setup mission exists)
2. Industry routine templates (24 routines, 18 control_lists, 337 assignments) auto-applied for the workspace's `industry_type`. 🔴 (`finalize-workspace/index.ts:71–105` never calls templates — G20)

**Blocked by:** G20 (template bootstrap not wired) + Phase 1 RoutineForm.

Journey target: `docs/journeys/JOURNEY-procedure-engine-botsson-setup.md`

---

## Flow I — Auto-compliance per role (ADR-0387b, council-gated)

**Precondition:** ADR-0387a shipped (profession_training revived + I1 seeded).

1. New employee profile with a `profile_position` INSERT → trigger auto-assigns mandatory protocols for that position. 🔴 (ADR-0387b not yet built)
2. Employee's readiness gate reflects mandatory-protocol completion, not workspace-average. 🔴

**Blocked by:** ADR-0387b council approval.

Journey target: `docs/journeys/JOURNEY-procedure-engine-auto-role-compliance.md`

---

## Authority decision points (cross-flow)

- Any `create_*` / `complete` → `gate_action(p_capability='task', action_type)`; fail-closed on RPC error (L-0066/L-0097). `packages/ai/src/capabilities/task/gate.ts`.
- `create_session` via `day_line_id` → requires `actor_capability` + `delegated_via` (ADR-0356).
- Voice → `create_*` refused (chat-only V1); `list_mine` + `complete` allowed.
- Mobile → execute-only; no authoring (ADR-0133).
- Routine create/assign/add_step → manager+, confirm, chat-only V1. `packages/ai/src/capabilities/routine/gate.ts`.
