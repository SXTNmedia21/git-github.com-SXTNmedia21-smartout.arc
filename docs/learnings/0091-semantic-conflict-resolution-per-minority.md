---
title: "Semantic Conflict Resolution Must Be Explicit Per-Minority in Council Synthesis"
id: LEARNING_0091
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [council, process, synthesis, meta-learning]
---

# Learning-0091: Semantic Conflict Resolution Must Be Explicit Per-Minority

## Context

The Auth & Invitation Spec Scope Council (2026-04-20) had 4 reviewers answering 25 questions. The answer matrix produced **5 three-to-one minority positions** and **5 two-to-two splits** out of 25 questions — i.e., 40% of decisions had non-trivial disagreement. If the chair had applied naïve "majority wins" resolution:

- Q17 (/join wizard) would have silently adopted hybrid without addressing system-steward's cascade-integrity concern (Botsson without `workspace_id` degrades authority + channel-pinning).
- Q11 (dialog split) would have adopted defer without explaining why frontend-designer's design-coherence argument loses.
- Q16 (/welcome flow), Q19 (login default), Q22 (confirmation style), Q25 (test coverage) — each minority position carried domain-specific signal that would have been dropped.

The steward's Phase 5 synthesis explicitly classified each minority as `right / wrong / partial` with named reasoning. In several cases (Q17, Q19, Q22) the minority was substantively right on part of the issue even while being outvoted — the synthesis preserved those concerns as implementation constraints (e.g., Q17=c hybrid WITH Botsson `requiresWorkspace: false` constraint) rather than discarding them.

## Discovery

Multi-reviewer councils produce two classes of disagreement that naïve majority-wins handles poorly:

1. **3-1 minority positions** — the majority is often right on direction but the minority often catches a domain-specific risk the majority missed. Dropping the minority without analysis loses domain signal. Example: Q17 — 3 reviewers said "hybrid is fine for /join", steward alone said "Botsson in a pre-workspace context breaks ADR-0078 channel-pinning." Steward was right on the risk; synthesis added a constraint to keep the hybrid verdict but address the risk.

2. **2-2 splits** — often "same/different/partial overlap" disagreements where reviewers are talking past each other. The chair must classify the disagreement type before picking a side. Example: Q3 (ADRs now vs when-implementation-hits) was **partial overlap** — all agreed on capture, disagreed on timing. Synthesis split the difference: write 3 load-bearing ADRs now, drop 2 deferrable ones.

Without an explicit classification step, synthesis silently adopts the majority and loses:
- Domain-specific risk signal from minority positions.
- Semantic clarity on whether disagreements are substantive or terminological.
- Traceable reasoning for future councils ("why did we pick X over Y?").

## Impact

- **Council SKILL.md Phase 5 requirement (promote to hard rule, 3rd occurrence):**
  - Every 2-2 split: classify as `same / different / partial overlap` with one-sentence reasoning, THEN pick a side.
  - Every 3-1 minority: classify as `right / wrong / partial (right on X, wrong on Y)` with reasoning, THEN decide whether to adopt majority, adopt minority, or adopt majority-with-minority-constraint.
  - Never use compatible-sounding language to paper over conflicts ("both are valid perspectives") — that pattern was flagged in 2026-04-15 meta-memory ("EE orchestrates handoffs" vs "EE IS canonical coordinator" was silently papered over).
- **This council as positive precedent:** steward's Phase 5 matrix (5 minorities + 5 splits, each explicitly classified) demonstrates the discipline. Future councils with high-disagreement topics should reference this structure.
- **Promotes to SKILL.md:** This is the 3rd occurrence of "synthesis papers over conflicts" in meta-memory (2026-04-15, 2026-04-17 post-audit, 2026-04-20 auth). Promote from advisory to enforced rule.

## References

- Council SKILL.md Phase 5 synthesis instructions (already requires semantic conflict resolution — this learning promotes it to enforced per-minority classification)
- Council meta-memory `council_meta.md` (Process Improvements — 2026-04-15, 2026-04-17 prior occurrences)
- Auth & Invitation Spec Scope Council (2026-04-20) — positive precedent with full matrix

---

> Registered in `docs/learnings/0000-learning-log.md`.
