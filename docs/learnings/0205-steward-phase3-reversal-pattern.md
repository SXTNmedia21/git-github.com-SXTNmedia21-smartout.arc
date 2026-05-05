---
title: "Steward Phase 3 reversal pattern — chair generalizes ontology, code-tracer falsifies"
id: LEARNING_0205
status: canonical
layer: learning
created: 2026-05-04
updated: 2026-05-04
tags: [council, steward, ontology, code-tracer, self-reversal, governance]
---

# Learning-0205: Steward Phase 3 reversal pattern — 5th occurrence

## Context

Welcome Mission V0 council session 2026-05-04. Chair (Steward) Phase 3 voted REJECT on three ontology-violation grounds:

1. `engine_session_step` "parallel ontology that ADR-0246 explicitly forbids"
2. `agent_inquiry` "ontologically overlaps engine_memory — BLOCKER"
3. `authority_snapshot` JSONB "conflicts with ADR-0099 unified gate"

Code-tracer reviewers (system-agent-coordinator + botsson-harness-builder + supervisor) verified all three claims with grep + file-read evidence:

1. ADR-0246 mandates conversation-state separation, NOT forbids it. `engine_session_step` is the legitimate realization.
2. `engine_memory` is pool-scoped KV; `agent_inquiry` is conversation-local workflow-state. Different scope, different shape.
3. ADR-0099 governs runtime gate-resolution. `authority_snapshot` is post-resolution audit-historical evidence. Different layer.

Per the Chair Self-Reversal Protocol (added after L-0147 3rd occurrence), Steward Phase 5 must classify Phase 3 votes as REVERSED when 2+ reviewers vote opposite with code-trace evidence.

## Discovery

**5 documented occurrences of the same pattern:**

| Date | Topic | Chair Phase 3 | Reviewer evidence | Phase 5 |
|---|---|---|---|---|
| 2026-04-20 | Year Wheel Redesign | Trust Gate PASS | Agent-coord code-trace expanded scope | FAIL-pending-fixes |
| 2026-04-28 | /dashboard/help | REJECT | Frontend layout brought new evidence | APPROVE-as-tier |
| 2026-04-28 | ADR-0216 | Option A2 | Supervisor 139-site blast-radius scan | Option B |
| 2026-04-29 | Botsson on Platform Admin | (per memory) | Code-tracer falsified | REVERSED |
| **2026-05-04** | **Welcome Mission V0** | **REJECT (3 ontology-violation BLOCKERs)** | **Code-trace falsified 2/3** | **REVERSED** |

**Pattern signature:** Chair operates on conceptual ontology-reading (from ADR titles, schema names, design-doc claims). Reviewers operate on code-grep + file-read. When the gap surfaces, chair has generalized beyond what code actually constrains.

**Failure mode:** If chair does NOT self-reverse explicitly, Phase 5 produces a contradictory verdict (Phase 3 said REJECT-on-A, Phase 5 says APPROVE-with-fixes-on-B-C-D — A is silently dropped). Future councils inherit the muddled record.

## Impact

**This learning promotes the pattern from optional rubric to permanent council fixture:**

1. **Chair Phase 3 must defer ontology-violation claims that depend on multi-ADR reading until code-tracer Phase 3 reports back.** A chair Phase 3 vote like "violates ADR-X" requires a citation pulled from the ADR's specific Decision section, not the title. Inferred violations are flagged for Phase 5 code-trace, not Phase 3 verdict.

2. **Phase 5 Self-Reversal block becomes mandatory output formatting.** Format: "Phase 3 claim X was [TRUE/FALSE]. Falsifying evidence: <citation>. Classification: REVERSED/REFINED/HELD." Skip = council protocol violation.

3. **Pre-vote chair check (added to Phase 3 chair briefing):** Before voting on ontology-violation claims, code-trace at least 3 column-references and 1 ADR-citation. If unable, defer the vote to Phase 5 with explicit "deferred pending code-trace from <reviewer>".

## References

- L-0147: Chair Self-Reversal Protocol (2nd occurrence promotion, pre-2026-05-04)
- L-0036: 4-layer review assignment (per-file vs payload-trace vs trigger vs capability-consumer)
- L-0179 (proposed): "before voting on ontology-violation claims, code-trace at least 3 column-references"
- ADR-0246: engine_state vs engine_sessions ontology (the ADR Steward misread Phase 3)
- ADR-0099: unified authority gate (the ADR Steward misread Phase 3)
- `~/.claude/skills/run-council/SKILL.md` Phase 5 Step 1.5 (Chair Self-Reversal Protocol — promoted to hard rule)
