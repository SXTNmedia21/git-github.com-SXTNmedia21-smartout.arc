---
title: "Procedure Engine — Roadmap"
status: in_progress
mirror: aspirational
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: procedure-engine
tags: [domain, procedure-engine, roadmap, phases, one-truth-many-views, adr-0298, adr-0367, adr-0387, adr-0391]
---

# Procedure Engine — Roadmap

> **Én sannhet, flere visninger.** The procedure is the atomic knowledge unit in Smartout — stored once, shown as document, training, task, deviation, and compliance. Compliance is a byproduct of actual competence, not logged documentation.
>
> This file is aspirational by design — it is the forward plan. Built-vs-planned delta lives in [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Verified current state lives in ARCHITECTURE/DATA-MODEL.
>
> **Governing ADRs:** [ADR-0391](../../decisions/0391-procedure-engine-phase1-routine-scope-provenance-cron-expansion.md) (Phase 1) · [ADR-0298](../../decisions/0298-task-ontology-five-sources.md) (Task Ontology) · [ADR-0367](../../decisions/0367-day-line-area-anchored-runtime.md) (day_line tri-layer) · [ADR-0387](../../decisions/0387-role-mandatory-compliance-hospitality-intelligence.md) (role compliance) · [ADR-0317](../../decisions/0317-fn-list-my-tasks-auth-divergence-invariant.md) (lockstep RPC↔TS)
>
> **Governing spec:** `docs/superpowers/specs/2026-05-22-procedure-engine-design.md`
> **Phase 1 plan:** `docs/superpowers/plans/2026-05-22-procedure-engine-phase-1.md`

---

## Journey status (at-a-glance)

| # | Journey | Actor | Status | Phase |
|---|---|---|---|---|
| 1 | Min dag — employee sees today's shift tasks | Employee | `in_progress` | R1 / Phase 1 |
| 2 | Location task list (day_line manager view) | Manager | `in_progress` | R1 / Phase 1 |
| 3 | Cron materializes from procedure per hook | System | `in_progress` | R1 / Phase 1 |
| 4 | Routine as real task list (steps expanded) | Manager/System | `in_progress` | Phase 1 (cron done; UI pending) |
| 5 | Personal + Emma tasks | Employee/Botsson | `live` | — |
| 6 | Manager ad-hoc day task | Manager | `live` | — |
| 7 | Read/write foundation (5 sources, 1 RPC, 1 capability) | All | `live` | — |
| 8 | Botsson setup + verification mission | Botsson | `blocked` | Phase 1 / G20 |
| 9 | Auto-compliance per role/industry/protection | System | `in_progress` | ADR-0387b (council-gated) |
| 10 | Admin defines/manages own tasks all levels | Admin | `planned` | Phase S4 |
| 11 | Doc-drop → task/routine extraction | Admin | `planned` | Phase S1 |
| 12 | Wizard: pick starter routines | Admin | `blocked` | Phase S2 / G20 |
| 13 | Time-window push-dispatch | System | `planned` | Phase R2 |

---

## Phase 1 — "Create routine, assign to location, employee sees their day" (ADR-0391)

**Falsifiable acceptance (5 deliverables):**

1. Employee with a published shift can clock in; Min dag shows only their/pickup tasks for today at that location; empty when none.
2. Admin creates "Stenge-rutine" bound to a procedure with steps; row exists; appears in routine list.
3. Routine assigned to Lokale 1 → cron materializes `session_task` with `day_line_id` for Lokale 1 that day; each task carries provenance triple (origin=routine, generated_by=cron) + expanded per step (not 1 stub).
4. Manager sets location on a shift → `shift_session.location_id` follows; Min dag filters correctly.
5. Task past due → assignee + manager notified; newly-assigned task → assignee notified.

**Schema (✅ shipped):**
- `routine.location_id`, `.workspace_id`, `.executor_type` (`20260622100000`)
- `routine_team` junction (`20260622100000`)
- `session_task.origin`, `.generated_by`, `.source_reference` (`20260622100500`)

**Capability (✅ shipped):**
- `routine.create`, `routine.assign_to_location`, `routine.add_step` (`packages/ai/src/capabilities/routine/tools.ts`)

**Cron expansion (✅ shipped):**
- `session-hook-executor/index.ts:255–290` — routine→procedure_step per-step materialization + provenance stamping + day_line anchor

**UI (🔴 pending — plan Tasks 7–10):**
- Web: RoutineForm + assign-to-location + shift location selector
- Mobile: clock-in BFF + Min dag status-gated timeline
- Notifications: overdue + newly-assigned

**Journeys to write after Phase 1:** J-proc-min-dag, J-proc-location-list, J-proc-cron-procedure, J-proc-routine-list

---

## Phase R2 — Time-window push-dispatch (planned)

ADR-0367 Rule 4: SELECT `session_task WHERE scheduled_at IN window AND day_line_id NOT NULL AND status=pending`, JOIN clocked-in `shift_session_day_line`, fan out to `shift_session.push_topic`. `scheduled_at` column + index exist; no cron reads them (gap G16).

**Journey:** J-proc-window-push

---

## Phase R3 — Routine as a real task list (residue after Phase 1)

- `routine.attach_to_line` tool reads actual `routine` table steps (gap G7 — currently takes free-form items).
- `control_list.items` per-item runtime state (gap G9).
- Full authoring UI for `routine`, `runbook`, `control_list` (gap G10).

---

## Phase S1 — Doc-drop → task/routine extraction (planned)

- `analyze-setup-documents` extracts 0 tasks/routines today (gap G17). Extend to tasks/routines/procedures.
- Persistence path from extracted content → `procedure_step`/`routine`/`control_list` (gap G18).
- Human-in-the-loop review (mirror prototype `manual-builder.jsx` confidence-per-block).

**Journey:** J-proc-doc-extraction

---

## Phase S2 — Wizard starter routines (blocked — G20)

- Wire `bootstrap-cascade/index.ts` to apply selected industry routine templates for live workspace.
- `ConfirmProcedures` selects procedure *names* only today — extend to routine selection.
- Restaurant templates (24 routines, 18 control_lists, 337 assignments) exist in `supabase/templates/restaurant/` but only run in dev seed.

**Blocked by:** G20. **Journey:** J-proc-wizard-routines

---

## Phase S3 — Role mandatory compliance (ADR-0387b, council-gated)

- Auto-assign trigger on `profile_position` INSERT reads `profession_training.is_required` (ADR-0387b B1).
- `governance.sql` templates installed as SECURITY DEFINER RPC (B2).
- `evaluateReadinessGate` rewired to `callGateAction('governance.readiness_gate')` (B3).
- Backfill existing workspaces (B4).

**ADR-0387a shipped** (profession_training revived, I1 seeded, `list_mandatory_protocols_for_role` tool). **0387b is council-gated.**

**Journey:** J-proc-role-compliance

---

## Phase S4 — Admin task surface (planned — prototype-first)

- Port entire `taskmanager-DESIGNE/` prototype: Min dag, task-drawer, Library, Maler, manual-builder, quizmaster.
- Wire to real backend via existing capability tools.
- **MOCKUP-SOURCE HARD RULE (Pontus 2026-05-20):** port from prototype to Nordic Split + tokens, do NOT redesign.

**Journey:** J-proc-admin-authoring

---

## Phase 2 — Sesjonsplanlegger admin canvas + Botsson bilde→rutine

- Timeline canvas per location (drag-from-library, block-config, recurrence). Nordic Split + new design.
- Botsson vision: image → `analyze-setup-documents` → routine extraction → `routine.create` + `routine.assign_to_location` + `procedure.add_step` per task found on sheet. Human-in-the-loop before commit.

---

## Phase 3 — Min dag full fidelity + Forbered-neste-vakt + versioning

- Min dag: full prototype fidelity (day-meter, origin-badge, 3 sections, filter-chips, Botsson-nudge).
- Forbered-neste-vakt: projection RPC of routine/hook-templates on future `schedule_shift` (gap G-projection).
- Versioning: `procedure_version` snapshot + material/non-material flag + re-confirm trigger + diff render.

---

## Phase 4 — Library + manual-render + evidence-capture

- Library: manual = procedure-render + standalone ManualGuide (`manual` table, gap G-manual).
- Evidence-capture: general photo/signature on `session_task` (port task-drawer evidence from prototype).

---

## Phase 5 — Token-sweep + Dashboard compliance-trend + mobile parity

- Token sweep: ~7 files hardcode green/yellow/red → map to `taskStatus.*`/`priority.*` tokens (ADR-0366).
- Dashboard compliance-trend (gap in OversiktDashboard).
- Mobile parity for quiz/signering.

---

## Open architecture questions (council-pending)

| # | Question | Status |
|---|---|---|
| Q1 | **4→2 task source consolidation** — merge `session_task`+`schedule_day_task` → one D6 `task`; `personal_task`+`emma_task` → one C2 `agent_task`. BEFORE first customer data locks schema. Supersedes ADR-0298/0300/0317/0344. Requires `/run-council`. | `blocked` (council pending) |
| Q2 | **Cron health as setup gate** — `fn_cron_jobs_health()` exists; should be part of Botsson setup verification + heartbeat | `planned` |
