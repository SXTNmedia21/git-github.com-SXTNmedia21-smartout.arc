---
title: "Procedure Engine — Overview"
status: in_progress
mirror: verified
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: procedure-engine
tags: [domain, procedure-engine, overview, governance, compliance, one-truth-many-views, cascade]
---

# Procedure Engine — Overview

> What this domain is and why it exists. **Code wins** — if this contradicts code, update here.
> Verified against: `docs/modules/procedure-engine/MODULE_PROCEDURE_ENGINE.md`, `docs/superpowers/specs/2026-05-22-procedure-engine-design.md`, `docs/decisions/0391-procedure-engine-phase1-routine-scope-provenance-cron-expansion.md`.

## 1. What it is

**"Én sannhet, flere visninger."** The Procedure Engine is the operational content and compliance system of Smartout. The **procedure** is the atomic unit of operational knowledge — stored once, rendered as document (Documents), training (Training), task (Drift), deviation reference (Avvik), and compliance KPI (Dashboard). Compliance becomes a byproduct of actual competence, not logged documentation. This is the core moat.

The domain was renamed from `task-manager` on 2026-05-22. "Task" is merely the Drift view of a procedure — not the canonical concept. The rename reflects what the system actually is: the module that owns how operational knowledge is defined, assigned, materialized, and proven.

The domain unifies three independently-grown subsystems under a single governing model:

```
Policy            (principle/requirement — "follow HMS/IK-mat")
└── Protocol      (compliance container against one policy — holds ALL content types)
    └── Procedure (the truth: how something is done correctly — purpose, steps, media)
        ├── Training      (learn: manual + quiz + signering — VIEW of procedure)
        └── Routine       (recurring workflow — daily/weekly/event + location + team)
            └── Task      (concrete action — instance materialized per day by cron)
```

**Protocol is the compliance unit.** Everything hangs on `protocol_id`: procedure, routine, control_list, runbook, knowledge_test (quiz), confirmation (signering). Its purpose is to prove compliance with the policy it serves.

## 2. Cascade placement

| Layer | Role |
|-------|------|
| **Governance content** (template axis) | `policy`, `protocol`, `procedure`, `procedure_step`, `routine`, `routine_team`, `control_list`, `runbook`, `knowledge_test`, `confirmation` — reusable definitions |
| **D6 Production** (instance axis) | `session_task`, `schedule_day_task` — what is happening today |
| **C2 Agent-Utility** (instance axis) | `personal_task`, `emma_task` — user + agent curated reminders |
| **C4 Governance** | `gate_action` controls who/what is allowed to create or complete a task. `engine_authority_config` rows seed the permission set ("Confident ≠ Authorized"). |
| **K1a Industry / K1b Workspace** | `profession_training` (role→mandatory-protocol map, ADR-0387a); workspace_doc_chunk for semantic lookup |

The domain consumes from D1 (department, location, operating hours → `planned_open`/`planned_close`), D2 (profile/shift/absence → assignee + `shift_session`), D5 (`timeline_template` seeds day_lines per area). It does NOT own session lifecycle (D6 orchestration) — that is **day-session**.

## 3. Boundaries

**Owns:**
- Governance content chain authoring + versioning: `policy → protocol → procedure(+procedure_step) / routine / knowledge_test / confirmation / control_list / runbook`.
- Routine scope (ADR-0391): `routine.location_id`, `routine.workspace_id`, `routine.executor_type`, `routine_team` junction — who/where/how a routine runs.
- Task generation: cron per-step expansion (`session-hook-executor`: `linked_routine_id`/`linked_procedure_id` → `procedure_step` → `session_task` per step), provenance triple (`session_task.origin/generated_by/source_reference`, ADR-0391).
- Task ontology read surface: `fn_list_my_tasks` RPC + `task` capability (6 tools) — the unified read/write across all five task sources (ADR-0298).
- Personal and agent (Emma) task sources: `personal_task`, `emma_task`, `schedule_day_task`.
- `profession_training` revival (ADR-0387a) — role→mandatory-protocol mapping in I1.
- Procedure authoring/assignment surfaces: `ProcedureBuilder.tsx`, `ConfirmProcedures.tsx`, governance editors.

**Does NOT own:**
- Session lifecycle (`department_session` status machine, `session_hook` template DDL, `session-lifecycle` EF, signoff, reconciliation) → **day-session** domain.
- `day_line`, `shift_session`, `shift_session_day_line` DDL + lifecycle → **day-session** domain. (Procedure-engine reads these to anchor tasks via `fn_resolve_single_day_line`; it does NOT write them.)
- `session_task` DDL is SHARED — procedure-engine generates the rows (via `session-hook-executor` + `task` capability); day-session owns the table structure and the D6 session anchor. See GAPS §5 seam detail.
- `deviation` table and avvik views → **day-session** domain.
- `daily_reconciliation`, `settlement_image`, `settlement_validation` → **day-session**.
- Payroll, billing → separate domains.
- Event Engine orchestration (`engine_process/state/step`) — procedure-engine produces tasks that the Event Engine may consume, but branching/escalation/parallel logic stays in Event Engine.

## 4. Key invariants

1. **Procedure is the truth** — manual/quiz/task/signering are views over the same procedure. No duplication. (`docs/modules/procedure-engine/MODULE_PROCEDURE_ENGINE.md §8.1`)
2. **Template vs instance are separate** — cron materializes template→instance. `procedure`/`routine` → `session_task`. (`session-hook-executor/index.ts:141–290`)
3. **Protocol is the compliance container** — everything hangs on `protocol_id`. (`00003_governance_tables.sql:39`)
4. **Five sources, one read RPC, one capability** (ADR-0298) — every task row belongs to exactly one of five sources. `engine_state_step` is NEVER in `fn_list_my_tasks`. (`packages/ai/src/capabilities/task/tools.ts:741–912`)
5. **Provenance triple on every session_task** (ADR-0391) — `origin`, `generated_by`, `source_reference`. Nullable now, stamped by every producer. (`supabase/migrations/20260622100500_session_task_provenance.sql`)
6. **`fn_list_my_tasks` SQL ↔ `list_mine` TS are lockstep** (ADR-0317) — any column change must be mirrored in both. (`packages/ai/src/capabilities/task/tools.ts:41–46`)
7. **All mutations gate via `gate_action` + emit telemetry** (ADR-0204/0287) — no direct browser writes. (`packages/ai/src/capabilities/task/gate.ts`)
8. **IDs are server-derived** (ADR-0151) — `workspace_id`, `profile_id`, `completed_by` always set server-side. Body-supplied IDs are rejected.
9. **Mobile is execute-only** (ADR-0133) — no authoring UIs on mobile. Web composes/authors.
10. **C4 owns permission** — agent may KNOW a task should exist (C1/C2 inference), but only C4 `gate_action` permits the write. "Confident ≠ Authorized."
