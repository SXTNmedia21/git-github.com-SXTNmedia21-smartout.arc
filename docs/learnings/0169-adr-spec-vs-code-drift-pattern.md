---
title: "ADR Spec-vs-Code Drift Pattern — `proposed` ADRs Create Read-Trap"
id: LEARNING_0169
status: canonical
layer: learning
created: 2026-04-29
updated: 2026-04-29
tags: [adr, council, spec-drift, gate, agent-router, dual-gate]
---

# Learning 0169: ADR Spec-vs-Code Drift — Reviewers Cite Contracts Code Isn't Bound To

## Observation

Council post-implementation review 2026-04-29 caught Agent-Coordinator citing ADR-0231 (`gate_action` dedup in agent flows) as a "contract drift" because:

- ADR-0231 spec: router fires `gate_action` once + attaches `gateVerdict` + `gate_correlation_id` to context; capability tools call `requireGateVerdict(ctx)` (no second RPC fire).
- Code reality: `services/stage-engine/src/core/agent-router.ts:237` fires `gate_action` once. Capability `gate.ts:63` fires it AGAIN. M2.3 governance Server Actions fire it a THIRD time. `gate_correlation_id` propagation: zero matches in `services/stage-engine/src/`.
- Net: chat→governance update fires `gate_action` 3x today, ADR-0231 promises 1x.

Reviewer flagged this as M2.3 contract violation. Steward synthesis classified it correctly: ADR-0231 sits at `proposed`. Code is not contractually bound to a `proposed` ADR. M2.3 inherited the 3x firing pattern from existing infrastructure — it didn't introduce it.

The drift is real but the framing matters: "code violates spec" is wrong when spec hasn't been ratified. Correct framing: "code reflects current accepted contracts; proposed contracts represent intended future state."

## What This Means

`proposed` ADRs are aspiration, not contract. Reviewers must classify by ADR `status:` before treating divergence as a violation. Three classes:

| ADR Status | Code-spec divergence reading |
|---|---|
| `accepted` | **Real violation.** Code must match. Block merge if drift introduced. |
| `proposed` | **Spec-drift, expected.** Code reflects prior accepted state. Wait for promotion before enforcing. |
| `amended` | **Read both versions.** New text overrides old. Code must match newer signature. |
| `superseded` | **Ignored.** Code may match either version; new ADR governs. |

## Apply Going Forward

1. **Phase 2.5 fact-check expansion:** every claim "X violates Y" must check Y's frontmatter `status:`. If `proposed`, classify as spec-drift, not violation.
2. **Council reviewer briefing:** add ADR-status classification to evidence requirements. "Code does X. ADR-0NNN (status: accepted) says Y. Drift = real." vs "Code does X. ADR-0NNN (status: proposed) says Y. Drift = future-work."
3. **Synthesis Phase 5 trust gate:** explicitly answer "do new tools/capabilities make promises the data pipeline can keep today" against the set of ACCEPTED ADRs only. Proposed ADRs go in "log for next session" not "must-fix before merge".
4. **`/run-council` Phase 5 mandate:** when reviewer cites ADR for finding, synthesis must include ADR status one-liner before adopting finding into verdict.

## Cross-references

- Council 2026-04-29 (post-implementation campaign/core-module review)
- ADR-0229 dual-gate transitional architecture (`proposed`)
- ADR-0230 cascade_gate_write channel parameter (`proposed`)
- ADR-0231 gate_action dedup in agent flows (`proposed`)
- L-0165 gate_action double-evaluation in agent flows (the underlying pre-existing 2x firing)
- L-0168 council briefing false-claim pattern (related — false claims often result from missing ADR-status classification)
