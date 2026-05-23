---
title: "Procedure Engine — Gaps & Debt"
status: in_progress
mirror: verified
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: procedure-engine
tags: [domain, procedure-engine, gaps, debt, day-line, routine, fn-list-my-tasks, provenance, adr-0298, adr-0367, adr-0391]
---

# Procedure Engine — Gaps & Debt

> Verified-working vs aspirational. Severity-ranked. Every gap cites the file:anchor that proves it. Updated post-ADR-0391 (Phase 1 cron expansion confirmed).
> `mirror: verified` — all gaps checked against code 2026-05-22.

## Severity legend

| Icon | Meaning |
|---|---|
| 🔴 BLOCKER | Blocks the Phase 1 manager promise or a major journey |
| 🟠 HIGH | Correctness/fragility risk |
| 🟡 MEDIUM | Divergence or missing surface, workaround exists |
| ⚪ LOW | Cleanup/consistency; no user impact |

---

## §1. Phase 1 runtime gaps (ADR-0391 scope)

| # | Gap | Severity | Evidence |
|---|-----|----------|----------|
| G1 | ~~`fn_list_my_tasks` doesn't project day_line_id~~ — RESOLVED per FINDINGS-dayline-shift-tasks.md. Mobile resolves via `use-shift-session.ts:65` + `useDayLineItems`. Dedicated resolver redundant. | ⚪ resolved | FINDINGS §2 |
| G2 | ~~No query/UI renders shift→tasks chain~~ — OVERTURNED. Mobile DOES render it: `use-shift-session.ts:65` joins `shift_session_day_line→day_line→location`; `useDayLineItems` fetches `session_task`. Residue: (a) web has no per-employee shift-tasks view (mobile-primary, ADR-0133 → OUT), (b) status gate missing (G6), (c) cron tasks lack day_line_id (G3). | 🟡 | `apps/mobile/src/hooks/queries/use-shift-session.ts:65`, `use-day-line-items.ts:69,149` |
| G3 | **Cron/hook tasks may still have `day_line_id=NULL`** if the session has zero or multiple day_lines. `session-hook-executor` now calls `fn_resolve_single_day_line` (ADR-0391); function returns NULL for 0 or >1 active day_lines (ADR-0367 Rule). Tasks with NULL anchor are dept-level (visible in TasksTab, invisible in shift-chain). Full resolution: wire routine's `location_id` through hook upsert (Phase 1 Task 5). | 🟠 | `session-hook-executor/index.ts:205–230`; `fn_resolve_single_day_line` (`20260621200103`) |
| G4 | Web `TasksTab` is session-scoped (`useSessionHooksWithTasks` filters by `department_session_id` only) — no day_line/location/shift filter. Manager view, not employee Min dag. | 🟠 | `apps/web/src/components/day/tabs/TasksTab.tsx`; `use-session-hooks-with-tasks.ts` |
| G5 | Mobile `useMyTasks` (`fn_list_my_tasks`) is the inbox path; the shift-scoped path is the separate `useDayLineItems` (correct). Inbox vs shift-tasks are two distinct surfaces — not a gap, a clarification. | ⚪ clarified | `apps/mobile/src/hooks/queries/use-my-tasks.ts` (inbox) vs `use-day-line-items.ts` (shift) |
| G6 | **Status gate missing** — `useDayLineItems`/`HomeShiftCard` show day_line tasks regardless of `shift_session.status`. Must gate on `status ∈ {scheduled, clocked_in}`. EXTEND-EXISTING: reuse `use-shift-session.ts:29` status field. | 🟠 | `apps/mobile/src/hooks/queries/use-day-line-items.ts:69,149`; `use-shift-session.ts:29` |
| G7 | **Clock-in BFF not built.** `POST /api/mobile/shift-session/[id]/clock-in` — sets `shift_session.status='clocked_in'`, `clocked_in_at=now()`. Phase 1 Plan Task 9. | 🔴 | Plan `2026-05-22-procedure-engine-phase-1.md` Task 9 |
| G8 | **RoutineForm not built.** Web authoring UI for creating a routine + assigning to location + team. Phase 1 Plan Task 7. Prototype: `taskmanager-DESIGNE/`. | 🔴 | Plan Task 7 |
| G9 | **Notifications not built.** Overdue detection (status→overdue) + assignment notification via notification engine. Phase 1 Plan Task 10. | 🔴 | Plan Task 10 |
| G10 | **Shift location selector missing.** `schedule_shift.location_id` exists — no UI button to set/change it. Phase 1 Plan Task 8. | 🔴 | Plan Task 8; `apps/web/src/components/day/` shift editor |

---

## §2. Routine / template instantiation

| # | Gap | Severity | Evidence |
|---|-----|----------|----------|
| G11 | `routine.attach_to_line` does NOT read the `routine` table. It takes free-form items and delegates to `task.create_session`. No "expand routine X's steps into tasks" API. The cron expansion (G-expand, closed by ADR-0391) is NOT available via the capability tool path. | 🟡 | `packages/ai/src/capabilities/routine/tools.ts:44–193` |
| G12 | No `routine_step` table. Steps are owned by `procedure_step` via `routine.procedure_id`. A 2-hop join the read surface never makes (`routine → procedure_id → procedure_step`). | 🟡 | `supabase/migrations/00003_governance_tables.sql:107–127` |
| G13 | `control_list.items` is opaque JSONB — no child table, no `step_order`, no per-item `is_checked` runtime state. Cannot track checklist progress at item granularity. | 🟡 | `supabase/migrations/00003_governance_tables.sql:92` |
| G14 | No authoring UI for `routine`, `runbook`, or `control_list` in the dashboard. Only `procedure` has `ProcedureBuilder.tsx`. | 🟡 | zero hits in `apps/web/src` for routine/runbook/control_list authoring (verified grep 2026-05-22) |

---

## §3. Read-normalization fragility

| # | Gap | Severity | Evidence |
|---|-----|----------|----------|
| G15 | **`list_mine` TS body duplicates the RPC by hand** (ADR-0317). SQL gains a column → TS must be hand-edited or drift. Already drifted once: v2 added `hook_linked_*` not projected in TS. Neither `origin`/`generated_by`/`source_reference` (Phase 1 additions) are projected yet. | 🟠 | `packages/ai/src/capabilities/task/tools.ts:41–46,128–268` |
| G16 | Four divergent table schemas (PK names, title field, status type) force load-bearing CASE/alias normalization in both SQL and TS. Any new consumer must learn 4 shapes. | 🟠 | DATA-MODEL §1 divergence map |
| G17 | `personal_task` has no `completed_at` — completion timestamp derivable only from `updated_at` (unreliable). Latent gap for timeline/audit. | 🟡 | `supabase/migrations/20260520100000_personal_task.sql` |
| G18 | `schedule_day_task.task_status` is free TEXT with no CHECK — silent corruption risk; RPC falls through unknown values to `pending`. | 🟡 | `supabase/migrations/20260301600003_schedule_persistence_tables.sql:310` |

---

## §4. Authority / consistency

| # | Gap | Severity | Evidence |
|---|-----|----------|----------|
| G19 | `schedule_day_task` RLS requires `is_admin_in_workspace` but `task.create_day_ad_hoc` gates at manager+. Divergence hidden because tool uses service_role (bypasses RLS). A direct-JWT manager write would fail. | ⚪ | `20260301600003:327–334` vs `task/tools.ts` gate |
| G20 | **Push-dispatch cron for `scheduled_at` not implemented** (ADR-0367 Rule 4). Column + index exist; no Edge Function selects them. Time-windowed push dead until Phase R2. | 🟡 | `session_task.scheduled_at` index exists; no cron found |
| G21 | **`routine.created` telemetry event** — registered in `tools.ts:326` but routing in `packages/telemetry/src/registry.ts` not verified (not grepped). Check `SmartoutEvent` union + `EVENT_ROUTING` for `"routine.created"`. | 🟠 | `packages/ai/src/capabilities/routine/tools.ts:326`; `packages/telemetry/src/registry.ts` unverified |

---

## §5. Overlap edges (seam decisions)

### §5a procedure-engine ↔ day-session (PRIMARY SEAM)

**Shared surface:** `session_task` table.

**Classification: keep** — clear author/consumer split with shared DDL.

**Seam decision:**
- **DDL ownership:** `session_task` DDL is co-owned. The table lives in the D6 session anchor (day-session manages the `department_session_id` lifecycle, the status machine, and the connection to `session_hook`). Procedure-engine generates the rows via `session-hook-executor` (cron) and `task` capability tools.
- **day-session README:** lists `session_task` in "Owning tables" because it manages the session lifecycle (`session_hook_executor` EF) and the D6 runtime structure.
- **procedure-engine:** generates task content (procedure steps → task instances), stamps provenance triple, defines task schema additions (ADR-0391 columns).
- **Division of labor:**
  - day-session: `session_hook` template DDL, `department_session` lifecycle, `session-hook-executor` EF dispatch trigger + timing, `ensure_shift_session()` trigger. Writes the task rows at the right moment.
  - procedure-engine: governance content being materialized (`procedure_step` → task title/compliance), provenance stamping, task capability read/write surface (`fn_list_my_tasks` + `task` tools), task completion flows.
- **Practical rule:** when changing `session_task` schema, notify both domain owners. When changing task content/provenance columns, procedure-engine leads. When changing session timing/dispatch logic, day-session leads.

**Seam anchor:** `session_hook.linked_procedure_id` / `linked_routine_id` — hooks authored by procedure-engine, dispatched at runtime by day-session's cron. `session-hook-executor/index.ts` sits at the seam (reads governance content, writes D6 tasks).

### §5b procedure-engine ↔ task-ontology (ADR-0298)

**Shared surface:** `fn_list_my_tasks` + `task` capability span all five sources including `personal_task` + `emma_task` + `schedule_day_task` which are not session-anchored.

**Classification: keep** — the task ontology read/write surface is part of procedure-engine's responsibility per ADR-0298. The "five sources, one RPC, one capability" architecture centralizes read access here.

### §5c procedure-engine ↔ governance / I1 (ADR-0387)

**Shared surface:** `profession_training` table (role→mandatory-protocol map).

**Classification: keep** — `profession_training` is K1a/K1b knowledge seeded by I1 (`hospitalityPackage`), consumed by procedure-engine's `governance.list_mandatory_protocols_for_role` tool. No dual ownership.

---

## §6. Setup / authoring track gaps

| # | Gap | Severity | Evidence |
|---|-----|----------|----------|
| G22 | **Doc-drop extracts no tasks/routines/checklists.** `analyze-setup-documents` extracts 6 categories but none of them tasks/routines/procedures. `DocumentExtractionResult` has no field for them. | 🟠 | `supabase/functions/analyze-setup-documents/index.ts:85–110`; `wizard-state.ts:36–70` |
| G23 | **Industry routine templates never applied in live onboarding.** `supabase/templates/restaurant/*` (24 routines, 18 control_lists, 337 assignments) run only in dev showcase seed; `finalize-workspace → bootstrap-cascade` never invokes them. | 🔴 | `supabase/functions/finalize-workspace/index.ts:71–105`; `supabase/seed/doner-bros-showcase.sql:141–353` |
| G24 | **No role/position scope for compliance.** `policy_scope` enum = workspace/department/team/location (no position/role). Roles cannot carry mandatory protocols. (ADR-0387b, council-gated.) | 🔴 | `supabase/migrations/00003_governance_tables.sql:3` |
| G25 | **`assigned_via='position'` is a dead letter.** Enum value exists; `auto_assign_protocols_to_new_employee` trigger has no position branch. (ADR-0387b B1.) | 🟠 | `supabase/migrations/20260414014856_training_schema_foundation.sql:11`; `20260429000000_fix_auto_assign_regression_v2.sql:50–57` |
| G26 | **Readiness has no per-role gate.** Computed as workspace-wide % of `protocol_assignment` completed. (ADR-0387b B3.) | 🟠 | `packages/ai/src/tools/season/get-readiness.ts:15–97` |
| G27 | **No unified admin task surface.** Prototype (`taskmanager-DESIGNE/`) defines Min dag/Bibliotek/Maler/task-drawer/manual-builder/quizmaster but is mock/in-memory. Real surfaces fragmented. | 🟡 | `docs/modules/procedure-engine/taskmanager-DESIGNE/README.md`; ARCHITECTURE §L4 |
| G28 | **No `manual` table.** `manual_type` standalone documents (routine_overview/procedure_intro/qna/general + polymorphic FK) not migrated. Distinct from `procedure_step.training_content`. | 🟡 | DATA-MODEL §5 gap tables |

---

## §7. Adjacent debt

- Legacy telemetry aliases (`session_task.created`, `task.added_manual`) scheduled for removal ~2026-06-12; still live.
- `reconciliationLocked` hardcoded `false` in `TimelineTab.tsx:146` — day_line locked state never derived.
- `emma_task` dismiss has two parallel paths (capability `complete` via admin client + `/api/emma/tasks/dismiss` BFF).
- G-tokens: ~7 files hardcode green/yellow/red instead of `taskStatus.*`/`priority.*` tokens (ADR-0366). Phase 5.

---

## §8. What is verified working (Phase 1 baseline)

- `fn_list_my_tasks` v2 UNIONs 4 sources, multi-workspace, normalized — read inbox works.
- `task` capability 6 tools + gate + voice mirror + mobile BFF — write surface works.
- `day_line` / `shift_session` schema + triggers (`ensure_shift_session`, `day_line_back_populate`) — structure coherent.
- `procedure → procedure_step → session_task` expansion via `session_hook.linked_procedure_id` (path A) — with provenance triple + day_line anchor. ✅
- `routine → procedure → procedure_step → session_task` expansion via `session_hook.linked_routine_id` (path B, G-expand CLOSED by ADR-0391) — with provenance triple + day_line anchor. ✅
- `timeline_template.apply_template` bulk D6 materialization (path D) — works.
- `routine.location_id`, `routine.workspace_id` (trigger-backfilled), `routine.executor_type`, `routine_team` junction — schema shipped and RLS confirmed. ✅
- `session_task.origin`, `generated_by`, `source_reference` provenance columns — schema shipped. ✅
- `routine.create`, `routine.assign_to_location`, `routine.add_step` capability tools — shipped in `packages/ai/src/capabilities/routine/tools.ts`. ✅
- ADR-0387a: `profession_training` revived, I1 seeding, `list_mandatory_protocols_for_role` tool. ✅
