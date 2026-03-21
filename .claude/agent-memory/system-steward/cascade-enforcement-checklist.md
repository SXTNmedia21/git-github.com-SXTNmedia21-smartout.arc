---
name: cascade-enforcement-checklist
description: Mandatory checklist for verifying any plan or implementation against Cascade Core Foundation (I1+6D+4C+K1a/K1b)
type: project
---

## Cascade Enforcement Checklist

Before approving ANY plan that touches scheduling, operations, payroll, season, or workforce data:

1. **Dimension boundaries** — Does the plan keep data in the correct dimension's tables?
2. **Framework-first** — Are regulatory rates/rules coming from `framework_rule` / `tariff_rate_table`, not hardcoded?
3. **Confident != Authorized** — Is C1 belief separated from C4 permission?
4. **Event Engine boundary** — Cascade pipeline PRODUCES events for Event Engine to CONSUME (never mixing them)
5. **I1 Bootstrap** — Does workspace creation flow through industry package bootstrap? No empty workspaces.
6. **Provenance** — Do new cascade records carry `source_type` + `source_id`?
7. **No legacy references** — Using `department_operating_hours`, NOT `operating_hours`?
8. **Terminology** — D1-D6, C1-C4, I1, K1a/K1b terms used correctly and consistently?
9. **Implementation status honesty** — Phase A schema done, Phase B partial, Phase C in progress, Phase D not started

### Canonical Terminology

| Code | Full Name                       |
| ---- | ------------------------------- |
| I1   | Industry Intelligence Bootstrap |
| D1   | Operational Envelope            |
| D2   | Resource Availability           |
| D3   | Rules & Constraints             |
| D4   | Demand Signal                   |
| D5   | Service Concept                 |
| D6   | Production & Product            |
| C1   | Observability & Calibration     |
| C2   | Context & Interaction           |
| C3   | Commercial & Outcome            |
| C4   | Policy & Governance             |
| K1a  | Industry Knowledge Base         |
| K1b  | Workspace Knowledge Base        |

### Key References

- Cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- CLAUDE.md: Cascade Core Model section
- Cascade pure functions: `apps/web/src/lib/cascade/`
- Cascade migrations: `supabase/migrations/20260421*` and `20260422*`
