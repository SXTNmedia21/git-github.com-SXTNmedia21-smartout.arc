---
title: Procedure Engine — Gaps & Debt
status: in_progress
updated: 2026-05-22
created: 2026-05-20
module: procedure-engine
tags: [module, procedure-engine, gaps, debt, day-line, routine, fn-list-my-tasks, g-loc, g-team, g-expand, g-version, g-manual, g-projection]
---

# Procedure Engine — Gaps & Debt

> Verified-working vs aspirational. Severity-ranked. Every gap cites the file that proves it. The single biggest gap blocking the manager promise: **the shift→tasks join is specified in schema but rendered nowhere.**

## Severity legend
- 🔴 **BLOCKER** — blocks the Phase 1 manager promise (location-tasks shown in shifts).
- 🟠 **HIGH** — correctness / fragility risk.
- 🟡 **MEDIUM** — divergence or missing surface, workaround exists.
- ⚪ **LOW** — cleanup / consistency.

## Blockers for "location-tasks connected to shifts, shown in shift tasks"

| # | Gap | Severity | Evidence |
|---|-----|----------|----------|
| G1 | ~~`fn_list_my_tasks` doesn't project day_line_id/location_id~~ — **CORRECTED 2026-05-21 (see [FINDINGS](./FINDINGS-dayline-shift-tasks.md)):** not needed. Mobile resolves shift→day_line→tasks client-side via `use-shift-session` + `useDayLineItems`. A dedicated resolver is REDUNDANT. | ⚪ resolved | FINDINGS §2 |
| G2 | ~~No query/UI renders the shift→tasks chain~~ — **OVERTURNED 2026-05-21:** mobile DOES render it. `use-shift-session.ts:65` joins `shift_session_day_line→day_line→location`; `useDayLineItems` fetches `session_task` (+leak-filter); wired into `HomeShiftCard`/`DuringShiftView.v2`. Real residue: (a) web has no per-employee shift-tasks view (mobile-primary, ADR-0133 → OUT), (b) cron tasks lack day_line_id [G3], (c) no status gate [G6, NEW]. | 🟡 | `use-shift-session.ts:65`, `use-day-line-items.ts`, `HomeShiftCard.tsx:63-87` |
| G3 | `session_hook` fires + `engine-dispatch` set **no** `day_line_id` on spawned `session_task`. Hook/cron tasks land department-level, never reach a shift via the day_line chain → invisible to `useDayLineItems`. **THE core gap (A-ANCHOR). EXTEND-EXISTING:** mirror the `(dept_session,location)→day_line` join already in `ensure_shift_session():65-70`. | 🔴 | `session-hook-executor/index.ts:161-169`; `engine-dispatch/index.ts:787-804,2146-2170`; reuse `20260620130000:65-70` |
| G4 | Web `TasksTab` is **session-scoped** (`useSessionHooksWithTasks` filters by `department_session_id` only) — no day_line/location/shift filter. Manager view, not employee Min dag. | 🟠 | `apps/web/src/components/day/tabs/TasksTab.tsx`; `use-session-hooks-with-tasks.ts` |
| G5 | Mobile `useMyTasks` (`fn_list_my_tasks`) is the inbox path; the **shift-scoped path is the separate `useDayLineItems`** (correct). Inbox vs shift-tasks are two distinct surfaces — not a gap, a clarification. | ⚪ clarified | `use-my-tasks.ts` (inbox) vs `use-day-line-items.ts` (shift) |
| G6 | **NEW (status-gate):** `useDayLineItems`/`HomeShiftCard` show day_line tasks regardless of `shift_session.status`. Must gate on `status ∈ scheduled/clocked_in`. **EXTEND-EXISTING:** reuse `use-shift-session.ts:29` status field; one conditional (pass `shiftSessionId=null` to disable). NOT `shift-phase.ts` (time-entry signal). | 🟠 | `use-day-line-items.ts:69,149`; `use-shift-session.ts:29`; FINDINGS §2 Gap 2 |

## Routine / template instantiation

| # | Gap | Severity | Evidence |
|---|-----|----------|----------|
| G6 | **Routine expansion is a stub.** `session_hook.linked_routine_id` cron path creates ONE flat task with the routine UUID in the description — it does not expand `procedure_step` rows. The procedure path (G-contrast) fully expands. So "a list that carries a routine" yields one opaque task, not the routine's steps. | 🟠 | `session-hook-executor/index.ts:190–216` vs `:158–188` |
| G7 | `routine.attach_to_line` does **not** read the `routine` table. It takes free-form items as call parameters and delegates to `task.create_session`. There is no "expand routine X's procedure_steps into tasks" API. | 🟡 | `packages/ai/src/capabilities/routine/tools.ts:44–193` |
| G8 | No `routine_step` table. Routine steps are owned by `procedure_step` via `routine.procedure_id`. Fine structurally, but means "routine = task list" requires a 2-hop join the read surface never makes. | 🟡 | `00003_governance_tables.sql:107–127` |
| G9 | `control_list.items` is opaque JSONB — no child table, no `step_order`, no per-item `is_checked` runtime state. Cannot track checklist progress at item granularity. | 🟡 | `00003_governance_tables.sql:99` |
| G10 | No authoring UI for `routine`, `runbook`, or `control_list` in the dashboard. Seeded only via SQL templates. (`procedure` has `ProcedureBuilder.tsx`.) | 🟡 | zero hits in `apps/web/src` for routine/runbook/control_list authoring |

## Fragility of the read-normalization layer

| # | Gap | Severity | Evidence |
|---|-----|----------|----------|
| G11 | **`list_mine` TS body duplicates the RPC by hand** (ADR-0317). SQL gains a column → TS must be hand-edited or drift. Already drifted once: v2 added `hook_linked_*` not projected in TS. | 🟠 | `packages/ai/src/capabilities/task/tools.ts:41–46,128–268` |
| G12 | Four divergent table schemas (PK names, title field, status type) force a load-bearing CASE/alias normalization in both SQL and TS. Any new consumer must learn 4 shapes. | 🟠 | divergence map in DATA-MODEL §1.6 |
| G13 | `personal_task` has no `completed_at` — completion timestamp only derivable from `updated_at` (unreliable). Latent gap for any timeline/audit feature. | 🟡 | `20260520100000_personal_task.sql` |
| G14 | `schedule_day_task.task_status` is free TEXT with no CHECK — silent corruption risk; RPC falls through unknown values to 'pending'. | 🟡 | `20260301600003_schedule_persistence_tables.sql:310` |

## Authority / consistency

| # | Gap | Severity | Evidence |
|---|-----|----------|----------|
| G15 | `schedule_day_task` RLS requires `is_admin_in_workspace` but `task.create_day_ad_hoc` gates at manager+. Divergence hidden because the tool uses service_role (bypasses RLS). A direct-JWT manager write would fail. | ⚪ | `20260301600003:327–334` vs `task/tools.ts` gate |
| G16 | Push-dispatch cron for `session_task.scheduled_at` not implemented (ADR-0367 Rule 4). Column + index exist; no Edge Function selects it. Time-windowed push to clocked-in employees is dead until built. | 🟡 | `session_task.scheduled_at` index exists; no cron found |

## Setup / Authoring track (where tasks come from)

| # | Gap | Severity | Evidence |
|---|-----|----------|----------|
| G17 | **Doc-drop extracts no tasks/routines/checklists.** `analyze-setup-documents` extracts 6 categories (policies, payroll, employees, shiftPatterns, employmentTerms, handbookSections) — none of them tasks/routines/procedures. `DocumentExtractionResult` has no field for them. | 🟠 | `analyze-setup-documents/index.ts:85–110`; `wizard-state.ts:36–70` |
| G18 | **No persistence path from extracted content → task/governance tables.** Even if extracted, nothing writes `procedure_step`/`routine`/`control_list`. `onboarding.add_procedures` only writes bare `protocol`/`procedure` rows via chat. | 🟠 | `packages/ai/src/capabilities/onboarding/tools.ts:464–563` |
| G19 | **Wizard cannot pick starter routines.** `ConfirmProcedures` selects procedure *names* → bare `procedure` rows (no steps/routines/hooks). | 🟠 | `apps/web/src/app/onboarding/steps/ConfirmProcedures.tsx`; `types-v2.ts:20–59` (no routines field) |
| G20 | **Industry routine templates are never applied in live onboarding.** `supabase/templates/restaurant/*` (24 routines, 18 control_lists, 337 assignments) run **only** in the dev showcase seed; `finalize-workspace → bootstrap-cascade` does not invoke them. | 🔴 | `supabase/functions/finalize-workspace/index.ts:71–105`; `supabase/seed/doner-bros-showcase.sql:141–353` |
| G21 | **No role/position scope for compliance.** `policy_scope` enum = workspace/department/team/location (no position/role). Roles cannot carry mandatory protocols. | 🔴 | `00003_governance_tables.sql:3` |
| G22 | **`assigned_via='position'` is a dead letter.** Enum value exists; `auto_assign_protocols_to_new_employee` trigger has no position branch. | 🟠 | `20260414014856_training_schema_foundation.sql:11`; `20260429000000_fix_auto_assign_regression_v2.sql:50–57` |
| G23 | **Readiness has no per-role gate.** Computed as workspace-wide % of `protocol_assignment` completed; no "all mandatory protocols for this role done" notion. Role-capability baseline is docs-only. | 🟠 | `packages/ai/src/tools/season/get-readiness.ts:15–97`; `docs/engines/.../08-role-capability-profiles/` |
| G24 | **No unified admin task surface.** Prototype (`taskmanager-DESIGNE/`) defines Min dag / Bibliotek / Maler / task-drawer / manual-builder but is mock/in-memory. Real surfaces fragmented (TasksTab session-scoped, HMS DriftTaskList, Todo, CascadeTaskTab). No `manual_id` link on `session_task` for the Bibliotek. | 🟡 | `taskmanager-DESIGNE/README.md`; ARCHITECTURE §L4 |
| G25 | **No `is_mandatory`/`required_before_shift` flag** on `protocol`/`protocol_assignment`. `is_compliance_required` exists only per `session_task`, not at the role/protocol level. | 🟡 | `session_task` `20260412100300:79`; protocol_assignment schema |

## Adjacent debt
- Legacy telemetry aliases (`session_task.created`, `task.added_manual`) scheduled for removal ~2026-06-12; still live.
- `reconciliationLocked` hardcoded `false` in `TimelineTab.tsx:146` — day_line locked state never derived in that surface.
- `emma_task` dismiss has two parallel paths (capability `complete` via admin client + `/api/emma/tasks/dismiss` BFF).

## What is verified working
- `fn_list_my_tasks` v2 UNIONs 4 sources, multi-workspace, normalized — read inbox works.
- `task` capability 6 tools + gate + voice mirror + mobile BFF — write surface works.
- `day_line` / `shift_session` schema + triggers (`ensure_shift_session`, `day_line_back_populate`) — structure is coherent.
- `procedure → procedure_step → session_task` expansion via `session_hook.linked_procedure_id` — template path A works.
- `timeline_template.apply_template` bulk D6 materialization — path D works.
