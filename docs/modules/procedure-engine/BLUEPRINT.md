---
title: Procedure Engine — Implementation Blueprint
status: archived
superseded_by: docs/domains/procedure-engine/
updated: 2026-05-22
created: 2026-05-20
module: procedure-engine
tags: [module, procedure-engine, blueprint, phases, day-line, shift-tasks, doc-extraction, wizard, role-compliance, admin-ia, manual, routine, one-truth-many-views]
---

# Procedure Engine — Implementation Blueprint

> Phased plan to deliver the full task system. The module has **two halves**: a **Setup/Authoring track** (where tasks come from — documents, wizard, role compliance, the admin surface) and a **Runtime track** (where tasks live and get done — day_line, shift, completion). Most schema already exists; much of the work is *wiring*. Each phase has falsifiable acceptance.

## The two halves

```
SETUP / AUTHORING track                          RUNTIME track
─────────────────────                            ─────────────
doc-drop → extract tasks/routines  ┐
wizard → pick starter routines     ├─ produce ──▶ session_task / day_line ──▶ shift_session ──▶ complete
role → mandatory compliance tasks  ┘                     │
admin surface (Min dag / Bibliotek / Maler) ◀── manage ──┘
```

The runtime track was Phase 1–5 in the prior draft (now **Track R**). The setup track (**Track S**) answers "where do tasks come from," which the manager promise also depends on: a manager doesn't hand-type every task — they drop a document, pick routines in the wizard, and roles auto-receive their mandatory compliance work.

**Design anchor for the admin surface:** `taskmanager-DESIGNE/` is the canonical, already-approved visual + interaction spec (Min dag, TaskKort with 10 elements, Bibliotek/Maler, task-drawer, manual-builder, quizmaster). It is mock/in-memory today — Track S4 wires it to the real backend. **Do not redesign — port from the prototype.**

---

# Track R — Runtime (deliver the manager promise first)

## Phase R1 — Location tasks visible in shifts 🎯 (was Phase 1)

**Goal:** A manager creates tasks on a location's day_line (within its time window); the assigned employee sees exactly those tasks inside their shift.

**Scope (wiring, minimal new SQL):**
1. Extend `fn_list_my_tasks` ARM 1 to project `day_line_id`, `scheduled_at`, `location_id` (LEFT JOIN day_line). Mirror in `list_mine` TS body (ADR-0317 lockstep).
2. Shift resolver: `p_shift_session_id` param on `fn_list_my_tasks` OR sibling `fn_list_shift_tasks(shift_session_id)` resolving `shift_session → shift_session_day_line → day_line → session_task`, within shift time window.
3. Hook fire sets `day_line_id`: `session-hook-executor` + `assign_task` attach day_line when session has exactly one (else NULL — never guess).
4. Web "Shift tasks" panel filtered by selected shift's day_lines (reuse `MalTaskTag` chips).
5. Mobile `useMyTasks(shiftSessionId)` → resolver; `TaskFeed` shows only active shift's tasks.
6. `add-day-line-item-action` always passes `day_line_id`; AddTaskDialog defaults to strip area + window.

**Falsifiable acceptance:** task `{day_line_id=L, scheduled_at=18:00}` shows for an employee on a shift at L, not at M; RPC returns non-null `day_line_id`+`location_id`; single-area hook task carries `day_line_id`.

## Phase R2 — Time-window dispatch (push)
ADR-0367 Rule 4 cron: SELECT `session_task WHERE scheduled_at IN window AND day_line_id NOT NULL AND status=pending`, JOIN clocked-in `shift_session_day_line`, fan out to `shift_session.push_topic`. **Acceptance:** task at `scheduled_at=T`, location L pushes only to employees clocked-in at L near T.

## Phase R3 — Routine as a real task list
1. Fix path B (G6): `session_hook.linked_routine_id` → expand `routine.procedure_id → procedure_step` → one `session_task` per step (delegate via `task.create_session`, ADR-0240), carrying day_line context.
2. `routine.attach_to_line` reads `routine` table (G7): accept `routine_id`, expand steps under day_line.
3. `control_list` runtime per-item state (G9): decide `control_list_item` child vs JSONB-with-state → ADR.
**Acceptance:** attach routine R (3 steps) → 3 area-anchored completable `session_task` rows w/ provenance to `routine_id`+`step_id`.

---

# Track S — Setup / Authoring (where tasks come from)

## Phase S1 — Document-drop → task & routine extraction

**Goal:** Drop a SOP/manual/checklist/menu; system extracts tasks, task-lists, routines, checklists, procedures — all variants — and persists them as governance templates + (optionally) day-line tasks.

**Current state:** `DocumentDropStep` → `analyze-setup-documents` → scrapling `/extract/document/batch` → Claude extracts 6 categories (policies/payroll/employees/shiftPatterns/employmentTerms/handbookSections). No task/routine extraction.

**Scope:**
1. Extend `EXTRACTION_PROMPT` (`analyze-setup-documents/index.ts:85–110`) + `DocumentExtractionResult` type (`wizard-state.ts:36–70`) with `procedures` (name + ordered steps + estimated_minutes), `routines` (name + trigger + steps + control_frequency), `checklists` (name + items). Each item carries `source` provenance (file + page/section).
2. Persistence: new path from extracted output → governance tables via the **owning capabilities** (ADR-0240): `onboarding.add_procedures` (extend to write `procedure_step` + `routine` + `control_list`, not just bare `protocol`), or a new `governance.import_from_extraction` tool. Human-in-the-loop review before commit (mirror prototype manual-builder confidence-per-block UX).
3. Fire `ingest-workspace-knowledge` after commit so extracted governance reaches `workspace_doc_chunk` (RAG).
4. Optional: extracted day-specific tasks → `timeline_template` (scope_type) for later day_line apply, NOT directly to live `session_task` (keep template/instance separation).

**Falsifiable acceptance:** dropping a "daily opening routine" PDF yields a reviewable draft routine with N ordered steps; on approve, a `routine` + `procedure`(+steps) row set exists, and applying it to a day_line produces N tasks. No silent auto-commit — review gate required.

**Out of scope:** voice→manual (prototype manual-builder Fase 5) — separate sortie, no backend exists.

## Phase S2 — Wizard: pick starter routines

**Goal:** During onboarding, the admin selects which industry routines/checklists to activate — not just procedure names.

**Current state:** `ConfirmProcedures` picks procedure **names** → bare `procedure` rows. Full restaurant templates (24 routines, 18 control_lists, 337 assignments) exist in `supabase/templates/restaurant/` but run **only in dev showcase seed** — `finalize-workspace` → `bootstrap-cascade` never invokes them.

**Scope:**
1. Surface the industry template catalogue (routines + control_lists + procedures + session_hooks) as selectable items in a new/extended wizard step (`ConfirmRoutines` or expand `ConfirmProcedures`), reading from the I1 package / template manifest rather than name stubs.
2. Wire `bootstrap-cascade` (or `finalize-workspace`) to apply the selected subset of `supabase/templates/restaurant/*.sql` (governance.sql, mattilsynet.sql, alcohol-labor.sql) for the live workspace — gated by admin selection, not all-or-nothing.
3. Persist selection in wizard state (`types-v2.ts` add `routines`/`controlLists`).

**Falsifiable acceptance:** admin checks "Alcohol control" + "HACCP" in the wizard → finalize seeds those routines + control_lists + procedures (+ session_hooks) for the workspace; unchecked templates are absent. New workspace is non-empty per I1 (no empty-workspace rule).

## Phase S3 — Role → mandatory cascade-linked compliance tasks

**Goal:** Each role carries mandatory compliance protocols/tasks; assigned automatically, gating readiness per role.

**Current state:** `policy_scope` = workspace/department/team/location — **no position/role**. `assignment_source` has `'position'` enum value but **no code path** (dead). `auto_assign_protocols_to_new_employee` trigger has no position branch. Readiness = workspace-wide % of `protocol_assignment` completed (no per-role gate). Role-capability baseline is docs-only (`docs/engines/.../08-role-capability-profiles/`).

**Scope:**
1. Add `position`/`role` to `policy_scope` enum (or a `protocol_required_role` join table linking protocol ↔ position/role). ADR — schema pattern change.
2. Extend `auto_assign_protocols_to_new_employee` trigger with a position/role branch (activate the dead `assigned_via='position'` path).
3. `protocol`/`protocol_assignment`: add `is_mandatory` / `required_before_shift` flag (compliance level vs nice-to-have).
4. Readiness-per-role: extend `get-readiness.ts` + `governance.check_readiness` to compute "all mandatory protocols for this profile's role/position complete" — feed C4 gating (e.g. block first shift / scheduling if mandatory incomplete; "Confident ≠ Authorized").
5. Bridge the role-capability baseline doc → DB seed (per-industry role → required protocols), applied in S2.

**Falsifiable acceptance:** creating a `profile` with position=Bartender auto-assigns the bartender mandatory protocols (e.g. Alkoholloven); readiness shows "ready for role" only when all mandatory complete; an unready bartender is flagged/blocked per C4 authority. Kitchen staff do not receive bartender protocols.

## Phase S4 — Admin surface (unified Task Manager IA)

**Goal:** Wire the prototype's admin/employee surface to the real backend — one home for tasks, library, templates.

**Scope (port from `taskmanager-DESIGNE/`, do not redesign):**
1. **Min dag** (TaskKort 10 elements, filter chips, 3 sections, Botsson-nudge, dag-meter) → backed by `fn_list_my_tasks` (R1) instead of mock data. Origin badge maps source/hook→routine/protocol/deviation/adhoc.
2. **Task-drawer** (subtasks, evidence, activity feed) → `session_task` + `evidence` JSONB + `task.complete`.
3. **Sidebar / mobile tabbar** → navigation (Min dag, Alle, Tildelt meg, Følger, Foldere, Bibliotek, Maler).
4. **Bibliotek** (manual library) → `workspace_doc_chunk` / handbook + manual link on `session_task` (needs a `manual_id` link — schema add).
5. **Maler** (templates) → `timeline_template` + governance routines/control_lists.
6. **Foldere** → category grouping (map to `schedule_day_task.category` + a folder taxonomy).

**Falsifiable acceptance:** Min dag renders live tasks from R1 with correct origin badges; toggling completes via `task.complete`; library opens a real handbook chapter linked to a task.

---

# Track H — Hardening

## Phase H1 — Collapse schema divergence
`v_task_unified` view (or generated aliases) so consumers read one shape; evaluate retiring the TS duplication of `fn_list_my_tasks` (G11/G12); add `completed_at` to `personal_task` (G13); CHECK on `schedule_day_task.task_status` (G14); reconcile RLS vs gate role (G15). **Acceptance:** new consumer reads one shape; SQL/TS drift impossible by construction.

## Phase H2 — Parity & polish
Voice `create_session_task` parity (day_line/scheduled_at) after ADR-0078 review; page-polish on shift-task surfaces; remove legacy telemetry aliases past 2026-06-12; derive `reconciliationLocked` in TimelineTab.

---

## Sequencing & dependencies

```
Track R:  R1 ──▶ R2
            └──▶ R3 ──┐
Track S:  S1 ─────────┼──▶ S4 (admin surface needs R1 read + S1/S2/S3 content)
          S2 ──▶ S3 ──┘
Track H:  H1 ──▶ H2   (after enough consumers attach)
```

- **R1 first** — unblocks manager promise + demo (runtime join).
- **S1 + S2** are independent of R; deliver "where tasks come from" (doc-drop + wizard). S2→S3 (role compliance builds on seeded templates).
- **S4** depends on R1 (live read) + S-track content (something to show in Bibliotek/Maler).
- **H** pays down fragility before the surface multiplies consumers.

## Council gates
- R1 step 3 (hook→day_line attach heuristic) — review if load-bearing.
- R3.3 (control_list runtime state) — schema → ADR.
- S1.2 (extraction→governance persistence) — cross-namespace write pattern → confirm ADR-0240 delegation.
- S3.1 (`policy_scope` position/role) — schema pattern change → **ADR required**.
- H1 (read-path de-duplication) — touches ADR-0317 invariant → ADR amendment.
