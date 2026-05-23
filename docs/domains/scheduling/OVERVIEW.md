---
title: "Scheduling — Overview"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: scheduling
mirror: verified
last_verified: 2026-05-23
tags: [scheduling, shift, cascade, solver, d6, plan-side]
---

# Scheduling — Overview

> What this domain is, why it exists, and where it fits in the cascade.

## What scheduling is

The scheduling domain is Smartout's **shift-plan authoring system**. It gives managers the tools to build, propose, publish, and govern the shift schedule — and gives employees read access to their upcoming shifts, the ability to trade shifts (swap), and the ability to claim open shifts (marketplace).

The domain is **plan-side only**. It produces `schedule_shift` rows as its primary output. Once those shifts are published and an employee clocks in, the domain hands off to **day-session** (ADR-0096: 1 `department_session` : N `schedule_shift`).

## Why it exists

Manual vaktplanlegging is the manager's most time-consuming daily task in hospitality. Smartout's scheduling domain replaces that with:

1. **AI-assisted solver** — greedy constraint-solver (ADR-0307/0309) auto-proposes a week's plan from D2+D3+D4+D6 cascade inputs. Manager reviews, accepts, or rejects the bundle in one action.
2. **Marketplace** — manager posts open/unstaffed shifts; qualified employees claim from mobile; manager 1-tap approves (ADR-0306). Reduces hulltetting bottleneck.
3. **Swap** — employees propose bilateral shift trades; manager approves (ADR-0413 engine; policy ADR-0288).
4. **Lifecycle governance** — temporal lock (ADR-0066) prevents retroactive edits; 5-layer handoff (ADR-0095) ensures Reality→Interpretation→Derivation→Decision provenance for compliance.

## Cascade placement

```
D1 Envelope (operating hours, planning_cycle)
    ↓ constrains
D2 Resource (profile, employment_contract, absence)
    ↓ available
D3 Rules (framework_rule, tariff_rate_table)
    ↓ constrains
D4 Demand (planning_event, season_budget, day/hour factors)
    ↓ signals staffing need
D5 Concept (workspace config, niche params)
    ↓ parameterises
╔══════════════════════════════════════╗
║  SCHEDULING DOMAIN (plan-side)       ║
║  greedy solver → change_proposal     ║
║  manager publishes → schedule_shift  ║
╚══════════════════════════════════════╝
    ↓ produces (ADR-0096)
D6 Production (department_session — day-session domain)
    ↓ consumes
C1 Calibration (daily_reconciliation, shift_approval)
C3 Commercial (shift_cost_snapshot ← scheduling owns Derivation)
```

**Scheduling reads:** D1 operating hours, D2 profiles + contracts + absences, D3 framework rules + tariffs, D4 planning events + demand factors, D5 workspace config.

**Scheduling writes:** `schedule_shift` (D6 Execution layer), `shift_hour_interpretation` (D6 Derived), `shift_cost_snapshot` (C3 Derivation), `schedule_shift_offer` (marketplace sidecar), `shift_session` (ADR-0367 runtime per-employee slot), `engine_state` (via swap/marketplace Event Engine blueprints).

**Downstream consumers:** day-session reads `schedule_shift` for session anchoring; payroll reads `shift_cost_snapshot` + `shift_hour_interpretation`; botsson reads `schedule_shift` for workforce snapshot (ADR-0297).

## Plan-side vs execution-side

| Concern | Domain | Table |
|---|---|---|
| Shift plan authoring | **scheduling** | `schedule_shift` |
| Solver proposal | **scheduling** | `change_proposal` (C4 bundle) |
| Shift-swap approval | **scheduling** | `engine_state` (swap blueprint) |
| Open-shift offer | **scheduling** | `schedule_shift_offer` |
| Per-employee runtime slot | **scheduling** (ADR-0367 edge) | `shift_session` |
| Punch-in / clock-out | day-session | `timesheet.time_entry` |
| Session lifecycle | day-session | `department_session` |
| Daily approval | day-session | `daily_reconciliation` |
| Payroll cost calc | payroll | `payroll.calculation` |

## Solver pipeline

```
1. Manager invokes propose_plan (chat-only, Compose verb)
2. loadSolverContext(): fetch D2+D3+D4+D6 for planning_cycle_id
3. solveGreedy(input): greedy heuristic → SolverOutput {proposed_shifts[], gaps[]}
4. Write single change_proposal row (ADR-0309 bundle pattern, JSONB array)
5. Manager reviews → accept_proposal OR reject_proposal
6. On accept: atomic INSERT N schedule_shift rows from JSONB bundle
```

Solver lives at `packages/ai/src/scheduler/solver/greedy.ts`. Algorithm: greedy heuristic respecting D3 constraints (overtime cap, minimum rest, role requirements). V2 upgrade path: OR-Tools CP-SAT Python service if quality gap surfaces (ADR-0307 §V2 trigger).

## Voice policy (ADR-0288)

The scheduling domain has a split voice policy:

| Tool class | Voice allowed? | Rule |
|---|---|---|
| `get_my_shifts`, `get_today_schedule`, `get_date_schedule_for_me` | ✅ Yes | Self-data only — no third-party roster exposure |
| `get_workspace_schedule`, `get_shift_colleagues` | ❌ Chat-only | Shows other employees' data |
| All `shift-swap` mutation tools | ❌ Chat-only | Irreversible C4 act + third-party data (ADR-0288:198,339,510) |
| All `shift_marketplace` mutation tools | ❌ Chat-only | Irreversible C4 act (ADR-0288:189,378,574) |
| `propose_plan`, `accept_proposal`, `reject_proposal` | ❌ Chat-only | Compose + irreversible acts |
