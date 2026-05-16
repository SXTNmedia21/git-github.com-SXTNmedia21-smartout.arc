---
title: "Phase 0 gate inside sortie beats split-into-2-campaigns when scope-tightening resolves harness concerns"
id: LEARNING_0282
status: canonical
layer: learning
created: 2026-05-16
updated: 2026-05-16
tags: [council, scope, phase-0, sortie-design, harness-block, chair-synthesis]
---

# Learning-0282: Phase 0 gate beats split-into-2-campaigns

## Context

Swap-marketplace-convergence-v2 council 2026-05-16. 3-mot-1 split on sortie scope: supervisor + agent-coord + steward voted APPROVE WITH CHANGES; botsson-harness-builder voted DO NOT PROCEED, recommending split into 2 campaigns (Campaign A = close ADR-0321 open gates; Campaign B = implementation only after A closes).

Harness's diagnostic was correct: V2 trigger conditions per ADR-0321 not met, override_pipeline phantom-contract risk, 4 open system-map gaps. Harness's prescription (2 separate campaigns) was over-scoped given chair Phase 5 self-reversal on Q1 (engine_state reuse) which dissolved 1 of 4 gaps automatically.

## Discovery

When one reviewer says SPLIT and others say APPROVE-WITH-CHANGES with the SAME underlying concerns, chair should look for a Phase 0 gate that converts harness concerns into a 2-3-day checklist INSIDE the single sortie before T0 migration. This beats 3-5-day coordination overhead of multi-campaign split, AND preserves harness's diagnostic findings as gating items rather than discarding them.

The right resolution shape:
1. Chair accepts harness diagnostics as binding (every flagged concern becomes a Phase 0 item).
2. Chair scope-bounds: which concerns must close before T0 (Phase 0), which can defer to later sortie.
3. Chair adds explicit exit gate: Pontus signs off on Phase 0 completion before T0 dispatch.
4. If Phase 0 exceeds 5 days, escalate to harness's original split-into-2-campaigns recommendation.

This converts harness's BLOCK into "harness's checklist", preserves urgency, doesn't dismiss findings, and gives the multi-campaign split as a graceful fallback if Phase 0 over-runs.

## Impact

Pattern for chair Phase 5 synthesis when one reviewer issues BLOCK + others issue APPROVE-WITH-CHANGES:

1. Identify whether BLOCK-reviewer's concerns are scoped-bounded (can be checklist) or scope-expanding (cannot fit single sortie).
2. If scoped-bounded: introduce Phase 0 gate inside sortie. Every BLOCK concern → Phase 0 task. Exit gate = signed off.
3. If scope-expanding: accept BLOCK, split campaigns.
4. Heuristic: if BLOCK can be addressed in <30% of total sortie duration via dedicated phase, prefer Phase 0 gate. >30% means scope-expansion; prefer split.

Promote to `run-council` skill Phase 5 synthesis: "Chair Phase 5 must distinguish scoped-bounded BLOCK (use Phase 0 gate) from scope-expanding BLOCK (split campaigns). Heuristic: <30% sortie-duration ratio."

## References

- ADR-0340 (Shift Lifecycle Pipeline Implementation) — Phase 0 P0.1-P0.6 derived from harness's 4 system-map gaps + V2 trigger concern
- L-0147 (Chair Self-Reversal Protocol) — Phase 5 chair behavior pattern
- L-0279 (Chair Phase 3 internal inconsistency) — sibling chair-behavior pattern
