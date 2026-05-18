---
title: "Schema invariants asserted in prose require schema enforcement (3rd quarter occurrence)"
id: LEARNING_0311
status: canonical
layer: learning
created: 2026-05-18
updated: 2026-05-18
tags: [schema, invariants, constraint, prose-vs-code, recurring-pattern]
---

# Learning-0311: Schema invariants asserted in prose require schema enforcement

## Context

Council Phase 3 system-steward C1 (2026-05-18) flagged that `session_hook` is described in ADR-0367 Rule 2 as "a template per `(workspace_id, department_id, hook_type)`" — but the schema at `supabase/migrations/20260412100300_session_infrastructure.sql:15-27` has NO UNIQUE constraint on that triple. Two `session_hook` rows for the same (workspace, dept, hook_type) are currently legal. The template invariant is asserted in prose, unenforced by schema.

This is the 3rd observed occurrence this quarter of the same anti-pattern:
1. L-NEW-3 HMS R1 PM (2026-05-17): registry events declared in `SmartoutEvent` union without matching `emit()` call-sites — ADR-0358 promotion
2. L-0176 (2026-04-29): docstring claims ADR-0204 compliance, body has direct writes outside `gatedMutation`
3. L-0311 (this learning, 2026-05-18): `session_hook` template uniqueness in prose, no UNIQUE constraint

## Discovery

The shared root cause: **prose claims serve as documentation; the system depends on machine-enforced invariants for correctness**. Three failure modes:

| Failure mode | Symptom | Detection |
|---|---|---|
| Soft contract (docstring) | Compiler accepts violations; tests may pass | Code-trace at PR review |
| Soft schema (no constraint) | DB accepts violations; manifests as data anomalies in production | Constraint audit + grep for "MUST be unique/exactly-one/at-most-one" prose |
| Soft routing (no emit) | Compiler accepts; PostHog/activity_trail receive zero rows | grep emit() call-sites for every registry entry |

The mitigation is the same in all three cases: **enforcement at the layer that owns the invariant**.

For schema invariants:
- "exactly one" / "at most one" / "at least one" → CHECK or UNIQUE or NOT NULL constraint
- "MUST be unique" → UNIQUE index
- "implies / requires" → CHECK constraint or trigger
- "cannot change" → trigger preventing UPDATE
- "always derived from X" → generated column or materialized view

## Impact

Hard rule for future spec authoring (added to ADR template):

For every prose claim of the form:
- "X is unique per Y"
- "exactly one X per Y"
- "at most one X per Y"
- "X must satisfy Z"
- "X is derived from Y"

The spec MUST include the schema-level enforcement (constraint, index, trigger, or generated column) that ensures the invariant. Asserting in prose only is **soft-contract drift** — the same class as L-0176 (docstring drift) and ADR-0358 (registry without emit).

Code-trace mitigation: when reviewing a spec, grep for the words "unique", "exactly", "at most", "always", "derived" — for each match, verify the corresponding schema artifact exists in the proposed migration set.

ADR-0367 v1.2 Rule 1b adds `session_hook` UNIQUE constraint as a Phase A migration to close this specific instance.

## References

- ADR-0367 v1.2 Rule 1b (session_hook UNIQUE)
- ADR-0358 (telemetry registry requires emit() — sibling soft-routing pattern)
- L-0176 (docstring drift — sibling soft-contract pattern)
- `supabase/migrations/20260412100300_session_infrastructure.sql:15-27` (current schema gap)
