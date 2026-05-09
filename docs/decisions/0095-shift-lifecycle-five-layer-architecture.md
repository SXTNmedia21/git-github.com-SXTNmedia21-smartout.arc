---
title: "Shift Lifecycle Five-Layer Architecture"
id: ADR-0095
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
module: schedule
tags: [adr, cascade, shift, lifecycle, d6, c1, c3, c4]
---

# ADR-0095: Shift Lifecycle Five-Layer Architecture

**Status:** Accepted
**Date:** 2026-04-15
**Council:** 2026-04-15 (steward chair, supervisor, agent-coordinator, frontend-designer)

## Context and Problem Statement

A "shift" appears in five tables (`schedule_shift`, `time_entry`, `department_session`, `shift_approval`, `daily_reconciliation`) with five distinct status enums. The deep dive (2026-04-15) initially diagnosed this as "five parallel state machines" needing consolidation. Council reframed the diagnosis: the five enums are not redundant — they represent five different *meaning layers* of the same domain object, and the real defect is that the **Interpretation layer is missing entirely**. Raw `time_entry` punches are passed straight to `shift_approval` with no canonical step that applies D3 framework rules (overtime, night premium, break deductions). Tables `shift_cost_snapshot` (C3) and `employee_payroll_profile` are referenced in docs but not in migrations — payroll cannot be derived end-to-end.

## Decision Drivers

- **Cascade integrity (ADR-0056):** cascade produces, Event Engine consumes. Lifecycle truth must live in domain tables, not in `engine_state`.
- **Provenance:** every output must trace back to the rule and observation that produced it. A single mega-table collapses provenance.
- **Reproducibility:** given the same `time_entry` + `framework_rule` + `tariff_rate_table`, derivation must always produce the same `shift_hour_interpretation` and `shift_cost_snapshot`.
- **Forbidden patterns:** mega-table (mixes Reality/Interpretation/Decision), aggregate view as primary architecture (hides ontology), Event Engine as truth-owner (breaks ADR-0056).

## Considered Options

1. **Aggregate view across existing tables.** Cosmetic — hides the missing Interpretation layer, does not solve provenance.
2. **Single mega-table for the whole shift lifecycle.** Forbidden pattern; collapses five ontological roles into one row.
3. **Event Engine owns lifecycle state.** Breaks ADR-0056; makes truth unreproducible if `engine_state` is lost.
4. **Five-Layer Handoff Architecture (chosen).** Name the five layers explicitly. Each layer owns its domain table. Event Engine orchestrates handoffs between layers, never owns layer state.

## Decision Outcome

Chosen option: **Five-Layer Handoff Architecture**.

| Layer | Tables | Role | Owner of writes |
|-------|--------|------|-----------------|
| **Reality (D6 source)** | `time_entry`, punch events, `session_task` completions | Raw observed facts | Mobile/web clients via `emit()` |
| **Interpretation (D6 derived) — NEW** | `shift_hour_interpretation` | Deterministic application of D3 rules to Reality | Pure derivation function |
| **Derivation (C3)** | `shift_cost_snapshot`, `employee_payroll_profile` | Cost from Interpretation × tariff | Cost engine, pure function |
| **Decision (C1)** | `shift_approval`, `daily_reconciliation` | Manager ratification, gated by C4 | Manager/admin via approval handler (with authority check) |
| **Execution (D6 commitment)** | `schedule_shift`, `department_session` | Planned commitment from D4 demand | Planning pipeline |

### Rules

- Each layer's status enum describes only that layer's lifecycle. Cross-layer reasoning happens via reads, not writes.
- A layer never mutates a lower layer (Decision cannot edit Reality; if hours are wrong, override artifacts are added — Reality is immutable).
- Event Engine processes coordinate handoffs (Reality settled → trigger Interpretation → trigger Derivation → trigger Decision queue) but do not store layer state.
- The aggregate read view `v_shift_lifecycle` (per ADR — to follow) is permitted **after** all five layers have authoritative tables. Until Interpretation and Derivation tables exist, no aggregate view ships.

## Rules & Consequences enforced for Agents

- **Good, because** payroll becomes derivable end-to-end with full provenance; D3 rule changes are reproducibly re-applied to historical reality; mobile/web cannot drift because each emits to its layer's owner.
- **Bad, because** introduces one new table (`shift_hour_interpretation`) and reorganizes how derivation is computed; existing ad-hoc paths must migrate.
- **Agent Impact:** when generating code that touches shift data, identify which layer is being read or written and respect the owner. Never compose Reality + Decision in a single mutation. Never use `engine_state.context` as a source of truth for layer status.

## Related ADRs

- ADR-0056 (cascade core foundation) — preserved.
- ADR-0036 (shift-mcp isolation) — preserved; shift-mcp stays CRUD-only.
- ADR-0096 — formalizes `schedule_shift` ↔ `department_session` relation within Execution layer.
- ADR-0097 — formalizes `time_entry` immutability within Reality layer.
- ADR-0098 — `engine_state` as coordination-only.
- ADR-0099 — unified authority-gate (C4) for Decision layer.
- ADR-0100 — `daily_close` as department-aggregate consumer of settled shifts.
