---
title: Module — Task Manager
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: task-manager
tags: [module, task-manager, task-ontology, five-sources, day-line, routine, procedure, adr-0298, adr-0367]
---

# Module — Task Manager

> Authoritative module doc for Smartout's complete task system. If code contradicts this doc → CODE wins, update this doc.

## 1. Overview

"Task" in Smartout is an overloaded word that spans **three subsystems that grew separately**. The Task Manager module is the contract that unifies them. Before this module existed, the only formal unification was the *read/write* layer (ADR-0298); the *structural anchoring* (ADR-0367 day_line) and the *template* layer (governance procedure/routine) were documented elsewhere and never tied to the task surface end-to-end.

The unified model has **three orthogonal axes**:

```
TEMPLATE axis   ──instantiate──▶   INSTANCE axis   ──anchored by──▶   ANCHOR axis
(reusable defn)                    (completable row)                  (where / when)

procedure (+steps)                 session_task          ◀── day_line (location + window)
routine (procedure + trigger)      schedule_day_task           department_session (dept + date)
control_list (checklist)           personal_task         ◀── shift_session (employee + shift)
timeline_template (day program)    emma_task                   shift_session_day_line (M:N)
                                   [engine_state_step = control plane, NOT a user task]
```

Read everything through `fn_list_my_tasks` (RPC) + per-surface hooks. Write everything through the `task` capability (delegated to by `day-line`, `routine`, `timeline-template`).

**Plain-language mapping of the manager's promise:**

| Manager says | System object |
|---|---|
| "a task list attached to a location" | `day_line` (`location_id` NOT NULL, `planned_open`/`planned_close`) |
| "each task is a thing to complete within a time window" | `session_task` with `day_line_id` + `scheduled_at` |
| "the list can also carry routines" | a `session_hook` (with `linked_routine_id`/`linked_procedure_id`) attached to the day_line, expanding into `session_task` rows |
| "a routine is also a task list" | `routine → procedure → procedure_step` (ordered steps) |
| "show up inside the shift" | `shift_session → shift_session_day_line → day_line → session_task` |

## 2. Cascade Placement

The task system is **multi-dimension by design** — that is precisely why a unifying module is needed.

| Source | Cascade role | Lives in |
|---|---|---|
| `session_task` | **D6 Production** | runtime "what is happening today" |
| `schedule_day_task` | **D6 Production** (ad-hoc, date-anchored) | manager-curated day tasks |
| `personal_task` | **C2 Agent-Utility** | user-curated via agent |
| `emma_task` | **C2 Agent-Utility** (agent-curated, max-3) | Botsson auto-reminders |
| `engine_state_step` | **C2 Workflow Runtime** (control plane) | *excluded* from the task surface (ADR-0298 R2) |
| `procedure` / `routine` / `control_list` | **Governance content** (templates) | reusable definitions |
| `day_line` / `shift_session` | **D6 Production** (structure) | location + employee anchoring |

The anchor structure consumes from D1 (department, location, operating hours → `planned_open`/`planned_close`), D2 (profile/shift/absence → assignee + `shift_session`), and D5 (`timeline_template` seeds day_lines per area). C4 governs **who/what is allowed to create or complete** a task (`gate_action`).

> **Confident ≠ Authorized.** An agent may *know* a task should be created (C1/C2 inference) but only C4 authority permits the write. Every `task.create_*` / `complete` tool calls `gate_action`.

## 3. The Three Subsystems

### 3.1 Read/Write Unification (ADR-0298 — shipped)

Option C "Hybrid": five domain-pure tables stay; one RPC unifies reads; one capability unifies writes.

- **Read:** `fn_list_my_tasks(window_start, window_end)` — `SECURITY DEFINER`, UNIONs four sources (not `engine_state_step`), normalizes status/priority/title across divergent schemas, supports multi-workspace UNION via `caller_profiles` CTE.
- **Write:** `task` capability, 6 tools — `list_mine`, `create_personal`, `create_session`, `create_day_ad_hoc`, `complete`, `cancel_personal`.
- **Channel policy (R6):** `list_mine` + `complete` = chat + voice; all `create_*` + `cancel_personal` = chat-only V1 (free-text PII risk).
- **Sync invariant (ADR-0317):** the capability's `list_mine` body does **not** call the RPC (service_role → `auth.uid()` NULL → zero rows); it replicates the 4-arm UNION with explicit `ctx.workspaceId`/`ctx.profileId`. SQL and TS must change in lockstep.

### 3.2 D6 Production Structure (ADR-0367 — schema shipped, wiring partial)

The tri-layer anchor:

```
department_session  (aggregate: workspace + dept + date; payroll-anchored; NO location)
  ├── day_line       (program: + location_id NOT NULL + planned_open/close; UNIQUE(dept_session, location))
  │     └── session_task (day_line_id nullable; scheduled_at nullable)
  └── shift_session  (runtime: 1:1 schedule_shift; + location_id + employee_id; status scheduled→clocked_in→clocked_out)
        └── shift_session_day_line (M:N day_line — a shift can span multiple areas)
```

`day_line` status is **derived, never stored** (`derive-day-line-status.ts`): locked → cancelled → draft → closed → active. Triggers keep the structure coherent: `ensure_shift_session()` (shift insert → shift_session + junction), `day_line_back_populate` (day_line insert → junction).

### 3.3 Governance Templates (schema shipped, instantiation partial)

```
policy → protocol → { procedure(+procedure_step) | routine | control_list | runbook | knowledge_test | confirmation }
```

- `procedure` + `procedure_step` = the real ordered task-list template (each step has `step_order`, `is_required`, `estimated_minutes`).
- `routine` = `procedure_id` + `trigger_type`(scheduled|event) + `trigger_config` (jsonb times/days) + optional `control_list_id` + `control_frequency`. **A routine has no step table of its own — its steps are the linked procedure's steps.**
- `control_list` = JSONB `items` (no child table, no ordering, no per-item runtime state).

**Instantiation paths (template → `session_task`):**

| Path | Mechanism | Status |
|---|---|---|
| A — procedure | `session_hook.linked_procedure_id` → cron expands `procedure_step` → one `session_task` per step | **complete** (`session-hook-executor`) |
| B — routine | `session_hook.linked_routine_id` → cron creates **one flat task** with routine UUID in description | **STUB** (steps not expanded) |
| C — agent routine | `routine.attach_to_line` tool takes free-form items → delegates to `task.create_session` | works, but **does not read the `routine` table** |
| D — day program | `timeline_template.apply_template` materializes hooks/tasks/notes/shifts in bulk | **complete** (D6-level) |

## 4. Surface Contract

| Surface | Reads | Writes | Notes |
|---|---|---|---|
| Web — TasksTab (Dagslinjen) | `useSessionHooksWithTasks` (session-scoped, grouped by hook) | `add-task` / `toggle-session-task` / `complete-session-task` actions | session-scoped, **no day_line/shift filter today** |
| Web — HMS DriftTaskList / TaskCard | `use-session-tasks` | evidence-capture completion | HACCP/maintenance, evidence JSONB |
| Web — Todo / Min Dag | client aggregation of 4 sources | `useCreateQuickTask` | personal + emma surface |
| Web — CascadeTaskTab (drawer) | `useCascadeTasks` (`resolve_cascade_tasks`) | inline-edit / "Gå til" | *setup* tasks, not session_task |
| Mobile — TaskFeed / TaskModal / ChecklistView | `useMyTasks` (`fn_list_my_tasks`) | `/api/mobile/tasks/*` BFF | execute-only per ADR-0133; **no day_line/shift filter today** |
| Voice | `list_my_tasks` / `complete_task` | (chat-only creates) | thin mirror → stage-engine → `task` capability |
| Agent (chat) | `task.list_mine` | all 6 tools | full surface |

## 5. Authority & Telemetry

- **Authority:** `task` capability `defaultAuthority='suggest'`, gates each mutating tool via `gate_action(p_capability='task', action_type)`. Fails closed on RPC error (L-0066/L-0097). `create_session` via `day_line_id` requires `actor_capability` + `delegated_via` for audit symmetry (ADR-0356).
- **Telemetry:** canonical family `task created` / `task completed` / `task cancelled` (+ legacy 30-day aliases `session_task.created`, `session_task.assigned`, `task.added_manual`). `task created`/`completed` route to PostHog + Logger + `activity_trail` + `engine_event`; `cancelled` skips `engine_event`; `task.list_mine` is read-only (PostHog + Logger only).

## 6. Invariants

1. Every task row belongs to exactly one of five sources (ADR-0298 R1). New table = ADR amendment.
2. `engine_state_step` is NEVER in `fn_list_my_tasks` or the `task` capability (R2).
3. `fn_list_my_tasks` SQL ⇔ `list_mine` TS body are a lockstep pair (ADR-0317).
4. `workspace_id` / `profile_id` / `completed_by` always server-derived (ADR-0151, R4). Exception: `assignee_profile_id` on `create_session`, BFF verifies membership.
5. Every UPDATE RLS policy on a task table has USING + WITH CHECK (R5).
6. Cross-namespace writes to `session_task` go through `task.create_session` (ADR-0240).
7. `day_line` is uniquely `(department_session_id, location_id)`; a task is area-anchored iff `day_line_id` is set, else department-level.
8. Mobile is thin/execute-only (ADR-0133); web composes/authors.

## 7. Open Direction

The module has **two halves** (see [BLUEPRINT.md](./BLUEPRINT.md)):

- **Runtime track (R):** the join nobody rendered yet — `schedule_shift → shift_session → shift_session_day_line → day_line → session_task`, plus exposing `day_line_id`/`scheduled_at`/`location_id` through the read RPC (Phase R1 = the manager promise). Then push dispatch (R2) and real routine expansion (R3).
- **Setup/authoring track (S):** where tasks come from — document-drop task/routine extraction (S1, doc-drop works but extracts no tasks today), wizard starter-routine selection (S2, templates exist but only run in dev seed), role→mandatory compliance tasks (S3, `policy_scope` has no position/role today), and wiring the prototype admin surface (S4).

Hardening (H) collapses the four divergent table schemas behind a stable view and retires the hand-maintained `fn_list_my_tasks` ↔ `list_mine` duplication. See [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) for the 25 verified gaps that drive these phases.
