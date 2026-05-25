---
title: L-0346 Phase 3 N≥10-item triage requires upfront N≥3 reviewers
id: L-0346
status: canonical
updated: 2026-05-24
created: 2026-05-24
module: meta
tags: [council, phase-3, scope, reviewer-fanout, triage]
related: [L-0147, L-0294]
---

# L-0346 — Phase 3 N≥10-item triage requires forced upfront N≥3 reviewers

## What happened

Journey-sweep 2026-05-24 council reviewed a 22-bug triage (`docs/test-runs/2026-05-23-journey-sweep/BUGS.md`). Chair Phase 3 (single reviewer) produced a comprehensive but error-prone analysis. Phase 5 synthesis surfaced **5 chair self-reversals + 1 partial reversal** — the most reversals in any single Phase 5 to date (per `docs/learnings/0294-seventh-l0147-precedent-promote-to-skill-hard-rule.md`).

Reversals were on substantive claims:
- BUG-15 = ADR-0238 regression → REVERSED (OPS-1 cascade)
- BUG-20 = cascade from BUG-1 → REVERSED (independent fixture bug)
- BUG-3 + BUG-7 + BUG-11 part of BUG-1 family → REVERSED (3 independent defects, not cascade)
- BUG-8 = 15-min single-table fix → REVERSED (83-table sweep)
- BUG-13 = route-migration debt → REVERSED (testids never existed)

**Root cause: chair Phase 3 had limited code-trace bandwidth past ~5 items.** Across 22 bugs the chair generalized from prose-level reasoning. Sibling reviewers with code-trace evidence falsified 5 of those generalizations.

## Why it matters

This is the L-0147 family at structural scale. Single-reviewer Phase 3 works on small councils (N=1 spec, N=3 bugs). It systematically fails on N≥10-item triage councils because:
- Code-trace per item exceeds reviewer attention budget
- Generalizations across items hide per-item nuance
- Phase 5 chair must reverse multiple claims simultaneously — increases cognitive load + risk of cascading miscorrection

## How to apply

**Skill rule:** Any Phase 3 council on a triage list with N≥10 distinct items MUST fan out to N≥3 sibling reviewers in parallel BEFORE chair synthesis. Chair does NOT do solo Phase 3 on large triages.

This already happened in the journey-sweep council (5/5 reviewers dispatched) — but only after the chair had already published a single-reviewer Phase 3. **Going forward: orchestrator dispatches multi-reviewer Phase 3 from the start on any N≥10 triage.**

## Sibling patterns

- [[L-0147]] — Chair Phase 3 → Phase 5 reversal protocol (9+ codified instances)
- [[L-0294]] — L-0147 promoted to enforced hard rule (this learning is the structural-scale axis)

## Precedent count

1st codified occurrence of "many-reversals-in-one-synthesis" pattern. Trigger threshold: 3+ reversals in a single Phase 5 = automatic L-0346 promotion + this rule activated retroactively for that council type.
