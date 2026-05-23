---
title: "Procedure Engine — Domain Index"
status: in_progress
mirror: mixed
last_verified: 2026-05-22
updated: 2026-05-22
created: 2026-05-22
domain: procedure-engine
tags: [domain, procedure-engine, governance, policy, protocol, procedure, routine, task, one-truth-many-views, adr-0298, adr-0367, adr-0391, source-of-truth]
---

# Procedure Engine — Source of Truth

> Authoritative folder for the **procedure-engine** domain. If code contradicts this folder → **CODE wins**, update these docs.
>
> **Absorption note:** `docs/modules/procedure-engine/` (13 files) has been absorbed into this domain. All spine content originates from the module folder. The module folder is archived with `superseded_by: docs/domains/procedure-engine/`.
>
> **Phase 1 status (2026-05-22):** ADR-0391 accepted. Schema migrations shipped (`20260622100000` + `20260622100500`). Capability tools shipped (routine.create + assign_to_location + add_step in `packages/ai/src/capabilities/routine/tools.ts`). Cron per-step expansion shipped (`session-hook-executor/index.ts` lines 255–290). UI (RoutineForm, mobile clock-in, notifications) — NOT YET built.

## Build state

| Part | Built | Tested | Notes |
|---|---|---|---|
| Governance spine (`policy`→`protocol`→`procedure`→`routine`) | ✅ | 🟡 | Schema `00003_governance_tables.sql`. Five lens-views at `/dashboard/hms/*`. |
| Task read/write unification (ADR-0298) | ✅ | 🟡 | `fn_list_my_tasks` v2, `task` capability 6 tools, voice mirror, mobile BFF |
| ADR-0367 D6 tri-layer schema (day_line / shift_session) | ✅ | 🔴 | Schema `20260620120200`–`20260620130100`. UI/mobile wiring partial. |
| Phase 1: routine.location_id + routine_team + executor_type (ADR-0391) | ✅ | 🔴 | Migration `20260622100000`. Capability tools (create/assign_to_location/add_step). |
| Phase 1: session_task provenance triple (ADR-0391) | ✅ | 🔴 | Migration `20260622100500`. Cron stamps provenance at `session-hook-executor:229–284`. |
| Phase 1: cron per-step expansion from routine (ADR-0391 G-expand fix) | ✅ | 🔴 | `session-hook-executor/index.ts:255–290`. Routine→procedure_step expanded. |
| Phase 1 UI: RoutineForm web authoring | 🔴 | 🔴 | NOT built. Plan: `docs/superpowers/plans/2026-05-22-procedure-engine-phase-1.md` Tasks 7–8. |
| Phase 1 UI: mobile clock-in + Min dag timeline | 🔴 | 🔴 | NOT built. Plan Task 9. `DuringShiftView` + BFF `/api/mobile/shift-session/[id]/clock-in` pending. |
| Phase 1 UI: overdue + assignment notifications | 🔴 | 🔴 | NOT built. Plan Task 10. |
| ADR-0387a: profession_training revival + I1 seeding | ✅ | 🔴 | Shipped `campaign/daily-operation @ 0dd9528d6`. |
| ADR-0387b: auto-assign trigger + readiness gate rewire | 🔴 | 🔴 | Council-gated. NOT started. |

> Full honest delta: [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md). Status matrix: [../_DASHBOARD.md](../_DASHBOARD.md).

## Reading order

| # | Doc | mirror | Purpose |
|---|---|---|---|
| 1 | [OVERVIEW.md](./OVERVIEW.md) | verified | What + why + cascade placement |
| 2 | [ARCHITECTURE.md](./ARCHITECTURE.md) | mixed | L1–L5 code map — Phase 1 schema + tools verified; UI gaps noted |
| 3 | [DATA-MODEL.md](./DATA-MODEL.md) | mixed | Governance spine + D6 runtime + provenance triple. Phase 1 schema verified. Gap tables noted. |
| 4 | [USER-FLOWS.md](./USER-FLOWS.md) | mixed | Flow index — verified-working + blocked/partial flows. Links journeys. |
| 5 | [ROADMAP.md](./ROADMAP.md) | aspirational | Forward plan (Phases 1–5) + ADR/journey refs |
| 6 | [GAPS-AND-DEBT.md](./GAPS-AND-DEBT.md) | verified | Built-vs-planned delta — 25 verified gaps with code citations |
| 7 | [E2E-COVERAGE.md](./E2E-COVERAGE.md) | mixed | Test matrix = proof of what is built+tested |

## Working docs (kept — still live)

| Doc | Status | Purpose |
|---|---|---|
| `taskmanager-DESIGNE/` | live | Canonical UI prototype — port to Nordic Split, do NOT redesign. North-star for Min dag, Library, Maler, task-drawer, manual-builder, quizmaster. |

> The following working docs from `docs/modules/procedure-engine/` have been **archived** (superseded by domain spine + accepted ADRs):
> - `ADR-DRAFT-0387-role-mandatory-compliance-i1.md` → graduated to `docs/decisions/0387-role-mandatory-compliance-hospitality-intelligence.md` (accepted 2026-05-21). File preserved in old folder as traceability record.
> - `BLUEPRINT.md` → content absorbed into [ROADMAP.md](./ROADMAP.md).
> - `BUILD-PLAN-i1-role-compliance.md` → superseded by accepted ADR-0387a/b in `docs/decisions/`.
> - `EXECUTION-PLAN-5h.md` → plan completed; day_line findings absorbed into GAPS-AND-DEBT.
> - `FINDINGS-dayline-shift-tasks.md` → absorbed into GAPS-AND-DEBT G1–G6 + ARCHITECTURE.

## Agent Guardrails

> Read before touching procedure-engine code. Truth lives in this folder.

- **Never write task mutations without `gatedMutation` (ADR-0204/0287)** — all Server Actions + capability tools must call `gate_action`. No direct browser writes.
- **`session_hook` is a template, NOT a per-session instance** — it does NOT receive `day_line_id` (ADR-0367 Rule 2, day-session README). `session_task` rows materialised from a hook at fire time carry `day_line_id`.
- **Every new session_task producer MUST stamp the provenance triple** — `origin`, `generated_by`, `source_reference` (ADR-0391). `session-hook-executor:229–284` is the canonical pattern.
- **`fn_resolve_single_day_line` returns NULL for 0 or >1 active day_lines** — never substitute a guess. NULL anchor = dept-level task (correct fallback per ADR-0367).
- **`fn_list_my_tasks` SQL ↔ `list_mine` TS body are a lockstep pair** (ADR-0317) — any column change to one must be mirrored in the other. Drift already happened once (v2 added `hook_linked_*` not projected in TS).
- **L-0177 fail-fast:** routine cross-namespace writes must verify `routine.workspace_id == ctx.workspaceId` before mutating (`routine/tools.ts:~400`).
- **Cross-namespace writes delegate** — `day-line` + `routine` capabilities write `session_task` only through `task.create_session` (ADR-0240).
- **Mobile is execute-only** (ADR-0133). No authoring UIs on mobile.
- **L-0066 default-allow CVE** — every new capability needs a seed migration in `engine_authority_config`.
- **`procedure_step` ≠ workflow node** — branching/escalation/parallel goes in Event Engine (`engine_process`), NOT here. Cascade produces, Event Engine consumes.
- **UI prototype lock (Pontus 2026-05-20):** All task-manager UI MUST be ported from `taskmanager-DESIGNE/` — do NOT redesign. HEX → OKLCH tokens at port time.
- **Owning tables (DDL):** `policy`, `protocol`, `procedure`, `procedure_step`, `routine`, `routine_team`, `knowledge_test`, `confirmation`, `control_list`, `runbook`, `protocol_assignment`, `knowledge_test_attempt`, `confirmation_signature`, `procedure_step_completion`, `observer_request`. Plus task-instance tables: `personal_task`, `emma_task`, `schedule_day_task`. (`session_task` DDL shared with day-session — see GAPS §5 seam.)
- **Owning capabilities:** `task` (6 tools), `routine` (4 tools: attach_to_line, create, assign_to_location, add_step), `day-line` (4 tools), `timeline-template` (4 tools), `governance` (check_readiness).
- **Owning Edge Functions (content/materialization):** `session-hook-executor`, `emma-task-trigger`. (Session lifecycle EFs owned by day-session.)
