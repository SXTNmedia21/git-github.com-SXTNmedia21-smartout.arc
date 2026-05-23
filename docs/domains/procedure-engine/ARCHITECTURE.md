---
title: "Procedure Engine — Architecture"
status: in_progress
mirror: mixed
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: procedure-engine
tags: [domain, procedure-engine, architecture, code-map, capability, rpc, bff, ui, voice, telemetry, adr-0298, adr-0391]
---

# Procedure Engine — Architecture

> L1–L5 code map. **Code wins** — verified against actual files 2026-05-22.
> `mirror: mixed` — Phase 1 schema + capability layer verified. UI gaps (RoutineForm, mobile clock-in, notifications) marked aspirational.

## L1 — Capability layer (write surface) — VERIFIED

| Capability | File | Tools | Writes |
|---|---|---|---|
| `task` | `packages/ai/src/capabilities/task/{index,tools,gate}.ts` | `list_mine`, `create_personal`, `create_session`, `create_day_ad_hoc`, `complete`, `cancel_personal` | `session_task`, `schedule_day_task`, `personal_task`, `emma_task` (source-dispatched) |
| `routine` | `packages/ai/src/capabilities/routine/tools.ts` | `attach_to_line`, `create`, `assign_to_location`, `add_step` | `routine`, `routine_team`, `procedure_step`; delegates `session_task` writes to `task.create_session` (ADR-0240) |
| `day-line` | `packages/ai/src/capabilities/day-line/tools.ts` | `create`, `add_item`(task\|routine), `instantiate_template`, `update_hours` | `day_line`; delegates task writes to `task.create_session` (ADR-0240) |
| `timeline-template` | `packages/ai/src/capabilities/timeline-template/tools.ts` | `save_template`, `list_templates`, `apply_template`, `archive_template` | `timeline_template`; materializes D6 rows |
| `governance` | `packages/ai/src/capabilities/governance/tools.ts` | `check_readiness` | read-only; `list_mandatory_protocols_for_role` (ADR-0387a) |

**Phase 1 `routine` capability additions (ADR-0391 — verified `packages/ai/src/capabilities/routine/tools.ts`):**

| Tool | Gate | Channel V1 | Anchor |
|---|---|---|---|
| `create` (line ~217) | `routine.create` | chat | manager+ |
| `assign_to_location` (line ~369) | `routine.assign_to_location` | chat | manager+; L-0177 fail-fast on workspace mismatch |
| `add_step` (line ~568) | `routine.add_step` | chat | manager+; delegates `procedure_step` insert |

**`task` capability tool detail (verified `packages/ai/src/capabilities/task/tools.ts`):**

| Tool | Input | Channel V1 | Gate |
|---|---|---|---|
| `list_mine` | `{ window_start?, window_end? }` | chat + voice | ungated (read) |
| `create_personal` | `{ title, due_at?, priority? }` | chat | `task.create_personal` |
| `create_session` | `{ session_id, title, assignee_profile_id?, hook_id?, compliance?, reason, day_line_id?, actor_capability?, delegated_via?, description?, scheduled_at? }` | chat | `task.create_session` |
| `create_day_ad_hoc` | `{ date, title, assignee_profile_id?, highlight?, category? }` | chat | `task.create_day_ad_hoc` |
| `complete` | `{ id, source: session\|personal\|day_ad_hoc\|emma }` | chat + voice | `task.complete` |
| `cancel_personal` | `{ id, reason }` | chat | `task.cancel_personal` |

`complete` is source-dispatched at `tools.ts:741–912`. `create_session` with `day_line_id` resolves `department_session_id` server-side from the day_line row + requires `actor_capability`/`delegated_via` (ADR-0356).

## L2 — Read RPC — VERIFIED

`fn_list_my_tasks(window_start, window_end)` — `SECURITY DEFINER`, UNION of 4 sources, `caller_profiles` CTE for multi-workspace. Migrations `20260606120100` (v1) + `20260607100100` (v2, adds hook links). **`list_mine` TS body replicates this** (service_role can't use `auth.uid()`) — lockstep pair per ADR-0317 (`packages/ai/src/capabilities/task/tools.ts:41–46,128–268`).

Adjacent read RPCs: `resolve_cascade_tasks` (CascadeTaskTab — setup tasks, not session_task), `fn_normalize_session_task_status` / `fn_normalize_priority` (`20260606120000`), `fn_resolve_single_day_line` (`20260621200103`) — returns the single active day_line for `(dept_session, location)` or NULL.

## L3 — BFF routes & Server Actions — VERIFIED

**BFF (mobile, Bearer JWT, `resolveMobileActor()`):**
- `POST /api/mobile/tasks` → `addTaskAction` → `createSession.execute()`
- `PATCH /api/mobile/tasks/[id]/complete` → `completeSessionTaskAction` (legacy session-only)
- `POST /api/mobile/tasks/[id]/complete` → `complete.execute()` (source-dispatched)
- `POST /api/mobile/tasks/personal` → `createPersonal.execute()`
- `/api/emma/tasks` + `/api/emma/tasks/dismiss` (emma surface)
- `POST /api/mobile/shift-session/[id]/clock-in` — **ASPIRATIONAL** (Plan Task 9, not yet built)

**Server Actions (web, cookie):**
- `add-task-action.ts` — thin wrapper over `createSession.execute()` (WebDayControl alias shape)
- `complete-session-task-action.ts` — shared web+mobile, accepts pre-resolved `ResolvedActor`
- `complete-task-action.ts` — cookie-path wrapper (HMS fix for client-side DB write)
- `create-day-line-action.ts` — `day-line.create`
- `add-day-line-item-action.ts` — `day-line.add_item` (task + routine branches)

## L4 — Web UI surfaces — VERIFIED (existing); ASPIRATIONAL (Phase 1 new)

**Existing (verified):**

| File | Component | Renders | Hook |
|---|---|---|---|
| `components/day/tabs/TasksTab.tsx` | TasksTab | tasks grouped by hook (pre_open…close) | `useSessionHooksWithTasks` (session-scoped) |
| `components/day/tabs/TimelineTab.tsx` | TimelineTab | day_line strips + slots | `useDayLines`, `useDayTimelineEvents` |
| `components/day/DayLineStrip.tsx` | DayLineStrip | status pill + hours popover + slot-picker + AttachRoutineDialog | `useDayLines` (props) |
| `components/day/AddTaskDialog.tsx` | AddTaskDialog | create session_task (hook selector + owner) | local |
| `app/dashboard/hms/_components/TaskCard.tsx` | TaskCard | collapsible task + evidence form + status colors | `use-session-tasks` |
| `app/dashboard/hms/_components/DriftTaskList.tsx` | DriftTaskList | list of TaskCard | `use-session-tasks` |
| `app/dashboard/_components/todo/TodoTaskView.tsx` | TodoTaskView | 4-source unified list (Min Dag today) | client aggregation |
| `app/dashboard/_components/todo/TodoTaskCard.tsx` | TodoTaskCard | personal + emma cards | local |
| `app/dashboard/schedule/_components/shift-task-tag.tsx` | MalTaskTag | compact per-shift status pill (Mal grid) | prop `MalTask` |
| `components/dashboard/entity-drawer/tabs/cascade-task/CascadeTaskTab.tsx` | CascadeTaskTab | D1–D6/C1–C4 setup tasks | `useCascadeTasks` |
| `app/dashboard/hms/` governance editors | Policy/Protocol/Procedure/KnowledgeTest Forms | form-based authoring | direct mutations |

**Phase 1 aspirational (NOT yet built):**

| File | Component | Phase |
|---|---|---|
| `app/dashboard/governance/_components/RoutineForm.tsx` | Create/edit routine + assign to location + team | Plan Task 7 |
| `app/dashboard/governance/_hooks/use-routine-mutations.ts` | TanStack mutation + server action delegate | Plan Task 7 |
| Shift location `<Select>` in `components/day/` shift editor | Set `schedule_shift.location_id` | Plan Task 8 |

## L4 — Mobile UI surfaces — VERIFIED (existing); ASPIRATIONAL (Phase 1 new)

**Existing (execute-only, ADR-0133):**

| File | Component | Renders |
|---|---|---|
| `apps/mobile/src/components/task/TaskFeed.tsx` | TaskFeed | active tasks sorted by compliance + deadline |
| `apps/mobile/src/components/task/TaskModal.tsx` | TaskModal | task detail + evidence + complete |
| `apps/mobile/src/components/task/ChecklistView.tsx` | ChecklistView | grouped checklist (maintenance/HACCP) |
| `apps/mobile/src/hooks/queries/use-my-tasks.ts` | hook | `fn_list_my_tasks` (4-source UNION), MMKV offline cache |
| `apps/mobile/src/hooks/queries/use-shift-session.ts` | hook | `shift_session → shift_session_day_line → day_line` chain (line 65) |
| `apps/mobile/src/hooks/queries/use-day-line-items.ts` | hook | `session_task` WHERE `day_line_id` (line 69, 149) |

**Phase 1 aspirational (NOT yet built):**

| File | Purpose | Plan |
|---|---|---|
| `DuringShiftView.v2.tsx` modification | clock-in trigger + Min dag timeline (status gate on `shift_session.status`) | Task 9 |
| `apps/web/src/app/api/mobile/shift-session/[id]/clock-in/route.ts` | BFF clock-in endpoint | Task 9 |

## L4 — Voice mirror — VERIFIED

`services/voice-agent/src/tools-task.ts` — `buildTaskTools(ask)` returns 6 thin `llm.tool()` defs forwarding to stage-engine → `task` capability. Names: `list_my_tasks`, `complete_task`, `create_personal_task`, `create_session_task`, `create_day_task`, `cancel_personal_task`. Voice `create_session_task` schema is intentionally narrower (no `day_line_id`/`scheduled_at`/`description`) per ADR-0298 R6 + L-0233.

## L5 — Persistence & instantiation — VERIFIED (Phase 1 expansion confirmed)

**Session-hook cron (`session-hook-executor/index.ts` — every 5 min):**
- Line ~85: fetch active session_hooks with `linked_procedure_id` / `linked_routine_id`
- Lines ~117–140: path A — `linked_procedure_id` → `procedure_step` → one `session_task` per step + provenance triple (origin=`procedure`, generated_by=`cron`, source_reference=hook.linked_procedure_id) + `day_line_id` via `fn_resolve_single_day_line`
- Lines ~141–145: batch-resolve routine→procedure_id map
- Lines ~255–290: path B — `linked_routine_id` → resolve `procedure_id` → `procedure_step` → one `session_task` per step (expanded, not 1 stub) + provenance (origin=`routine`, generated_by=`cron`, source_reference=routine_id) + `day_line_id` via `fn_resolve_single_day_line`. **ADR-0391 G-expand fix confirmed.**

**Emma cron (`emma-task-trigger/index.ts` — every 10 min):** `pending`→`triggered` at `due_at`.

**Engine dispatch (`engine-dispatch/index.ts:787–805`):** `assign_task` action writes `session_task` (not `engine_state_step`).

**Triggers:** `ensure_shift_session()` (`20260620130000`), `day_line_back_populate` (`20260620130100`).

## L5 — Telemetry — VERIFIED

`packages/telemetry/src/registry.ts`:

| Event | Destinations | Notes |
|---|---|---|
| `task created` | posthog, logger, activity_trail, engine_event | source ∈ session/personal/day_ad_hoc |
| `task completed` | posthog, logger, activity_trail, engine_event | completed_via ∈ self/manager/agent |
| `task cancelled` | posthog, logger, activity_trail | personal only |
| `task.list_mine` | posthog, logger | read-path |
| `routine.created` | posthog, logger, activity_trail, engine_event | Phase 1, ADR-0391 — verify in registry |
| `session_task.created` (alias) | activity_trail, engine_event, posthog | deprecated 30-day |
| `session_task.assigned` (alias) | activity_trail, engine_event, posthog | deprecated |
| `task.added_manual` (alias) | posthog, logger, activity_trail, engine_event | WebDayControl / mobile AddSheet |

## L5 — Intent classifier — VERIFIED

`packages/ai/src/router/intent-classifier.ts` line ~80: `"routine"` intent entry — "ADR-0367 — attach a routine template to a day_line". Updated in Phase 1 to cover `routine.create` / `assign_to_location` / `add_step`. (Confirm new intents are registered for Phase 1 tools per ADR-0112.)

## site-map.json (Botsson page tools) — VERIFIED

`apps/web/.botsson/site-map.json`: `getSessionTasks`, `addSessionTask` (chat-only), `toggleSessionTask`, `listTodos`, `getDayActivity`, HMS `getDriftInsights`/`getTaskStatus`, Min Dag `switchShiftTab`.

## Design conventions (Nordic Split)

Task done = teal/green; pending = orange; compliance/overdue = destructive; in_progress = warning. Cards `bg-card border-border rounded-[14px]`. Headings Instrument Serif; body Geist; data Geist Mono. Sticky headers `bg-background/80 backdrop-blur-xl`. Motion via `motionTokens.*`. **Token sweep pending (G-tokens):** ~7 files hardcode green/yellow/red instead of `taskStatus.*`/`priority.*` (ADR-0366). Phase 5.
