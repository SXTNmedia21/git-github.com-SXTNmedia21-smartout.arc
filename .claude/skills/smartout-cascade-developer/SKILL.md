---
name: smartout-cascade-developer
description: Authoritative guide for cascade scheduling system — I1+6D+4C+K1a/K1b model, dimensions, control planes, bootstrap. Use when touching cascade tables, dimensions, scheduling, season planning, or control planes.
tools: Read, Grep, Glob
---

# Last synced: 2026-04-06

# Smartout Cascade Developer Guide

This skill is the AUTHORITATIVE source for the Cascade Core Model. CLAUDE.md points here.

## Canonical Model: I1 + 6D + 4C + K1a/K1b

### I1 — Industry Intelligence Bootstrap (pre-runtime)

Pre-runtime layer. Loads vertical defaults, applies SQL templates, seeds all dimensions.

- Code: `packages/ai/src/industry/` (packages/hospitality.ts, loader.ts, index.ts)
- Templates: `supabase/templates/restaurant/` (13 SQL + \_apply.sql)
- Docs: `docs/engines/industri-inteligence/hospitalety/`
- Admin portal NEVER creates empty workspaces — always from I1 bootstrap.

### Execution Dimensions (D1-D6)

| #   | Name                  | Core Question                       | Type       | Key Tables                                                                                  |
| --- | --------------------- | ----------------------------------- | ---------- | ------------------------------------------------------------------------------------------- |
| D1  | Operational Envelope  | When/where/with what capacity?      | Structural | department, location, department_operating_hours, department_hours_override, planning_cycle |
| D2  | Resource Availability | Who is available now?               | Volatile   | profile, employment_contract, employee_payroll_profile, schedule_absence, team              |
| D3  | Rules & Constraints   | What is allowed/required/forbidden? | Stable     | regulatory_framework, framework_rule, framework_trigger, tariff_rate_table, public_holiday  |
| D4  | Demand Signal         | How much activity to prepare for?   | Predictive | season_budget, day_factor, hour_factor, workspace_budget, planning_event                    |
| D5  | Service Concept       | What kind of operation are we?      | Strategic  | workspace config, niche parameters (parameterizes D1-D4, D6)                                |
| D6  | Production & Product  | What to produce, what is the state? | Live       | department_session, session_hook, session_task, schedule_shift, deviation                   |

### Control Planes (C1-C4)

| #   | Name                        | Core Question                    | Loop                            |
| --- | --------------------------- | -------------------------------- | ------------------------------- |
| C1  | Observability & Calibration | What happened vs plan?           | Plan → actual → correction      |
| C2  | Context & Interaction       | What's relevant, how to explain? | State → inference → response    |
| C3  | Commercial & Outcome        | What value, what cost?           | Value → attribution → pricing   |
| C4  | Policy & Governance         | What is system ALLOWED to do?    | Capability → permission → audit |

**"Confident != Authorized"** — C1 determines belief, C4 determines permission. Always separate.

### Knowledge Substrate

| Tier          | Owner                       | Contents                                                     |
| ------------- | --------------------------- | ------------------------------------------------------------ |
| K1a Industry  | Platform (per vertical)     | Tariff baselines, policy templates, role capabilities        |
| K1b Workspace | Workspace (tenant-isolated) | Semantic memory (pgvector), learned factors, local overrides |

## Implementation Status

- **Phase A (schema):** Done — 7 migrations, 17 tables, 16 enums
- **Phase B (pure functions):** Partial — 4/6 done in `apps/web/src/lib/cascade/`
- **Phase C (bootstrap):** In progress — framework seed + bootstrap service
- **Phase D (adapters):** Not started — Tripletex, external integrations

## Domain Concepts

- **Department Session** (D6) — Daily container per dept. Lifecycle: upcoming → active → pending_signoff → closed | missed
- **Session Hooks** (D6) — Time triggers firing procedures/routines at pre_open, open, scheduled, pre_close, close
- **Readiness** (D2/D6) — Employee "ready" when all assigned Protocols completed. Score = % completed.
- **Trainee Mode** (D2) — Status flag on profile (`profile_status = 'trainee'`). Sandbox restrictions planned, NOT yet implemented.
- **Season** (D4/D5) — Time period wrapping operations, gamification, revenue planning. Status enum: draft/active/archived.
- **Event Engine** — `engine_process` (blueprint) → `engine_state` (live instance) → `engine_state_step` (per-step). Cascade produces, Event Engine consumes.

## Critical Traps

- Triple operating hours: `company_opening_hours` (wizard), `operating_hours` (legacy — NEVER use), `department_operating_hours` (runtime truth)
- Cascade provenance: every record carries `source_type` + `source_id`
- `tariff_rate_table.workspace_id` is nullable — platform-level rates have NULL
- Cascade tables use `btree_gist` extension for exclusion constraints
- Never mix dimension concerns across tables (D2 data in D4 table = wrong)
- Never treat cascade pipeline and Event Engine as the same thing
- Riksavtalen rates in hospitality.ts may need correction — verify against `tariff_rate_table`

## Reference Files

- Canonical spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- Cascade functions: `apps/web/src/lib/cascade/`
- Season calc: `apps/web/src/lib/season-calculations.ts`
- Industry packages: `packages/ai/src/industry/`
