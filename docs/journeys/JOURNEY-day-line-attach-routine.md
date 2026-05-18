---
title: Journey — Manager Attaches Routine (Timeline Template) to Day Line
status: accepted
created: 2026-05-18
updated: 2026-05-18
module: daytimeline
tags: [journey, day-line, routine, template, attach, manager, adr-0367, adr-0240, adr-0335, d6]
---

# Journey: Manager Attaches Routine to Day Line

> Captures the attach-routine flow from `AttachRoutineDialog` through the cross-namespace delegation chain: `day-line.instantiate_template` capability → delegates to `routine.attach_to_line` → delegates each item to `task.create_session` (Pattern B per ADR-0356, mandatory per ADR-0367 Rule 7). A single `routine.attached` event is emitted at the end.
>
> Relevant ADRs: ADR-0367 (Rule 7 Pattern B, Rule 10), ADR-0240 (cross-namespace delegation), ADR-0335 (timeline templates), ADR-0298 (task ontology), ADR-0356 (Pattern B audit-symmetry), ADR-0151, ADR-0204, ADR-0287.

---

## Journey: Manager Attaches a Timeline Template as a Routine to an Area Line

**Precondition:**
- Manager is authenticated.
- A `day_line` exists for the target `(department_session, location)`.
- A `timeline_template` exists with `scope_type='location'` and `scope_id` matching the `day_line.location_id` (or a dept-scoped template the manager chooses to apply).
- `engine_authority_config` seeds exist for `day_line.instantiate_template` (manager+) and `routine.attach_to_line` (manager+, cross-namespace delegated).

**Happy path:**

1. Manager opens the day view, locates the target area strip in TimelineTab, and clicks "Legg til rutine" (planned: `data-testid="attach-routine-trigger"`).
   → System: renders `AttachRoutineDialog` (planned: `data-testid="attach-routine-dialog"`).
   → Manager sees: a list of available `timeline_template` rows filtered by `scope_type='location'` + `scope_id=day_line.location_id` (area-scoped first), plus any dept-scoped templates as secondary options. Templates show name, item count, and last used date.
2. Manager selects a template from the list and confirms.
3. Manager optionally sets a start offset (default: now or `planned_open`) and confirms submission.
   → System: calls `instantiateTemplateAction` Server Action with `{ day_line_id, template_id, offset }`.
   → `instantiateTemplateAction` calls the `day-line.instantiate_template` capability tool.

4. **Capability chain — `day-line.instantiate_template`:**
   → Resolves `workspace_id`, validates `day_line_id` + `template_id` belong to the workspace (ADR-0151).
   → Calls `gate_action('day_line.instantiate_template', workspace_id, profile_id)` — ALLOW for manager+.
   → Reads `timeline_template.items_json` (Zod-validated discriminated union per ADR-0335).
   → For `session_task`-type items in the template: delegates to `routine.attach_to_line` capability, passing `{ day_line_id, items: [...], delegated_via: 'day-line', actor_capability: 'day-line.instantiate_template' }` (Pattern B, ADR-0356 mandatory per ADR-0367 Rule 7).

5. **Delegated capability — `routine.attach_to_line`:**
   → Receives delegation context: `actor_capability='day-line.instantiate_template'`, `delegated_via='day-line'`.
   → Does NOT write to `session_task` directly. Per ADR-0240 (cross-namespace write prohibition): delegates EACH item to `task.create_session`, passing `{ department_session_id, day_line_id, title, scheduled_at, actor_capability, delegated_via }`.

6. **Leaf capability — `task.create_session` (called N times, one per template item):**
   → Inserts one `session_task` row per item via `gatedMutation`.
   → `session_task.day_line_id = day_line_id` (area-anchored per ADR-0367).
   → `session_task.scheduled_at = offset + item.trigger_offset_min` (ADR-0367 scope expansion).
   → Emit per ADR-0356 Pattern B: each `session_task` insert emits `task.added_manual` (or `day_line_item.added`) with `actor_capability='task.create_session'` + `delegated_via='routine.attach_to_line'`.

7. After all items created, `routine.attach_to_line` emits ONE `routine.attached` event via `emit()`:
   → Payload: `{ day_line_id, template_id, item_count, actor_capability: 'day-line.instantiate_template', delegated_via: 'day-line' }`.
   → Routes to PostHog + Logger + `activity_trail` + `engine_event` (ADR-0358).

8. `instantiateTemplateAction` returns success.
   → TanStack Query invalidation. TimelineTab re-fetches and renders the N new task chips on the area strip at their scheduled positions.
   → Manager sees: routine task chips appear at the correct time positions on the strip.

**Postcondition:**
- N new `session_task` rows exist, each with `day_line_id` set and `scheduled_at` computed from the template's offset structure.
- One `routine.attached` event in `activity_trail`.
- Per-item emit-chain complete (Pattern B audit-symmetry — each write traceable to the delegation chain).
- Strip renders task chips at scheduled positions.

**Error paths:**

| Condition | System behaviour | Manager sees |
|---|---|---|
| Template not found in workspace | `instantiateTemplateAction` returns 404-equivalent | Toast: "Malen ble ikke funnet." |
| Template has zero `session_task` items | Capability returns success but emits `routine.attached` with `item_count=0`; no tasks created | Toast: "Malen er tom — ingen oppgaver ble lagt til." |
| `gate_action` DENY on `day_line.instantiate_template` | Capability aborts before any delegation | Toast: "Mangler tillatelse." |
| Session locked | Guard detects lock before mutation chain | Toast: "Dagsøkten er avsluttet." |
| Partial failure (N items, M fail) | Each `task.create_session` call is atomic; partial failures rolled back per item; top-level action returns partial-success with error list | Toast: "X av Y oppgaver ble opprettet. Se logg for detaljer." (V1 best-effort; V2 full transaction). |
| Template `scope_type != 'location'` applied to day_line | Capability allows (dept-scoped templates are valid); items inherit `day_line_id` at apply time | No error — items anchor to the line. Manager confirms in the preview step. |

**Design notes (Pattern B):**
- ADR-0240 prohibits `routine/tools.ts` from writing `session_task` rows directly. It MUST call `task.create_session`.
- ADR-0356 mandates `actor_capability` + `delegated_via` fields on every emit that traverses a namespace boundary.
- Pattern A (passing `day_line_id` from any caller without audit fields) is FORBIDDEN per ADR-0367 Rule 7.

**E2E coverage pointer:**
- Spec file (planned): `apps/e2e/day-line/day-line-attach-routine.spec.ts`
- Key selectors: `data-testid="attach-routine-trigger"`, `data-testid="attach-routine-dialog"`, `data-testid="template-list-item-[template_id]"`, `data-testid="day-line-task-chip-[task_id]"` (planned — assigned in Phase C UI work).
- Status: NOT YET WRITTEN — gated on Phase B (capabilities) + Phase C (UI) merge.

**ADR refs:** ADR-0367 (Rule 7, Rule 10), ADR-0240, ADR-0298, ADR-0335, ADR-0356, ADR-0099, ADR-0114, ADR-0151, ADR-0204, ADR-0287, ADR-0358.
