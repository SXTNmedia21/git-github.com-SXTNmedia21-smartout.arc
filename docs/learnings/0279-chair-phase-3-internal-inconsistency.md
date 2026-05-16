---
title: "Chair Phase 3 internal inconsistency — invariant applied to one option but not all"
id: LEARNING_0279
status: canonical
layer: learning
created: 2026-05-16
updated: 2026-05-16
tags: [council, chair, phase-3, invariant-application, self-reversal]
---

# Learning-0279: Chair Phase 3 internal inconsistency

## Context

Swap-marketplace-convergence-v2 council 2026-05-16. Chair (system-steward) Phase 3 review of Q1 (pipeline instance state). Steward flagged Option A (new `engine_authority_pipeline_instance` table) for "parallel state plane — Invariant 1 violation by cascade-integrity-mandate." Then voted Q1 = Option C (dual stores + pipeline_id FK on existing tables).

## Discovery

Steward's Phase 5 self-audit (per L-0147 Self-Reversal Protocol): Option C commits the EXACT SAME sin as Option A. Two state tables with `pipeline_id` linkage IS a parallel state plane. Same invariant violation, different surface.

Chair applied Invariant 1 to Option A while voting → reject. Did NOT apply same invariant to Option C while voting → accept. This is internal inconsistency at the chair-vote layer.

Two code-tracers (supervisor + agent-coord) independently identified ADR-0067's `engine_state` already serves the pipeline-instance role with full required schema (process_id + status enum + current_step + context JSONB + entity_type/entity_id + parent_state_id + RLS + UNIQUE partial active-index). Their Q1 = B (reuse engine_state) was the only option that does NOT create a parallel state plane.

Phase 5 chair reversal: Q1 C → B. Confirmed as 6th L-0147 self-reversal precedent.

## Impact

Phase 3 chair vote rationale MUST apply every cited invariant to EVERY option under consideration, not just the rejected ones. Mitigation:

- When chair flags "Option X violates Invariant Y", explicitly check whether Options Z, W also violate Y in same response.
- Phase 3 vote rationale format addendum: per-option × per-invariant matrix when ≥3 options considered.
- Steward agent SKILL.md update: add "Invariant-coverage symmetry check" as Phase 3 self-audit step.

Promote to `run-council` skill Phase 5 synthesis as mandatory chair self-audit step: "Did Phase 3 vote apply every cited invariant symmetrically across all options?"

## References

- ADR-0340 (Shift Lifecycle Pipeline Implementation) — the council that surfaced this
- L-0147 (Chair Self-Reversal Protocol) — 6th precedent
- Cascade Integrity Mandate Invariant 1 (single canonical pipeline)
- ADR-0067 (engine_state as pipeline-instance canonical model)
