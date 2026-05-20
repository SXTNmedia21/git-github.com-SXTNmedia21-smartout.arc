---
title: "6th L-0147 Chair Self-Reversal precedent — Phase 3 documentation-bias reversed by Phase 5 code-trace evidence"
id: LEARNING_0283
status: canonical
layer: learning
created: 2026-05-16
updated: 2026-05-16
tags: [council, chair, self-reversal, l-0147, precedent, pattern-recognition]
---

# Learning-0283: 6th L-0147 self-reversal precedent

## Context

Swap-marketplace-convergence-v2 council 2026-05-16. Chair (system-steward) Phase 3 voted Q1 = C (dual stores + pipeline_id FK). Two code-tracers (supervisor + agent-coord) independently voted Q1 = B (reuse engine_state) with file:line evidence that ADR-0067's engine_state already serves the pipeline-instance role.

Phase 5 chair self-audit produced explicit reversal classification per L-0147 Self-Reversal Protocol: "Phase 3 claim Q1=C was internally inconsistent. Falsifying evidence: supervisor + agent-coord code-trace of engine_state schema. Classification: REVERSED."

## Discovery

This is the 6th documented L-0147 precedent. Pattern remains structurally identical:

| # | Date | Sortie | Phase 3 chair claim | Falsifying evidence | Classification |
|---|------|--------|---------------------|--------------------|----------------|
| 1 | 2026-04-20 | Year Wheel Redesign | Trust Gate PASS | Agent-coord code-trace | REVERSED → FAIL |
| 2 | 2026-04-28 | /dashboard/help | REJECT | Frontend layout brought new evidence | REVERSED → APPROVE-as-tier |
| 3 | 2026-04-28 | ADR-0216 | Option A2 | Supervisor 139-site blast-radius scan | REVERSED → Option B |
| 4 | 2026-04-29 | Botsson on Platform Admin | — | — | REVERSED |
| 5 | 2026-05-09 | S6 welcome-mission R4 | — | — | REVERSED |
| 6 | 2026-05-16 | Swap-marketplace-convergence-v2 | Q1=C | Supervisor + agent-coord engine_state code-trace | REVERSED → Q1=B |

Common signature: chair operates on documentation-level or generalization-level evidence; reviewer code-trace expands scope or reveals canonical alternative; chair must reverse, not rationalize.

## Impact

6 precedents confirms L-0147 is structural, not incidental. Pattern continues to hold across:
- Schema decisions (this council, Year Wheel)
- Authority/Trust Gate decisions (this council, Year Wheel)
- ADR option selection (ADR-0216)
- Tier/scope decisions (/dashboard/help)
- Phase reviews (S6 welcome-mission R4)

L-0147 Self-Reversal Protocol promoted to permanent rule in `run-council` skill (already promoted post-3rd occurrence, this is reinforcement). Phase 5 chair MUST classify reversal explicitly when 2+ reviewers vote opposite to chair with code-trace evidence.

Adjacent learning surfaced in same session: L-0279 (chair Phase 3 internal inconsistency — invariant applied to one option but not all). The internal-inconsistency pattern is the mechanism BY WHICH chair Phase 3 generalizes incorrectly — applies invariant selectively. Both L-0147 (reversal protocol) + L-0279 (mechanism) are needed to fully describe the phenomenon.

## References

- L-0147 (Chair Self-Reversal Protocol — original)
- L-0279 (Chair Phase 3 internal inconsistency — mechanism)
- L-0282 (Phase 0 gate beats split — chair Phase 5 alternative outcome)
- ADR-0340 (Shift Lifecycle Pipeline Implementation — this sortie)
- COUNCIL-LOG.md 2026-05-16 entry
