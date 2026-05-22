---
title: Procedure Engine Module — Blueprint Index
status: in_progress
updated: 2026-05-22
created: 2026-05-20
module: procedure-engine
tags: [module, procedure-engine, task-manager, governance, policy, protocol, procedure, routine, task, one-truth-many-views, day-line, adr-0298, adr-0367, adr-0387, source-of-truth]
---

# Procedure Engine Module — Blueprint & Source of Truth

> Authoritative blueprint for Smartout's Procedure Engine (formerly Task Manager). If code contradicts this folder → CODE wins, update these docs.
>
> **Spec (read first):** `docs/superpowers/specs/2026-05-22-procedure-engine-design.md` — canonical architecture, data decisions, and gap list.

## What this module is

**"Én sannhet, flere visninger."** The Procedure Engine is the operational content and compliance system of Smartout. The **procedure** is the atomic unit of operational knowledge — stored once, rendered as document, training, task, deviation reference, and compliance KPI. _Formerly called Task Manager_; renamed 2026-05-22 because "task" is merely the Drift view of a procedure, not the canonical concept.

The module unifies three independently-grown subsystems under a single governing model:

```
Policy            (krav)
└── Protocol      (compliance-container — 1:1 to policy)
    └── Procedure (sannheten — steg, media, ansvar)
        ├── Training  (manual + quiz + signering — VISNING)
        └── Routine   (gjentakende arbeidsflyt + location + team)
            └── Task  (instans materialisert per dag)
```

Concretely, the module is the contract for:

1. **Governance spine** — `policy → protocol → procedure(+procedure_step) / routine / control_list / knowledge_test / confirmation`. Schema shipped; manual table (GAP G-manual) and routine gaps (G-loc, G-team) pending Phase 1.
2. **Read/Write unification** (ADR-0298, *shipped*) — five task sources, one read RPC (`fn_list_my_tasks`), one write capability (`task`).
3. **D6 Production structure** (ADR-0367, *schema shipped, wiring partial*) — `department_session → day_line (location + time-window) → session_task`, with `shift_session` linking employees to areas.

The product promise: **"admin creates routines with instructions/media, assigns them to a location; cron materializes them into today's tasks; employee clocks in, sees their day on a timeline, preps the next shift, and completes with evidence — the whole chain gives measurable compliance against defined policies."**

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
- **Admin surface:** prototype (`taskmanager-DESIGNE/`) holds the full vision but is mock/unwired (Phase S4).

**Priority:** Phase R1 (location-tasks → shift view) delivers the manager promise + demo. See [BLUEPRINT.md](./BLUEPRINT.md) for both tracks + falsifiable acceptance.

## Reading order

| # | Doc | Purpose |
|---|-----|---------|
| 0 | [ROADMAP.md](./ROADMAP.md) | **At-a-glance journey status** — 13 UX-journeys (incl. Min dag, Botsson-setup, role-compliance, admin-authoring) with `live`/`in_progress`/`planned`/`blocked` + 2 open architecture questions (4→2 consolidation, cron-health gate). Living doc; read FIRST for "where are we." |
| 1 | [MODULE_PROCEDURE_ENGINE.md](./MODULE_PROCEDURE_ENGINE.md) | Main module doc — governing model (Policy→Protocol→Procedure→Routine→Task), cascade placement, three axes (template/instance/anchor), surface contract, authority, invariants, gaps |
| 2 | [DATA-MODEL.md](./DATA-MODEL.md) | Full schema: governance spine (policy/protocol/procedure/procedure_step/routine/knowledge_test/confirmation/control_list/manual), D6 runtime (department_session/day_line/session_task/shift_session), 5-source schema, fn_list_my_tasks projection, gaps (G-loc/G-team/G-manual/G-expand/G-version/G-projection), telemetry, RLS |
| 3 | [ARCHITECTURE.md](./ARCHITECTURE.md) | L1–L5 code map: capability tools, RPC, BFF routes, server actions, web + mobile UI surfaces, voice mirror, telemetry |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | Manager / employee / agent journeys across template authoring → instantiation → completion |
| 5 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | Verified-working vs aspirational. 16 gaps classified by severity. The fragility of the read-normalization layer. |
| 6 | [BLUEPRINT.md](./BLUEPRINT.md) | Phased plan (Phases 1–5). Phase 1 = routine authoring + location-tasks → shift-tasks view. Falsifiable acceptance per phase. |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | Web Playwright + mobile + capability units + manual matrix |

### Active sortie docs (day_line → Min dag)
| Doc | Purpose |
|-----|---------|
| [FINDINGS-dayline-shift-tasks.md](./FINDINGS-dayline-shift-tasks.md) | **Dual-perspective + reuse audit.** Pipe ~70% shipped; both gaps EXTEND-EXISTING (mirror `ensure_shift_session` join; reuse `use-shift-session.status`). Anti-duplication source of truth. |
| [EXECUTION-PLAN-5h.md](./EXECUTION-PLAN-5h.md) | Agent-team orchestration plan (revised post-dual-perspective: A-DATA dropped, A-ANCHOR + status-gate + Min dag mockup port). |
| [ADR-DRAFT-0387-role-mandatory-compliance-i1.md](./ADR-DRAFT-0387-role-mandatory-compliance-i1.md) | Role-compliance ADR (0387a shipped, 0387b proposed) — adjacent track, different goal. |
| [BUILD-PLAN-i1-role-compliance.md](./BUILD-PLAN-i1-role-compliance.md) | 0387b phasing. |

Design prototype: [taskmanager-DESIGNE/](./taskmanager-DESIGNE/) — interactive HTML/JSX handoff (library, task-drawer, min-dag, quiz-master, manual-builder). **Mockup-source for all task UI — port to Nordic Split + new tokens (`taskStatus`/`taskOrigin`), do not redesign.** HEX → OKLCH-token at port time. North-star for: Min dag full fidelity, Library, Routine editor, evidence-capture.

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
