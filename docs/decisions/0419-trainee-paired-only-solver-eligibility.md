---
id: ADR-0419
title: Trainee profiles — paired-only solver eligibility (D2 attribute filter)
status: draft
date: 2026-05-25
author: System Council (system-steward chair)
related: ADR-0307, cascade-spec-2026-03-21
tags: [scheduling, cascade, D2, solver, trainee, eligibility, procedure-engine]
---

# ADR-0419 — Trainee solver eligibility: paired-only

## Context

Council 2026-05-25 gap 9: solver `packages/ai/src/scheduler/eligibility.ts:46-47,97,316,321` filters by `employment_contract.status='active'`. No `profile.status` filter. Trainees (`profile.status='trainee'`) are treated identically to active employees in scheduling, conflating D2 employment lifecycle with D2 readiness state.

Per CLAUDE.md §Statuses (trainee → active → inactive → offboarding) trainee is a profile-state, not a role. Per smartout-cascade-developer skill: "Trainee Mode (D2) — Status flag on profile (`profile_status = 'trainee'`). Sandbox restrictions planned, NOT yet implemented."

Operational reality: trainees need supervision. A shift staffed only by trainees fails compliance + onboarding goals. Existing procedure-engine domain (HACCP Kjøkken, Onboarding Program training assignments visible in sim screenshots) assumes supervision pairing but doesn't enforce it at the scheduling layer.

## Decision

Solver `eligibility.ts` adds D2 status-based eligibility rule:

| profile.status | Solver treatment |
|---|---|
| `trainee` | **Eligible but paired-only** — solver assigns trainees only on shifts where ≥1 `active` profile is also assigned in the same shift slot or overlapping hour window |
| `active` | Standard eligibility (existing behavior) |
| `inactive` | Ineligible |
| `offboarding` | Ineligible |

The pairing constraint becomes a solver hard constraint (analogous to AML hour caps), not a soft scoring weight. Trainee-only shifts cannot be assigned.

Implementation lives in `packages/ai/src/scheduler/solver/greedy.ts` + `eligibility.ts`. No new capability tool. No DB schema change.

## Consequences

- Solver may produce more `gap_count` proposals when trainee-heavy roster + thin senior coverage — surfaces real staffing constraint that was previously hidden by trainee-as-senior treatment
- Existing solver tests need new fixture: trainee profiles + senior profiles + verify paired assignment
- Procedure-engine readiness gate continues to work as today (orthogonal — readiness blocks unsupervised shift access at clock-in, paired-only blocks unsupervised assignment at planning)
- `propose_plan` emit metadata adds `trainee_paired_count` + `trainee_unpaired_gap_count` for telemetry
- No mobile / no UI / no migration impact

## Status

Draft — implementation deferred to dedicated solver sortie (not capability council scope). Blocked on L-0348 (solver column drift) closing first.

## References

- Council session: `docs/council/COUNCIL-LOG.md` 2026-05-25
- `packages/ai/src/scheduler/eligibility.ts:46-47,97,316,321` (current employment_status filter)
- CLAUDE.md §Statuses
- smartout-cascade-developer skill (Trainee Mode definition)
