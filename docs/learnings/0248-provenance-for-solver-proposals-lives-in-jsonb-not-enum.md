---
title: "Provenance for solver-triggered proposals lives in JSONB changes, not framework_trigger_type enum"
id: L_0248
status: accepted
layer: learning
created: 2026-05-14
updated: 2026-05-14
---

# L-0248: Provenance for solver-triggered proposals lives in JSONB `changes`, not `framework_trigger_type` enum

## Context

G1 council (2026-05-14, ADR-0307 + ADR-0309 scheduler bundle approval pattern).
Q3 in the council brief asked: should `framework_trigger_type` enum get a new
value `scheduler_solver_v1` to distinguish solver-initiated proposals from
human manual overrides, or should the scheduler reuse the existing
`manual_override` value?

Phase 3 chair argued ADD `scheduler_solver_v1` for "signal preservation —
solver-initiated must be distinguishable from human-initiated to avoid
collapsing C1 (system belief) into C4 (manager intent)."

Phase 3 Agent-Coordinator argued REUSE `manual_override`: a manager triggered
the solver run, so the proposal IS human-initiated. Solver internals are
implementation detail of how the human's "give me a plan" action was
satisfied. Adding a new enum value for orchestration provenance conflates
manager action with framework-rule firing (the actual semantic of the
`framework_trigger_type` enum: `operating_hours | season_transition |
template_change | event_added | manual_override | framework_rule_change |
external_sync` are all about WHY a cascade re-evaluation occurred, not WHO
triggered it).

Phase 5 chair conceded the position. Provenance — solver version, solver run
ID, solver input hash, objective score — belongs in the `changes` JSONB
column where it's queryable, structured, and doesn't require cross-campaign
DDL coordination.

## What Happened

ADR-0307 first draft assumed enum extension to track solver provenance. This
would have required a new value in `framework_trigger_type`, which is a
cross-campaign-shared enum. Per migration `20260507110000` COMMENT: schema
changes on `change_proposal` and its enums require coordination with helpdesk
+ billing + daily-operation + payroll campaigns. Adding an enum value for a
single capability's introspection need = 4-campaign coordination cost.

Reusing `manual_override` + putting `solver_version + solver_run_id +
solver_inputs_hash` in `changes` JSONB:

- Zero DDL.
- Zero cross-campaign coordination.
- Provenance is queryable: `WHERE changes->>'solver_version' = 'greedy_v1'`.
- Future solver versions don't need new enum values — just bump
  `solver_version` string.
- Telemetry events carry the solver_run_id naturally (`scheduler.proposal.proposed`
  emits with `proposal_id` + `solver_run_id` from JSONB).

## Generalization

`framework_trigger_type` enum (and similar narrow-domain enums) is for the
WHY of cascade re-evaluation, not the WHO of the triggering actor. When
tempted to add an enum value to track:

- Which capability initiated a write
- Which version of an algorithm produced output
- Which agent / mission fired a mutation

…ask first: can this provenance live in the row's JSONB payload, capability
authority audit trail (`gate_evaluation`), or `activity_trail.actor_id`
instead?

Enum extension is the heaviest tool. JSONB metadata is the lightest. Default
to lightest. Promote to enum only when (a) the value participates in WHERE
clauses across 3+ consumer files, AND (b) the cardinality is bounded and
known. Solver versions are unbounded (greedy_v1 → greedy_v2 → cp_sat_v1 →
optaplanner_v1 → …) — wrong fit for enum.

## How to Apply

**Before proposing a new enum value:**

1. Identify what reads/writes need to discriminate on the value.
2. If readers query for an exact value (e.g., `WHERE trigger_type =
   'scheduler_solver_v1'`), check if the same query works against a JSONB
   field (`WHERE changes->>'solver_version' = 'greedy_v1'`).
3. If JSONB-query suffices, default to JSONB. Enum reserved for values that
   participate in indexes, foreign-key-like relationships, or RLS policies.
4. Cross-campaign-shared enums (e.g., `framework_trigger_type`,
   `change_proposal_status`) carry 3-4× coordination cost; treat as
   high-friction.

**Provenance lives where audit asks for it.** If audit asks "which solver
run produced this shift?" — that's a JSONB query. If audit asks "is this
proposal still pending or applied?" — that's an enum (status), already
exists.

## Sibling Learnings

- **L-0247** — Pattern selection must check runtime helper constraints
  (companion: this learning emerged from same G1 council)
- **L-0192** — Authority seed bootstrap-trigger pattern (ADR-0192) — provenance
  for capability authority lives in registry rows + per-call gate audit, not enum
- **L-0177** — Server-derived workspace_id (ADR-0151) — never trust body for
  identity provenance
- **L-0202** — ADD COLUMN beats sibling table for 1:1 attributes without
  lifecycle independence (5th precedent — same family: prefer the lightest
  schema tool)

## ADR Reference

- ADR-0307 (greedy scheduler V1)
- ADR-0309 (scheduler bundle proposal pattern; Q3 enum decision codified)
- ADR-0151 (server-derived identity; analogous "lightest tool wins" lesson)
- ADR-0192 (authority seed pattern; provenance via registry + audit, not enum)
