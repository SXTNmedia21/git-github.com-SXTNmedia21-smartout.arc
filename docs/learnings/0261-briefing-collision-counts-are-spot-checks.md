---
title: "Briefing collision counts are spot-checks, not authoritative totals"
id: L-0261
status: canonical
created: 2026-05-14
updated: 2026-05-14
module: governance
tags: [council, briefing, code-trace, quantitative-claims, adr-0325, l-0147]
---

# L-0261: Briefing collision counts are spot-checks

## Context

2026-05-14 ADR-0325 council (tool-name discipline follow-up). Three different counts appeared for the same "how many tool-name collisions exist" question:

- Briefing said: **9 collisions**
- Supervisor spot-check found: **5**
- Harness Builder full sweep found: **11** (authoritative)

All three reviewers were working from the same codebase. The differences arose from grep scope and whether non-mounted bridges were included in the count.

## Learning

**Quantitative claims in briefings are spot-checks, not authoritative totals.** When a briefing asserts "N instances of X," that count is bounded by the reviewer's grep scope and time budget at briefing-write time.

**Counter-detection pattern:** Any "N instances" claim in a council briefing should be flagged for full sweep before voting on options that depend on the count. Acceptable evidence form: `grep -rn 'pattern' path/ | wc -l` with the raw output cited.

**Same class as L-0147** (generalization-vs-falsification) but specifically about quantitative claims. L-0147 covers "briefing claim falsified by code-trace." L-0261 is the narrower pattern where the claim is quantitative and multiple reviewers return different numbers.

**Chair Phase 5 protocol:** When reviewers code-trace a briefing count and return different numbers, the chair must:
1. Identify the broadest-scope grep (full sweep wins over spot-check)
2. Reconcile: `spot-check ≤ briefing-count ≤ full-sweep` is expected; `full-sweep < briefing-count` means briefing over-counted
3. Record all three numbers and label their provenance in the council log

## Cross-references

- ADR-0325 (tool-name discipline — council where this surfaced)
- L-0147 (Chair self-reversal on falsified briefing claims — parent pattern)
- L-0253 (Chair must grep before asserting negative counts — sibling, negative-count variant)
- COUNCIL-LOG.md 2026-05-14 late evening (6th codified L-0147 precedent)
