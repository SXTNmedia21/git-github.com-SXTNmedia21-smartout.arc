---
name: cascade-coordination
description: Cascade coordination rules for supervising multi-agent work on cascade-related features
type: project
---

## Cascade Coordination Rules

### Canonical Terminology (use verbatim)

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

### File Ownership by Dimension

- D1: department_operating_hours, planning_cycle, operating hours UI, department config
- D2: profiles, contracts, availability, team management, absence
- D3: framework tables, regulatory rules, tariff rates, constraint resolution
- D4: season budget, demand forecasting, day/hour factors
- D5: workspace config, niche parameters (rare changes)
- D6: department sessions, session hooks, shift execution, deviations
- C1: reconciliation, KPI targets, calibration loops
- C3: cost snapshots, revenue attribution
- C4: authority config, change proposals, governance policies

### Mandatory Reading

Before writing agent instructions touching scheduling, operations, payroll, or season:

- Cascade spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`
- CLAUDE.md Cascade Core Model section

### Key Rules

- Module 7 (Absence) is a placeholder — header only, no deep implementation
- Cascade pipeline PRODUCES events, Event Engine CONSUMES — never mix
- "Confident != Authorized" — C1 belief, C4 permission. Always separate.
- No empty workspaces — always I1 bootstrap
