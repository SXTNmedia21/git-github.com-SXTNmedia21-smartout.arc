---
title: "L-0294 — 7th L-0147 chair self-reversal precedent — promote to SKILL.md hard rule"
id: LEARNING_0294
status: canonical
layer: learning
created: 2026-05-17
updated: 2026-05-17
tags: [council, l-0147, chair-self-reversal, skill-promotion, meta-protocol]
related: [L-0147, L-0292, L-0293, run-council-SKILL]
---

# Learning-0294: 7th L-0147 chair self-reversal precedent — promote to SKILL.md hard rule

## Context

L-0147 chair self-reversal protocol exists as advisory text in
`~/.claude/skills/run-council/SKILL.md` Phase 5 §1.5. The protocol states: "When 2+
reviewers vote opposite to chair with code-trace evidence, chair MUST classify Phase 3 vote
as REVERSED in Phase 5 §1."

Format (canonical):
```
Phase 3 claim X was [TRUE/FALSE]. Falsifying evidence: <citation>. Classification: REVERSED.
```

## Discovery

As of 2026-05-17, this protocol has been triggered SEVEN times across documented councils:

| # | Date | Council | Reversal subject |
|---|------|---------|-----------------|
| 1 | 2026-04-20 | Year Wheel Redesign | Trust Gate Phase 3 PASS → Phase 5 FAIL after Agent-coord code-trace |
| 2 | 2026-04-28 | /dashboard/help | Phase 3 REJECT → Phase 5 APPROVE-as-tier after frontend layout brought new evidence |
| 3 | 2026-04-28 | ADR-0216 | Phase 3 Option A2 → Phase 5 Option B after Supervisor 139-site blast-radius scan |
| 4 | 2026-04-29 | Botsson on Platform Admin | Chair Phase 3 → Phase 5 reversal on dual-surface UX |
| 5 | 2026-05-09 | S6 R4 | Chair Phase 3 → Phase 5 reversal on capability scope |
| 6 | 2026-05-16 | Chat-WhatsApp | Phase 3 → Phase 5 hold-with-refinement, partial reversal |
| 7 | 2026-05-17 | Phase 7d-followup (this council) | Gap 4 + Gap 5 both reversed |

**Phase 9 promotion threshold:** SKILL.md Phase 9 Step 4 mandates: "If the same process
improvement has appeared in `council_meta.md` 3+ times across different sessions, promote it
into SKILL.md as a hard rule." Threshold long exceeded (7 occurrences across 6+ months of
council sessions).

**Pattern signature (consistent across all 7 occurrences):**

Chair operates on incomplete scope — prose-level reasoning without live code-trace. Two or
more reviewers with code-trace evidence vote opposite to the chair's Phase 3 verdict. Chair
must reverse explicitly in Phase 5 synthesis, not rationalize as REFINED or HELD-with-
conditions. The reversal protects against L-0176 anti-pattern (docstring drifting from body —
here read as "ADR prose drifting from code").

## Impact

**Required SKILL.md change (Sortie 1 T8 — Agent D executes):**

`~/.claude/skills/run-council/SKILL.md` Phase 5 §1.5 must be updated to:

1. Promote L-0147 from advisory text to enforced SKILL.md hard rule
2. Add the 7-entry precedent table (dates as above)
3. Extract the canonical format block from prose — make it a quoted, standalone block:
   ```
   Phase 3 claim X was [TRUE/FALSE].
   Falsifying evidence: <file:line citation>.
   Classification: REVERSED.
   ```
4. Add to Common Mistakes table:
   - Mistake: "Chair rationalizes Phase 3 verdict instead of explicit REVERSAL"
   - Resolution: "Per L-0147 protocol (7 precedents as of 2026-05-17), self-reversal must
     be named explicitly with falsifying citation. Use canonical format above."

**Enforcement:** Future councils must treat Phase 5 synthesis failure to issue explicit
REVERSED classification (when 2+ reviewers have code-trace evidence) as a council protocol
violation. The SKILL.md hard rule surfaces this in Phase 5 §1 header — before synthesis
begins.

**Complementary pattern:** L-0292 (pre-council schema-reality-check) REDUCES future Phase 5
reversal frequency by catching falsifications before Phase 2 dispatch. L-0147 HANDLES
reversals that still reach Phase 5. Both are needed; they operate at different council phases.

## References

- L-0147 (original advisory text that this learning promotes to hard rule)
- Council sessions 2026-04-20 / 2026-04-28 / 2026-04-29 / 2026-05-09 / 2026-05-16 /
  2026-05-17 (all 7 precedents in `docs/council/COUNCIL-LOG.md`)
- `~/.claude/skills/run-council/SKILL.md` Phase 5 §1.5 (location of promotion — Agent D
  handles T8)
- L-0292 (pre-council schema-reality-check — reduces reversal frequency, complementary)
- L-0293 (denormalized cache pattern — worked example of Gap 4 reversal, this council's 7th
  L-0147 precedent)

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
