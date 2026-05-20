---
title: "ADR DDL sketches are not current truth — grep accepted-ADR canonical alternatives first"
id: LEARNING_0280
status: canonical
layer: learning
created: 2026-05-16
updated: 2026-05-16
tags: [council, briefing, fact-check, adr-sketch, false-positive]
---

# Learning-0280: ADR DDL sketches are not current truth

## Context

ADR-0321 (Swap↔Marketplace Convergence V2, accepted 2026-05-14) contained §"V2 Schema Sketch" with DDL for `engine_authority_pipeline` table. Swap-marketplace-convergence-v2 council 2026-05-16 initial briefing treated the sketch as the canonical design target for T0 migration.

## Discovery

Three independent reviewers (supervisor, agent-coord, harness-builder) caught that the sketch's role is ALREADY filled by `engine_state` from ADR-0067 — accepted, shipped, in production use by shift-swap capability today. The sketch was forward-looking documentation, not current schema reality.

This created a false-positive "table doesn't exist" finding in the briefing. The right framing was "canonical alternative already exists; sketch is superseded by existing infrastructure."

Pattern: ADRs in proposed/accepted status may contain DDL sketches that describe ideal future state. Reviewers must check whether existing accepted ADRs already cover the same role before treating a sketch as the design target.

## Impact

Phase 2.5 fact-check MANDATORY step addition: when a briefing references DDL sketches in any ADR (proposed or accepted), grep accepted-ADRs in same domain for canonical alternatives that already fill the same role. If found, the sketch is suspected-superseded; flag for council resolution before Phase 3 dispatch.

Sibling pattern to L-0264 (skill claim trace trap — grep alleged consumers before believing). Both are "documentation claims do not equal current truth" — verify against code/schema before acting.

Promote to `run-council` skill Phase 2.5 step: "For every DDL sketch or table-name claim in briefing, grep accepted ADRs in same module for canonical-role coverage. Sketch + existing canonical = sketch is superseded."

## References

- ADR-0340 (Shift Lifecycle Pipeline Implementation) — supersedes ADR-0321 §V2 Schema Sketch by reusing engine_state
- ADR-0321 (Swap↔Marketplace Convergence V2)
- ADR-0067 (engine_state canonical pipeline-instance model)
- L-0264 (Skill claim trace trap — sibling pattern)
- L-0140 (in-process primitives must be grep-verified)
