---
title: "Grep-count audit inflation — recurrence of L-0054 pattern"
id: LEARNING_0113
status: canonical
layer: learning
created: 2026-04-22
updated: 2026-04-22
tags: [council, briefing-discipline, code-trace, scope-inflation, l-0054-recurrence, authority, pathway-b]
related: [LEARNING_0054, LEARNING_0108, LEARNING_0112, ADR_0190]
---

# Learning-0113: Grep-count audit inflation — recurrence of L-0054 pattern

## Context

The 2026-04-22 Pathway-B Authority Council (producing ADR-0190) opened with a briefing that cited **108 pathway-B call sites across apps+packages**. Phase 2.5 fact-check corrected this to **43 "lines across 5 non-infrastructure files"** — already a reduction but still framed as substantial surface area. The Chair accepted the 43 figure into Phase 3 briefing. Supervisor's Phase 3 code-trace, asked to *verify concentration per file*, returned:

> **Actual production call sites: 7.** Not 43.

The delta matters: the 108 → 43 → 7 progression corresponds to three different scoping discplines:

- **108** = every mention of pathway-B helpers anywhere (grep for the symbol strings across the repo, no filter).
- **43** = grep with file-extension filter + excluding tests/mocks/types, but still counting docstrings, the helper definitions themselves, and the re-export files.
- **7** = AST-verified production invocations — expression-level matches on the helper call, in two files (`people-actions.ts` × 6, `season-actions.ts` × 1).

The briefing's 108 came from "pathway-B references across apps+packages". The 43 came from the Steward's narrowing in Phase 3. Only the 7 was defensible to a control-design decision.

This is a direct repeat of the pattern documented in L-0054 (grep-based site inventories inflate scope), last formalized during the Gate-Client Wave 2 council (2026-04-18). That council rescoped 18-site → 7-site after Supervisor's Trust Gate rejected grep-count-based planning. The same pattern, the same correction, the same council, five months later.

## Discovery

**Briefing fidelity is proportional to the specificity of the grep.** The narrower the question, the more trustworthy the count. Three rules operationalize this:

1. **No grep-count survives to Phase 5 without a code-trace.** A claim of the form "N call sites" must be backed by a tool that distinguishes production invocations from test fixtures, re-exports, type declarations, and documentation. If the briefing cites a count, the Phase 2.5 fact-check MUST verify the count at expression level, not line level.
2. **The two orders of magnitude between raw-grep and AST-verified is predictable.** Empirically across the 2026-04-18 and 2026-04-22 councils: raw grep inflates true call-site count by 4× to 15×. Any briefing claim ≥ 20 production call sites should be suspect by default.
3. **The cost of grep-inflation is not cosmetic — it sizes controls wrong.** In this council, a 43-site framing would have justified CI-heavy aggression (broad static gates, exemption registries, full re-coverage audits). The 7-site reality supported lighter-touch controls (inline typed exemptions, per-file migration). Over-aggressive controls against 7 sites create review fatigue, exemption sprawl, and long-tail maintenance — a different failure mode, but still a failure.

## Impact

**Process-level:**
- `run-council` skill Phase 2.5 fact-check now requires expression-level verification of any grep-cited count above ~10. Template addition: *"For every numeric claim 'N call sites/instances/occurrences', spot-check via AST or grep-with-expression-match. Flag any claim that cannot be verified at expression level."*
- Scout/audit agents dispatched to enumerate call sites must return BOTH raw grep count AND expression-verified count as separate fields. The delta between them is the audit-inflation signal.
- Councils touching call-site migration MUST produce trace-verified counts before Phase 5. The "at least one reviewer is assigned code-tracer mandate" rule (already in skill) is reaffirmed as load-bearing.

**Design-level:**
- ADR-0190's Control 2 design was materially tighter because the corrected 7-count arrived before Phase 5 synthesis. Had it arrived during implementation, rework would have been measurable (exemption format, scanner scope, CI wiring).
- The entity-type coverage script (Control 2) inherits a benefit: with only 7 sites today, Stage 1 is near-zero-cost hygiene. A 43-site reality would have made Stage 1 itself a migration project.

**Meta-level:**
- This is L-0054's second formal recurrence (the first was 2026-04-18 Wave 2; implicit prior instances exist but weren't logged). Promoting L-0054 into skill-level enforcement is now justified by the 3× recurrence rule documented in `council_meta.md`. Phase 9 of this council proposes the SKILL.md promotion.

## References

- L-0054 — `grep-based-site-inventories-inflate-scope.md` (original formalization, 2026-04-18).
- L-0108 — `code-trace-catches-what-grep-briefing-misses.md` (adjacent pattern, 2026-04-22 campaign).
- L-0112 — `two-gate-pathways-parity-covers-one.md` (the learning whose briefing triggered this recurrence).
- ADR-0190 — Authority parity for cascade_gate_write (consumed the corrected count in its Drivers + Ship Order).
- Council 2026-04-18 — Gate-Client Wave 2 (prior recurrence; 18-site → 7-site correction).
- Council 2026-04-22 — Pathway-B Authority Gate (this council).

---
