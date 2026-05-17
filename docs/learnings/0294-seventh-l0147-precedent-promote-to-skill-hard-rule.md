---
title: "L-0294 — at-least-9th L-0147 chair self-reversal precedent — promote to SKILL.md hard rule"
id: LEARNING_0294
status: canonical
layer: learning
created: 2026-05-17
updated: 2026-05-17
tags: [council, l-0147, chair-self-reversal, skill-promotion, meta-protocol]
related: [L-0147, L-0261, L-0289, L-0292, L-0293, run-council-SKILL]
---

# Learning-0294: at-least-9th L-0147 chair self-reversal precedent — promote to SKILL.md hard rule

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

As of 2026-05-17, this protocol has been triggered **at least 9 times** across documented
councils. Counting is contested between authors due to sub-axis vs whole-verdict accounting:
L-0261 (2026-05-14) records "8th L-0147 Chair Self-Reversal precedent"; L-0289 (2026-05-17,
earlier session) records "6th occurrence." This session documents a further instance —
bringing the floor count to 9 (at minimum 8 prior + this = 9, far above threshold regardless
of accounting method).

**Counting ambiguity itself is signal:** the pattern fires so often that authors disagree on
count. SKILL.md promotion eliminates ambiguity by enforcing the protocol structurally.

| # | Date | Council | Reversal subject |
|---|------|---------|-----------------|
| 1 | 2026-04-20 | Year Wheel Redesign | Trust Gate Phase 3 PASS → Phase 5 FAIL after Agent-coord code-trace |
| 2 | 2026-04-28 | /dashboard/help | Phase 3 REJECT → Phase 5 APPROVE-as-tier after frontend layout brought new evidence |
| 3 | 2026-04-28 | ADR-0216 | Phase 3 Option A2 → Phase 5 Option B after Supervisor 139-site blast-radius scan |
| 4 | 2026-05-09 | S6 R4 | Chair Phase 3 → Phase 5 reversal on capability scope |
| 5 | 2026-05-14 | WFM merge council | L-0261 records "8th L-0147 Chair Self-Reversal precedent" (sub-axis accounting) |
| 6 | 2026-05-14 | (earlier, same date) | L-0264 records "L-0147 4th occurrence" (whole-verdict accounting — count divergence) |
| 7 | 2026-05-16 | Chat-WhatsApp | Phase 3 → Phase 5 hold-with-refinement (per L-0276/0278) |
| 8 | 2026-05-17 (earlier session) | Phase 7d original pivot | L-0289 "6th occurrence" — ADR-0250 misread + source-priority reversal (counted as 2 reversals by sub-axis method) |
| 9 | 2026-05-17 (this council) | Phase 7d-followup | Gap 4 + Gap 5 both reversed — ADR-0353 §A schema conflict + ADR-0351 Option C structurally-invalid CHECK |

Note: L-0261 "8th" and L-0264 "4th" describe sessions on 2026-05-14 using different counting
units (sub-axis vs whole-verdict). The exact number of unique council sessions where at least
one reversal occurred is at minimum 7, with sub-axis count at minimum 9. Either number
exceeds the 3-occurrence SKILL.md promotion threshold by a wide margin.

**Phase 9 promotion threshold:** SKILL.md Phase 9 Step 4 mandates: "If the same process
improvement has appeared in `council_meta.md` 3+ times across different sessions, promote it
into SKILL.md as a hard rule." Threshold long exceeded.

**Pattern signature (consistent across all documented occurrences):**

Chair operates on incomplete scope — prose-level reasoning without live code-trace. Two or
more reviewers with code-trace evidence vote opposite to the chair's Phase 3 verdict. Chair
must reverse explicitly in Phase 5 synthesis, not rationalize as REFINED or HELD-with-
conditions. The reversal protects against L-0176 anti-pattern (docstring drifting from body —
here read as "ADR prose drifting from code").

## Impact

**Required SKILL.md change (Sortie 1 T8 — Agent D executes):**

`~/.claude/skills/run-council/SKILL.md` Phase 5 §1.5 must be updated to:

1. Promote L-0147 from advisory text to enforced SKILL.md hard rule
2. Add the precedent table (9+ dates, with counting-ambiguity note)
3. Extract the canonical format block from prose — make it a quoted, standalone block:
   ```
   Phase 3 claim X was [TRUE/FALSE].
   Falsifying evidence: <file:line citation>.
   Classification: REVERSED.
   ```
4. Add to Common Mistakes table:
   - Mistake: "Chair rationalizes Phase 3 verdict instead of explicit REVERSAL"
   - Resolution: "Per L-0147 protocol (9+ precedents as of 2026-05-17, counts vary by author
     — see L-0261 '8th' and L-0289 '6th'), self-reversal must be named explicitly with
     falsifying citation. Use canonical format above."

**Enforcement:** Future councils must treat Phase 5 synthesis failure to issue explicit
REVERSED classification (when 2+ reviewers have code-trace evidence) as a council protocol
violation. The SKILL.md hard rule surfaces this in Phase 5 §1 header — before synthesis
begins.

**Complementary pattern:** L-0292 (pre-council schema-reality-check) REDUCES future Phase 5
reversal frequency by catching falsifications before Phase 2 dispatch. L-0147 HANDLES
reversals that still reach Phase 5. Both are needed; they operate at different council phases.

## References

- L-0147 (original advisory text that this learning promotes to hard rule)
- L-0261 (2026-05-14) — "8th L-0147 Chair Self-Reversal precedent" (sub-axis accounting)
- L-0264 (2026-05-14) — "L-0147 4th occurrence" (whole-verdict accounting — count divergence)
- L-0289 (2026-05-17 earlier session) — "6th occurrence" (Phase 7d original pivot)
- Council sessions across 2026-04-20 / 2026-04-28 / 2026-05-09 / 2026-05-14 / 2026-05-16 /
  2026-05-17 (in `docs/council/COUNCIL-LOG.md`)
- `~/.claude/skills/run-council/SKILL.md` Phase 5 §1.5 (location of promotion — Agent D
  handles T8)
- L-0292 (pre-council schema-reality-check — reduces reversal frequency, complementary)
- L-0293 (denormalized cache pattern — worked example of Gap 4 reversal, this council)

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
