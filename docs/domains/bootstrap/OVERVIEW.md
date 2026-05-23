---
title: "Bootstrap Domain — Overview"
status: in_progress
updated: 2026-05-23
created: 2026-05-23
domain: bootstrap
last_verified: 2026-05-23
mirror: mixed
tags: [bootstrap, workspace-setup, I1, cascade, botsson, week-1]
---

# Bootstrap — Overview

## What It Is

Bootstrap is the **gate-driven, agent-orchestrated, week-1 progressive setup** of a new workspace. It answers the question: "What must exist before a workspace is operational, and how does Botsson help an admin get there?"

Bootstrap defines:
- **Critical gates** — seed-completeness items (department exists, location exists, regulatory framework bound, contracts seeded, authority config seeded, etc.)
- **Persistent readiness state** — per-workspace, per-gate status that Botsson reads on every session
- **Progressive day plan** — bootstrap-coordinator picks today's gate, surfaces it as the mission of the day
- **Agent-driven closure** — Botsson closes gates autonomously when possible, proposes actions to admin when human input is required

## What It Is NOT

Bootstrap is **not** a cascade dimension. The cascade has dimensions I1/D1–D6/C1–C4/K1a/K1b. Bootstrap is a **meta-layer**: it orchestrates the seeding of those dimensions (D1 departments, D1 locations, D3 regulatory framework, D2 employment contracts, K1a routines, etc.) for a brand-new workspace. Once seeded, the cascade runs from those records. Bootstrap does not participate in steady-state scheduling, payroll, or compliance cycles.

Bootstrap is also **not** employee onboarding. Bootstrap = workspace setup (employer/admin domain). Employee onboarding is a separate pending domain, owned by the `onboarding` capability and the employee-onboarding wizard (`apps/web/src/app/dashboard/onboarding/`).

## Why It Exists

Before this domain was articulated, workspace setup was scattered:
- SQL templates produced seed records via a 10-step `template_restaurant_apply()` function (passive, one-shot)
- A `bootstrap-cascade` Edge Function ran 11 steps of cascade seeding (D1 hours, D3 framework, D5 tariff, D6 authority config)
- A voice mission (`onboarding-interview`) handled initial intake in a single 30-minute session
- A 9-step setup wizard (`/dashboard/setup/`) let admins manually complete governance and payroll config
- No persistent "what is still missing?" gate surfaced to Botsson between sessions

The gap: after initial bootstrap completes, Botsson had no memory of what was still open. A new session started from zero. This domain closes that gap by defining the readiness model that persists gate state and drives Botsson's first-week behavior.

## Cascade Placement

```
                    ┌─────────────────────────┐
                    │  BOOTSTRAP (meta-layer)  │
                    │  orchestrates seeding of │
                    └───────────┬─────────────┘
                                │ seeds
          ┌─────────────────────┼──────────────────────┐
          ▼                     ▼                      ▼
    D1 Structure          D3 Rules               K1a Industry
  (departments,        (framework,             (routines, tests,
   locations,           tariff floor,            Mattilsynet,
   hours)               planning cycle)          Alkoholloven)
          │                     │
          ▼                     ▼
    D2 Resource           D4 Demand
  (profiles, contracts,  (season budget,
   payroll profiles)      day/hour factors)
          │
          ▼
    D6 Production           C4 Governance
  (authority config        (engine_authority_config
   seeded at bootstrap)     manages capability gates)
```

Bootstrap fires ONCE (or on resume if partial). After completion, cascade runs normally. Bootstrap state persists across sessions so Botsson can track open gates.

## Governing ADRs

| ADR | Title | Status |
|-----|-------|--------|
| ADR-0056 | Cascade Core Foundation Schema (I1+6D+4C+K1a/K1b) | done |
| ADR-0062 | Industry Intelligence Consolidation | accepted |
| ADR-0192 | Authority seed bootstrap-trigger pattern | accepted |
| ADR-0200 | Atomic season activation RPC — cites bootstrap-cascade as D1 writer | proposed |
| ADR-0297 | Workforce snapshot session bootstrap | accepted |
| ADR-0353 | Workspace framework binding bootstrap | proposed |
| ADR-0387 | Role-mandatory compliance + I1 Step 11 (profession_seed) | accepted (0387a) |
| ADR-pending | Bootstrap-coordinator + workspace_readiness schema | to be proposed |
