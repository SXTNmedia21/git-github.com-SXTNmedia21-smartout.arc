---
title: Task Manager Module — Blueprint Index
status: in_progress
updated: 2026-05-20
created: 2026-05-20
module: task-manager
tags: [module, task-manager, task-ontology, day-line, routine, adr-0298, adr-0367, source-of-truth]
---

# Task Manager Module — Blueprint & Source of Truth

> Authoritative blueprint for Smartout's complete task system. If code contradicts this folder → CODE wins, update these docs.

## What this module is

The Task Manager is the **unifying lens over every "thing a person must do"** in Smartout. It is not one table or one surface — it is the contract that ties together three independently-grown subsystems:

1. **Read/Write unification** (ADR-0298, *shipped*) — five task sources, one read RPC (`fn_list_my_tasks`), one write capability (`task`).
2. **D6 Production structure** (ADR-0367, *schema shipped, wiring partial*) — `department_session → day_line (location + time-window) → session_task`, with `shift_session` linking employees to areas.
3. **Governance templates** (*schema shipped, instantiation partial*) — `procedure`(+`procedure_step`) / `routine` / `control_list` as reusable definitions that materialize into runtime `session_task` rows.

The product promise the manager experiences: **"create a task list attached to a location, where each task has a time window, the list can also carry routines, and the tasks show up inside the relevant shifts."** Structurally, a **`day_line` is that location-anchored task list with a time window**; a **`session_task` is a task inside it**; a **`routine` is a procedure run on a schedule** (itself a task-list template).

## Two halves

The module spans a **Setup/Authoring track** (where tasks come from) and a **Runtime track** (where they live + get done):

```
SETUP: doc-drop · wizard routines · role compliance · admin surface  ──produce──▶  RUNTIME: day_line · shift tasks · complete
```

## Status

**Runtime track:**
- **Read unification (ADR-0298):** shipped 2026-05-13. 5 sources, `fn_list_my_tasks` v2, `task` capability (6 tools), voice mirror, mobile BFF.
- **D6 day_line structure (ADR-0367):** schema shipped (8 migrations `20260620*`). Tasks can carry `day_line_id` + `scheduled_at`. Shift-tasks view + RPC projection = open gap (Phase R1).
- **Routine expansion:** `procedure → step → session_task` works; `routine` expansion is a **stub** (Phase R3).

**Setup/authoring track:**
- **Doc-drop:** works for 6 categories (policy/payroll/employees/shifts/terms/handbook); extracts **no tasks/routines** (Phase S1).
- **Wizard starter routines:** admin picks procedure *names* only; industry routine templates exist but run **only in dev seed**, not live onboarding (Phase S2).
- **Role mandatory compliance:** **absent** — `policy_scope` has no position/role; readiness has no per-role gate (Phase S3).
- **Admin surface:** prototype (`taskmanager-handoff/`) holds the full vision but is mock/unwired (Phase S4).

**Priority:** Phase R1 (location-tasks → shift view) delivers the manager promise + demo. See [BLUEPRINT.md](./BLUEPRINT.md) for both tracks + falsifiable acceptance.

## Reading order

| # | Doc | Purpose |
|---|-----|---------|
| 1 | [MODULE_TASK_MANAGER.md](./MODULE_TASK_MANAGER.md) | Main module doc — the unified model, cascade placement, the three axes (template / instance / anchor), surface contract, authority, invariants |
| 2 | [DATA-MODEL.md](./DATA-MODEL.md) | All 13 tables, the 5-source schema with FK + naming divergences, `fn_list_my_tasks` projection, telemetry events, RLS |
| 3 | [ARCHITECTURE.md](./ARCHITECTURE.md) | L1–L5 code map: capability tools, RPC, BFF routes, server actions, web + mobile UI surfaces, voice mirror, telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | Manager / employee / agent journeys across template authoring → instantiation → completion |
| 5 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | Verified-working vs aspirational. 16 gaps classified by severity. The fragility of the read-normalization layer. |
| 6 | [BLUEPRINT.md](./BLUEPRINT.md) | Phased plan. Phase 1 = location-tasks → shift-tasks view. Falsifiable acceptance per phase. |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | Web Playwright + mobile + capability units + manual matrix |

Design prototype: [taskmanager-handoff/](./taskmanager-handoff/) — interactive HTML/JSX handoff (library, task-drawer, min-dag, quiz-master, manual-builder).

## Cross-references

### ADRs
- **Accepted:** [ADR-0298](../../decisions/0298-task-ontology-five-sources.md) (five sources, one read RPC, one capability), [ADR-0367](../../decisions/0367-day-line-area-anchored-runtime.md) (day-line tri-layer), ADR-0317 (list_mine ↔ RPC sync invariant), ADR-0356 (audit symmetry on delegated writes)
- **Adjacent:** ADR-0078 (channel restrictions), ADR-0099 (gate_action), ADR-0114 (Server Actions), ADR-0132 (mobile AI routing), ADR-0133 (mobile boundary — web composes, mobile executes), ADR-0134 (mobile telemetry contract), ADR-0151 (server-resolved IDs), ADR-0156 (WebDayControl canonical admin surface), ADR-0173/0240 (frozen capability boundaries, cross-namespace delegation), ADR-0204 (gatedMutation), ADR-0287 (gate_action mandatory), ADR-0297 (workforce snapshot bootstrap), ADR-0335 (timeline templates)
- **Sibling module:** [daytimeline/](../daytimeline/) — the D6 Dagslinjen surface that renders day_lines; the Task Manager owns the task *content*, daytimeline owns the *strip*.

### Code locations (entry points)
- **Capability:** `packages/ai/src/capabilities/task/` (6 tools), `packages/ai/src/capabilities/day-line/` (4 tools), `packages/ai/src/capabilities/routine/` (`attach_to_line`), `packages/ai/src/capabilities/timeline-template/` (4 tools)
- **Read RPC:** `supabase/migrations/20260606120100_fn_list_my_tasks.sql` + `20260607100100_fn_list_my_tasks_v2_hook_links.sql`
- **BFF:** `apps/web/src/app/api/mobile/tasks/{route,[id]/complete,personal}.ts`
- **Server actions:** `apps/web/src/app/dashboard/_actions/{add-task,complete-session-task,complete-task,create-day-line,add-day-line-item}-action.ts`
- **Web UI:** `apps/web/src/components/day/tabs/TasksTab.tsx`, `apps/web/src/app/dashboard/hms/_components/{TaskCard,DriftTaskList}.tsx`, `apps/web/src/app/dashboard/_components/todo/`
- **Mobile UI:** `apps/mobile/src/components/task/{TaskFeed,TaskModal,ChecklistView}.tsx`, `apps/mobile/src/hooks/queries/use-my-tasks.ts`
- **Voice mirror:** `services/voice-agent/src/tools-task.ts`
- **Telemetry:** `packages/telemetry/src/registry.ts` (`task created` / `task completed` / `task cancelled` + legacy aliases)
- **Schema:** `supabase/migrations/00003_governance_tables.sql`, `20260412100300_session_infrastructure.sql`, `20260520100000_personal_task.sql`, `20260311042814_emma_task.sql`, `20260301600003_schedule_persistence_tables.sql`, `20260620120200_day_line_table.sql` … `20260620120700_day_line_backfill.sql`

## Authoring rules

- All task mutations gate via `gate_action` / `gatedMutation` (ADR-0204/0287). No direct browser writes.
- All mutations emit telemetry via `emit()`. Register in BOTH `SmartoutEvent` union AND `EVENT_ROUTING` (recurrence trap — L-NEW telemetry-without-emit class).
- Server-side ID derivation per ADR-0151 — body-supplied `workspace_id` / `profile_id` rejected.
- Cross-namespace writes delegate to the owning capability (ADR-0240): `routine` and `day-line` write `session_task` only through `task.create_session`.
- `fn_list_my_tasks` SQL and the `list_mine` TS body are a **lockstep pair** (ADR-0317) — any column change to one must be mirrored in the other.
- Mobile remains thin / execute-only (ADR-0133). No authoring UIs on mobile.
- Voice channel restrictions per ADR-0078 — V1 authoring stays chat-only; `list_mine` + `complete` are voice-safe.

## Glossary

- **Task (instance)** — a single completable work-item belonging to exactly one of five sources.
- **Five sources** — `session_task` (D6), `schedule_day_task` (D6 ad-hoc), `personal_task` (C2 user), `emma_task` (C2 agent), `engine_state_step` (control-plane, *excluded* from the task surface).
- **`fn_list_my_tasks`** — `SECURITY DEFINER` RPC that UNIONs the first four sources into a normalized read shape.
- **`task` capability** — the single write surface: `list_mine`, `create_personal`, `create_session`, `create_day_ad_hoc`, `complete`, `cancel_personal`.
- **`day_line`** — the location-anchored program strip for one area on one date; `(department_session_id, location_id)` unique; carries `planned_open`/`planned_close` (the time window). Functions as the "task list attached to a location."
- **`shift_session`** — per-employee runtime row, 1:1 with `schedule_shift`; M:N to `day_line` via `shift_session_day_line` — the join that powers a "shift tasks" view.
- **Template axis** — `procedure`(+`procedure_step`) / `routine` / `control_list` / `timeline_template`: reusable definitions.
- **Instance axis** — the five sources: actual completable rows.
- **Anchor axis** — `department_session → day_line → session_task` + `shift_session`: where/when a task lives.
- **Routine** — a `procedure` (ordered steps) plus trigger metadata (`scheduled` / `event`) and an optional `control_list`. A routine *is* a task-list template; "carrying a routine" means instantiating its steps under a day_line.
- **Control list** — a JSONB checklist (compliance proof). No step table, no per-item runtime state today.
- **L-0066** — default-allow CVE class. Unseeded capability = gate no-op. Every new capability needs a seed migration.
