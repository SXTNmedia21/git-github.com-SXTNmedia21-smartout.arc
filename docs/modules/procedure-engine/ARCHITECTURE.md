---
title: Procedure Engine — Architecture
status: archived
superseded_by: docs/domains/procedure-engine/
updated: 2026-05-22
created: 2026-05-20
module: procedure-engine
tags: [module, procedure-engine, architecture, code-map, capability, rpc, bff, ui, voice, telemetry]
---

# Procedure Engine — Architecture

> L1–L5 code map of the complete task system: capability tools → RPC → BFF/server actions → web + mobile UI → voice mirror → telemetry.

## L1 — Capability layer (write surface)

| Capability | File | Tools | Writes |
|---|---|---|---|
| `task` | `packages/ai/src/capabilities/task/{index,tools,gate}.ts` | `list_mine`, `create_personal`, `create_session`, `create_day_ad_hoc`, `complete`, `cancel_personal` | the 4 user-task tables (source-dispatched) |
| `day-line` | `packages/ai/src/capabilities/day-line/tools.ts` | `create`, `add_item`(task\|routine), `instantiate_template`, `update_hours` | `day_line`; delegates task writes to `task.create_session` (ADR-0240) |
| `routine` | `packages/ai/src/capabilities/routine/tools.ts` | `attach_to_line` | delegates to `task.create_session` (does NOT read `routine` table) |
| `timeline-template` | `packages/ai/src/capabilities/timeline-template/tools.ts` | `save_template`, `list_templates`, `apply_template`, `archive_template` | `timeline_template`; materializes D6 rows |
| `governance` | `packages/ai/src/capabilities/governance/tools.ts` | `check_readiness` | read-only |

**Tool detail — `task` capability:**

| Tool | Input (Zod `.strict()`) | Channel V1 | Gate |
|---|---|---|---|
| `list_mine` | `{ window_start?, window_end? }` | chat + voice | ungated (read) |
| `create_personal` | `{ title, due_at?, priority? }` | chat | `task.create_personal` |
| `create_session` | `{ session_id, title, assignee_profile_id?, hook_id?, compliance?, reason, day_line_id?, actor_capability?, delegated_via?, description?, scheduled_at? }` | chat | `task.create_session` |
| `create_day_ad_hoc` | `{ date, title, assignee_profile_id?, highlight?, category? }` | chat | `task.create_day_ad_hoc` |
| `complete` | `{ id, source: session\|personal\|day_ad_hoc\|emma }` | chat + voice | `task.complete` |
| `cancel_personal` | `{ id, reason }` | chat | `task.cancel_personal` |

`complete` is a source dispatcher (`tools.ts:741–912`): personal→self-scoped, session→sets completed_by + completedVia, day_ad_hoc→`task_status`, emma→`status='done'` via admin client. `create_session` with `day_line_id` resolves `department_session_id` server-side from the day_line row + requires `actor_capability`/`delegated_via` (ADR-0356).

## L2 — Read RPC

`fn_list_my_tasks(window_start, window_end)` — `SECURITY DEFINER`, UNION of 4 sources, `caller_profiles` CTE for multi-workspace. Migrations `20260606120100` + `20260607100100`. **`list_mine` TS body replicates this** (service_role can't use `auth.uid()`) — lockstep pair per ADR-0317.

Adjacent read RPCs: `resolve_cascade_tasks` (CascadeTaskTab — *setup* tasks, not session_task), `fn_normalize_session_task_status` / `fn_normalize_priority` (helpers).

## L3 — BFF routes & Server Actions

**BFF (mobile, Bearer JWT, `resolveMobileActor()`):**
- `POST /api/mobile/tasks` → `addTaskAction` → `createSession.execute()`
- `PATCH /api/mobile/tasks/[id]/complete` → `completeSessionTaskAction` (legacy session-only)
- `POST /api/mobile/tasks/[id]/complete` → `complete.execute()` (source-dispatched)
- `POST /api/mobile/tasks/personal` → `createPersonal.execute()`
- `/api/emma/tasks` + `/api/emma/tasks/dismiss` (emma surface)

**Server Actions (web, cookie):**
- `add-task-action.ts` → thin wrapper over `createSession.execute()` (preserves WebDayControl alias shape)
- `complete-session-task-action.ts` → shared web+mobile, accepts pre-resolved `ResolvedActor`
- `complete-task-action.ts` → cookie-path wrapper (HMS fix for client-side DB write)
- `create-day-line-action.ts` → `day-line.create`
- `add-day-line-item-action.ts` → `day-line.add_item` (task + routine branches)

## L4 — Web UI surfaces

| File | Component | Renders | Hook |
|---|---|---|---|
| `components/day/tabs/TasksTab.tsx` | TasksTab | tasks grouped by hook (pre_open…close) | `useSessionHooksWithTasks` (session-scoped) |
| `components/day/tabs/TimelineTab.tsx` | TimelineTab | day_line strips + slots | `useDayLines`, `useDayTimelineEvents` |
| `components/day/DayLineStrip.tsx` | DayLineStrip | status pill + hours popover + slot-picker + AttachRoutineDialog | `useDayLines` (props) |
| `components/day/AddTaskDialog.tsx` | AddTaskDialog | create session_task (hook selector + owner) | local |
| `app/dashboard/hms/_components/TaskCard.tsx` | TaskCard | collapsible task + evidence form + status colors | `use-session-tasks` |
| `app/dashboard/hms/_components/DriftTaskList.tsx` | DriftTaskList | list of TaskCard | `use-session-tasks` |
| `app/dashboard/_components/todo/TodoTaskView.tsx` | TodoTaskView | 4-source unified list (Min Dag) | client aggregation |
| `app/dashboard/_components/todo/TodoTaskCard.tsx` | TodoTaskCard | personal + emma cards | local |
| `app/dashboard/schedule/_components/shift-task-tag.tsx` | MalTaskTag | compact per-shift status pill (Mal grid) | prop `MalTask` (NOT session_task) |
| `components/dashboard/entity-drawer/tabs/cascade-task/CascadeTaskTab.tsx` | CascadeTaskTab | D1–D6/C1–C4 *setup* tasks + urgency | `useCascadeTasks` |

**Data hooks** (`apps/web/src/app/dashboard/_hooks/`): `use-session-hooks-with-tasks.ts` (RPC groupby hook → `DayHookRow[]`), `use-cascade-tasks.ts`, `use-cascade-task-count.ts`, `use-task-completion.ts`, `use-create-quick-task.ts`, `use-assign-task.ts`, `use-day-lines.ts`.

## L4 — Mobile UI surfaces (execute-only, ADR-0133)

| File | Component | Renders |
|---|---|---|
| `src/components/task/TaskFeed.tsx` | TaskFeed | active tasks sorted by compliance + deadline; empty "Alt klart" |
| `src/components/task/TaskModal.tsx` | TaskModal | task detail + evidence + complete |
| `src/components/task/ChecklistView.tsx` | ChecklistView | grouped checklist (maintenance/HACCP) |
| `src/hooks/queries/use-my-tasks.ts` | (hook) | `fn_list_my_tasks` (4-source UNION), MMKV offline cache |

## L4 — Voice mirror

`services/voice-agent/src/tools-task.ts` — `buildTaskTools(ask)` returns 6 thin `llm.tool()` defs forwarding to stage-engine → `task` capability. Names: `list_my_tasks`, `complete_task`, `create_personal_task`, `create_session_task`, `create_day_task`, `cancel_personal_task`. Channel policy enforced server-side (stage-engine), not in the voice agent. Voice `create_session_task` schema is intentionally narrower (no `day_line_id`/`scheduled_at`/`description`) per ADR-0298 R6 + L-0233.

## L5 — Persistence & instantiation

- **Cron** `session-hook-executor/index.ts` (every 5 min): expands `session_hook.linked_procedure_id` → one `session_task` per `procedure_step` (path A, works); `linked_routine_id` → one flat task (path B, stub).
- **Cron** `emma-task-trigger/index.ts` (every 10 min): `pending`→`triggered`.
- **Engine** `engine-dispatch/index.ts:787–805`: `assign_task` action writes `session_task` (not `engine_state_step`).
- **Triggers:** `ensure_shift_session()` (`20260620130000`), `day_line_back_populate` (`20260620130100`).

## L5 — Telemetry
`packages/telemetry/src/registry.ts`: `task created` / `task completed` / `task cancelled` + read `task.list_mine` + legacy aliases. Routing: `task created`/`completed` → PostHog + Logger + activity_trail + engine_event.

## site-map.json (Botsson page tools)
`apps/web/.botsson/site-map.json`: `getSessionTasks`, `addSessionTask` (chat-only), `toggleSessionTask`, `listTodos`, `getDayActivity`, HMS `getDriftInsights`/`getTaskStatus`, Min Dag `switchShiftTab`.

## Design conventions (Nordic Split)
Task done = teal/green; pending = orange; compliance/overdue = destructive; in_progress = warning. Headings Instrument Serif; body Geist; data Geist Mono. Cards `bg-card border-border rounded-[14px]`. Sticky headers `bg-background/80 backdrop-blur-xl`. Motion via `motionTokens.*` (no inline springs).

### MOCKUP-SOURCE HARD RULE (Pontus directive 2026-05-20)
All task-manager UI is **ported from the canonical mockups in [taskmanager-DESIGNE/](./taskmanager-DESIGNE/)** — `Task Manager.html` + `components/{min-dag,task-drawer,library,manual-builder,quiz-master,sidebar}.jsx`. **Do NOT redesign.** Pull components, tokens, interaction logic from the prototype `source/`; adapt to Nordic Split tokens + a11y. Mockup→surface map:

| Mockup component | Surface | Phase |
|---|---|---|
| `min-dag.jsx` (TaskKort 10-element, filter chips, 3 sections, Botsson-nudge, dag-meter) | Min dag home | S4 |
| `task-drawer.jsx` (subtasks, evidence, activity feed) | Task detail | S4 |
| `library.jsx` + `manual-viewer.jsx` | Bibliotek (manuals) | S4 |
| `manual-builder.jsx` (confidence-per-block) | Doc-extraction review UX | S1 |
| `quiz-master.jsx` | knowledge_test authoring | later |
| `sidebar.jsx` | Task-manager nav (Min dag/Alle/Bibliotek/Maler) | S4 |
| ghost-card toggle (ConfirmProcedures pattern) | wizard routine-picker | RP6 |
