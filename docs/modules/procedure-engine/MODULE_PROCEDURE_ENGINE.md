---
title: Module — Procedure Engine
status: in_progress
updated: 2026-05-22
created: 2026-05-20
module: procedure-engine
tags: [module, procedure-engine, task-manager, governance, policy, protocol, procedure, routine, task, one-truth-many-views, adr-0298, adr-0367, adr-0387]
---

# Module — Procedure Engine

> Authoritative module doc for Smartout's Procedure Engine (formerly Task Manager). If code contradicts this doc → CODE wins, update this doc.
>
> **Spec:** `docs/superpowers/specs/2026-05-22-procedure-engine-design.md` — read first for architecture decisions and gap details.

## 0. Identity

**"Én sannhet, flere visninger."** The procedure is the atomic unit of operational knowledge in Smartout. It is stored once and rendered as a document (Documents), training (Training), a task (Drift), a reference (Avvik), and a compliance KPI (Dashboard). Compliance is a byproduct of actual competence — not logged documentation.

Module renamed from `task-manager` (2026-05-22): task is merely the Drift view of a procedure, not the canonical concept.

## 1. The Governing Model

```
Policy            (prinsipp/krav — "følg HMS/IK-mat")
└── Protocol      (compliance-container mot én policy — holder ALLE datatypene)
    └── Procedure (sannheten: hvordan noe gjøres korrekt — purpose, ansvar, steg, media)
        ├── Training      (lær: manual + quiz + signering — VISNING av procedure)
        └── Routine       (gjentakende arbeidsflyt — daglig/ukentlig/hendelse)
            └── Task      (konkret handling — instans materialisert per dag)
```

**Protocol is the compliance unit.** Everything hangs on `protocol_id`: procedure, routine, control_list, runbook, knowledge_test (quiz), confirmation (signering). Its purpose is to prove compliance with the policy it serves.

**Five lens-views ("Én sannhet, flere visninger") — all live at `/dashboard/hms/*`:**

| View | What it renders | Status |
|------|-----------------|--------|
| Documents | procedure hierarchy (DocumentBrowser/Viewer) | ✅ implemented |
| Training | manual (procedure_step) + quiz + signering | ✅ implemented (web) |
| Drift | session_task (DriftTaskList/Timeline) | ✅ implemented |
| Avvik | deviation (Kanban/List/Drawer) | ✅ implemented |
| Dashboard | compliance KPIs (OversiktDashboard) | partially (trend gap) |

## 2. The Unified Model — Three Axes

The module spans three orthogonal axes:

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

## 3. Data Model — Exists vs Gaps

### 3.1 EXISTS — Governance spine (gjenbrukes, bygges ikke nytt)

| Table | Role | Key fields |
|-------|------|------------|
| `policy` | requirement | `policy_type`, `policy_scope` (workspace/department/team/location), `statement`, `enforcement_status` |
| `protocol` | compliance-container | `policy_id` (**UNIQUE — 1:1**), `version`, `status`, **`evidence_tier`** |
| `procedure` | the truth | `protocol_id`, `procedure_type`, `skill_requirements` |
| `procedure_step` | step + learning content | `step_order`, `is_required`, **`training_content` (markdown)**, **`media_urls` (jsonb {type,url,caption})** |
| `routine` | repetition | `protocol_id`, `procedure_id`, `trigger_type`, `trigger_config`, `assigned_to_type/ref`, `control_list_id` |
| `knowledge_test` | quiz | `protocol_id`, `questions` (jsonb), `pass_threshold`, `max_attempts` |
| `confirmation` | signering | `protocol_id`, `confirmation_text`, `requires_signature` |
| `control_list` / `runbook` | sjekkliste / incident response | `protocol_id`, `items`/`escalation_chain` |
| `protocol_assignment` | assignment + progress | `profile_id`, `status`, **`protocol_version` (snapshot)**, denormalized counters, `next_review_at` |
| `knowledge_test_attempt` / `confirmation_signature` / `procedure_step_completion` | execution proof (immutable) | `score`/`passed`, `signed_at`/`ip`, `evidence` (jsonb) |
| `observer_request` | four-eyes verification | `subject`/`observer`, `status` |

**Compliance escalation exists:** `protocol.evidence_tier` = `quiz` → `quiz_plus_observer` → `quiz_plus_observer_plus_confirmation` → `four_eyes`.

### 3.2 EXISTS — D6 Runtime structure (ADR-0367)

| Table | Role | Key fields |
|-------|------|------------|
| `department_session` | D6 day-container | `session_date`, `status`, `planned_open/close` |
| `session_hook` | template-trigger | `hook_type`, `trigger_offset_min`, `linked_procedure_id`, `linked_routine_id`, UNIQUE(workspace,dept,hook_type) |
| `session_task` | **instance** (materialized) | `day_line_id`, `scheduled_at`, `assigned_to`, `completed_by`, `evidence`, `is_compliance_required`, 7-state status |
| `day_line` | location-anchor | `department_session_id`, **`location_id`**, `planned_open/close`, UNIQUE(dept_session, location) |
| `shift_session` | employee-runtime | `schedule_shift_id` (1:1), `employee_id`, `location_id`, **status: scheduled→clocked_in→clocked_out** |
| `shift_session_day_line` | M:N | shift can span multiple areas |

### 3.3 GAP — Missing/incomplete (to be built)

| Gap ID | What is missing | Fix |
|--------|-----------------|-----|
| **G-loc** | `routine` has no `location_id`/`workspace_id` | Add `routine.location_id` (FK location) + denormalized `workspace_id` |
| **G-team** | `routine` team = single FK (`assigned_to_ref`), not 0..N | `routine_team` junction (0..N; null = location-wide/pickup) |
| **G-expand** | `linked_routine_id` creates ONE stub task, does not expand steps | cron follows routine→procedure_id→procedure_step, materializes per step |
| **G-version** | snapshot-at-assignment only; no version history, diff, auto-re-confirm | `procedure_version` snapshot + material/non-material flag + re-assign trigger + diff render |
| **G-projection** | no future-projection (next shift prep) | RPC projecting routine/hook templates on future `schedule_shift` |
| **G-manual** | `manual` table (manual_type + sections + polymorphic FK) does not exist | NEW table — standalone intro/overview/Q&A documents (distinct from procedure_step inline content) |
| **G-ui** | Sesjonsplanlegger, Prep-next-shift, Library, evidence-capture, ManualGuide/QuizGuide (prod) | see spec §5 |
| **G-tokens** | ~7 files hardcode green/yellow/red (ADR-0366) | map to `taskStatus.*`/`priority.*` tokens |

### 3.4 Decisions made (2026-05-22)

1. **Manual = own table with `manual_type` + polymorphic FK** — NOT a duplicate of step content. Two distinct content layers:
   - `procedure_step.training_content` + `media_urls` = inline step content ("how to do step N", execution-coupled).
   - **`manual` (NEW table)** = standalone document with `manual_type` (`routine_overview` | `procedure_intro` | `qna` | `general`) + nullable FK to what it describes (`procedure_id` / `routine_id` / `protocol_id`). `sections jsonb`, `version`, `workspace_id`.
2. **Policy→Protocol stays 1:1** (UNIQUE(policy_id) exists). Low-effort default — confirm round 2.
3. **evidence_tier reused** as compliance-proof model. No new "proof" mechanism.
4. **Versioning + re-confirmation:** new mechanism required — see G-version. Phase 3.
5. **routine-team = junction 0..N** (`routine_team`; null = location-wide/pickup).
6. **procedure↔protocol: reserve M:N junction** (`protocol_procedure`), populate 1:1 until needed.
7. **Phase 1 routine-authoring = capability-tool + minimal form**; full Sesjonsplanlegger canvas Phase 2.

### 3.5 Phase 1 schema delta

`routine.location_id`, `routine.workspace_id` (denorm), `routine_team` junction, cron routine→step expansion (G-expand), **provenance-triple on session_task** (`origin`, `generated_by`, `source_reference`), **`routine.executor_type`** enum (`human`|`ai`|`system`|`hybrid`, default `human`). Everything else in Phase 1 uses existing tables.

> **Provenance-triple (BAKE NOW):** no task shall exist without `origin` (session/adhoc/routine/projection), `generated_by` (cron/manager/agent/system), and `source_reference` (hook_id/routine_id/template_id). Cheap now, brutal debugging later.
> **executor_type (BAKE NOW):** routine carries who executes — `human`/`ai`/`system`/`hybrid`. Connects C4-authority (engine_authority_config). Default `human`.

## 4. Cascade Placement

| Source | Cascade role | Lives in |
|--------|--------------|----------|
| `session_task` | **D6 Production** | runtime "what is happening today" |
| `schedule_day_task` | **D6 Production** (ad-hoc, date-anchored) | manager-curated day tasks |
| `personal_task` | **C2 Agent-Utility** | user-curated via agent |
| `emma_task` | **C2 Agent-Utility** (agent-curated, max-3) | Botsson auto-reminders |
| `engine_state_step` | **C2 Workflow Runtime** (control plane) | *excluded* from task surface (ADR-0298 R2) |
| `procedure` / `routine` / `control_list` | **Governance content** (templates) | reusable definitions |
| `day_line` / `shift_session` | **D6 Production** (structure) | location + employee anchoring |
| `policy` / `protocol` | **Governance compliance** | compliance container |
| `manual` (NEW) | **Governance content** | standalone intro/overview/Q&A documents |

The anchor structure consumes from D1 (department, location, operating hours → `planned_open`/`planned_close`), D2 (profile/shift/absence → assignee + `shift_session`), and D5 (`timeline_template` seeds day_lines per area). C4 governs **who/what is allowed to create or complete** a task (`gate_action`).

> **Confident ≠ Authorized.** An agent may *know* a task should be created (C1/C2 inference) but only C4 authority permits the write. Every `task.create_*` / `complete` tool calls `gate_action`.

## 5. Instantiation Paths (template → session_task)

| Path | Mechanism | Status |
|------|-----------|--------|
| A — procedure | `session_hook.linked_procedure_id` → cron expands `procedure_step` → one `session_task` per step | **complete** (`session-hook-executor`) |
| B — routine | `session_hook.linked_routine_id` → cron creates **one flat task** with routine UUID in description | **STUB** — steps not expanded (G-expand) |
| C — agent routine | `routine.attach_to_line` tool takes free-form items → delegates to `task.create_session` | works, but **does not read the `routine` table** |
| D — day program | `timeline_template.apply_template` materializes hooks/tasks/notes/shifts in bulk | **complete** (D6-level) |

## 6. Surface Contract

| Surface | Reads | Writes | Notes |
|---------|-------|--------|-------|
| Web — TasksTab (Dagslinjen) | `useSessionHooksWithTasks` (session-scoped, grouped by hook) | `add-task` / `toggle-session-task` / `complete-session-task` actions | session-scoped, no day_line/shift filter today |
| Web — HMS DriftTaskList / TaskCard | `use-session-tasks` | evidence-capture completion | HACCP/maintenance, evidence JSONB |
| Web — Todo / Min Dag | client aggregation of 4 sources | `useCreateQuickTask` | personal + emma surface |
| Web — CascadeTaskTab (drawer) | `useCascadeTasks` (`resolve_cascade_tasks`) | inline-edit / "Gå til" | setup tasks, not session_task |
| Mobile — TaskFeed / TaskModal / ChecklistView | `useMyTasks` (`fn_list_my_tasks`) | `/api/mobile/tasks/*` BFF | execute-only per ADR-0133; no day_line/shift filter today |
| Voice | `list_my_tasks` / `complete_task` | (chat-only creates) | thin mirror → stage-engine → `task` capability |
| Agent (chat) | `task.list_mine` | all 6 tools | full surface |

## 7. Authority & Telemetry

- **Authority:** `task` capability `defaultAuthority='suggest'`, gates each mutating tool via `gate_action(p_capability='task', action_type)`. Fails closed on RPC error (L-0066/L-0097). `create_session` via `day_line_id` requires `actor_capability` + `delegated_via` for audit symmetry (ADR-0356).
- **Telemetry:** canonical family `task created` / `task completed` / `task cancelled` (+ legacy 30-day aliases `session_task.created`, `session_task.assigned`, `task.added_manual`). `task created`/`completed` route to PostHog + Logger + `activity_trail` + `engine_event`; `cancelled` skips `engine_event`; `task.list_mine` is read-only (PostHog + Logger only).

## 8. Invariants

1. Procedure is the truth; manual/quiz/task/signering are views over the same procedure. No duplication.
2. Template (procedure/routine) vs instance (session_task) are kept separate; cron materializes template→instance.
3. Protocol is the compliance container; everything hangs on `protocol_id`.
4. Every task row belongs to exactly one of five sources (ADR-0298 R1). New table = ADR amendment.
5. `engine_state_step` is NEVER in `fn_list_my_tasks` or the `task` capability (R2).
6. `fn_list_my_tasks` SQL ⇔ `list_mine` TS body are a lockstep pair (ADR-0317).
7. `workspace_id` / `profile_id` / `completed_by` always server-derived (ADR-0151, R4).
8. Every UPDATE RLS policy on a task table has USING + WITH CHECK (R5).
9. Cross-namespace writes to `session_task` go through `task.create_session` (ADR-0240).
10. `day_line` is uniquely `(department_session_id, location_id)`; a task is area-anchored iff `day_line_id` is set.
11. Mobile is thin/execute-only (ADR-0133); web composes/authors.
12. Material version change → re-confirmation; non-material → none.
13. All mutations emit telemetry + gate via `gate_action` (ADR-0204/0287).

## 9. Architectural Boundary

**Procedure Engine = operational content + compliance (define + materialize + prove). Event Engine = orchestration (branching, escalation, parallel).** Do NOT add branching/conditions/escalation to `procedure_step` — those belong in `engine_process`. A routine that needs orchestration emits to `engine_process`. Cascade produces, Event Engine consumes (CLAUDE.md).

## 10. Open Direction

The module has **two halves** (see [BLUEPRINT.md](./BLUEPRINT.md)):

- **Runtime track (R):** the join nobody rendered yet — `schedule_shift → shift_session → shift_session_day_line → day_line → session_task`, plus exposing `day_line_id`/`scheduled_at`/`location_id` through the read RPC (Phase R1 = the manager promise). Then push dispatch (R2) and real routine expansion (R3).
- **Setup/authoring track (S):** where tasks come from — document-drop task/routine extraction (S1), wizard starter-routine selection (S2, templates exist but only run in dev seed), role→mandatory compliance tasks (S3, ADR-0387), and wiring the prototype admin surface (S4).
- **Phase 3+:** Sesjonsplanlegger canvas, Forbered-neste-vakt, versioning/re-confirmation, Library + manual render.

Hardening (H) collapses the four divergent table schemas behind a stable view and retires the hand-maintained `fn_list_my_tasks` ↔ `list_mine` duplication. See [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) for verified gaps.

## 11. Glossary

- **Task (instance)** — a single completable work-item belonging to exactly one of five sources.
- **Five sources** — `session_task` (D6), `schedule_day_task` (D6 ad-hoc), `personal_task` (C2 user), `emma_task` (C2 agent), `engine_state_step` (control-plane, *excluded*).
- **`fn_list_my_tasks`** — `SECURITY DEFINER` RPC that UNIONs the first four sources into a normalized read shape.
- **`task` capability** — the single write surface: `list_mine`, `create_personal`, `create_session`, `create_day_ad_hoc`, `complete`, `cancel_personal`.
- **`day_line`** — the location-anchored program strip for one area on one date; `(department_session_id, location_id)` unique; carries `planned_open`/`planned_close`. The "task list attached to a location."
- **`shift_session`** — per-employee runtime row, 1:1 with `schedule_shift`; M:N to `day_line` via `shift_session_day_line`.
- **Routine** — a `procedure` (ordered steps) plus trigger metadata (`scheduled`/`event`) and an optional `control_list`. A routine *is* a task-list template.
- **Manual (NEW)** — standalone document with `manual_type` (`routine_overview`/`procedure_intro`/`qna`/`general`) + polymorphic FK. Distinct from procedure_step inline content.
- **evidence_tier** — protocol-level proof requirement: `quiz` → `quiz_plus_observer` → `quiz_plus_observer_plus_confirmation` → `four_eyes`.
- **L-0066** — default-allow CVE class. Unseeded capability = gate no-op. Every new capability needs a seed migration.
