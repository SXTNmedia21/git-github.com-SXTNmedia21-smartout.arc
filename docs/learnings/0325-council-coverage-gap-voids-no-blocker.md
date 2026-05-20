---
title: "L-0325: Council 'no-blocker' verdicts that assume an unverified precondition are void"
id: L-0325
status: accepted
created: 2026-05-20
updated: 2026-05-20
module: governance
tags: [learning, council, code-trace, coverage-gap, l-0147]
---

# L-0325: 'no-blocker' verdicts assuming an unverified precondition are void

## Context

ADR-0379 council (2026-05-20). Three reviewers, apparent conflict:
- **Supervisor:** REJECT — traced the entry-point invocation, found it unwired.
- **Agent-coord:** "no code defect blocks merge" — but explicitly did NOT trace the
  entry-point; analyzed gate semantics *assuming* an engine_state exists.
- **Harness:** happy-path "structurally sound" — its trace diagram *fabricated* an
  "engine-dispatch POST (internal call)" node with no cited caller.

## Learning

**This was NOT a genuine disagreement — it was a coverage gap masquerading as conflict.**
The three reviews analyzed different pipe segments. Supervisor analyzed the broken segment;
the other two analyzed downstream segments assuming the broken segment works.

**When reviewers analyze different segments of a pipeline, a downstream "no blocker" does
NOT net against an upstream "broken." The downstream verdict is VOID until the precondition
it assumes is independently confirmed.** The reviewer who code-traced the precondition and
falsified it wins (extends L-0147 to multi-segment pipelines).

## How to apply

- Chair must, in Phase 5, classify reviewer verdicts by WHICH pipe segment each analyzed.
  A permissive verdict that assumes an unverified upstream precondition is conditional, not
  clean — mark it void-until-confirmed, do not average it against the falsifier.
- A reviewer asserting a pipeline edge (e.g. "then engine-dispatch POSTs…") MUST cite the
  caller (file:line) or mark the edge UNVERIFIED. A fabricated/assumed caller node is the
  diagram-equivalent of the head-truncated-output false-negative family.
- Phase 2.5 / Phase 3 trust gate: for event-driven mutations, assign ONE reviewer the
  explicit "trace the invocation edge — who calls the entrypoint" mandate. Do not let all
  reviewers start downstream of the entry-point.

## References

- Council 2026-05-20 (ADR-0379 REJECT)
- L-0147 (chair self-reversal — falsifier wins)
- L-0324 (pgTAP-green ≠ runtime-functional — the precondition that was unverified)
