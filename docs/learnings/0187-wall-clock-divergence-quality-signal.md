---
title: "Estimate divergence > 5x signals happy-path-only scoping — mandatory second reviewer before dispatch"
id: L_0187
status: accepted
layer: learning
created: 2026-05-04
updated: 2026-05-04
references:
  - ../decisions/0265-enforced-deployment-pipeline.md
---

# L-0187: Estimate divergence > 5x signals happy-path-only scoping — mandatory second reviewer before dispatch

## Why

Pipeline Consolidation v1 plan estimated 4–5 hours of work. After council review and a sideagent pass, 34 distinct fixes were surfaced that the original author had not accounted for. The actual work scope expanded to 2–3 days — a divergence factor of roughly 10×.

The v1 REJECT verdict (COUNCIL-LOG 2026-05-04) was not because the plan was wrong in direction; it was because the author had scoped only the happy path. Edge cases, ordering paradoxes, architectural inconsistencies, and cross-subsystem interactions were either overlooked or treated as implementation details. The council and sideagent independently found different non-overlapping gaps, which also triggered L-0188's asymmetric-reviewer observation (later demoted, but the underlying structure was real: 7 unique council items + 10 unique sideagent items = 17 items neither set saw without the other).

This pattern is not unique to this session. Any plan where the author is deeply familiar with the happy path but has limited cross-subsystem visibility is at risk.

## How to apply

- When a plan estimate comes in at 4h or less but involves more than 2 subsystems: treat the estimate as unverified.
- After any council review or sideagent pass produces a fix count ≥ N/5 where N is the original task count: flag the divergence explicitly. Divergence > 5× = mandatory second reviewer (council or specialist sideagent) before dispatch to implementation agents.
- In plan documents: add a `Scope confidence: [HIGH|MEDIUM|LOW]` field in the header. LOW = known happy-path-only. LOW plans require council before dispatch.
- Concrete signal: if a plan has fewer than 3 error-path tasks for every 10 happy-path tasks, it is likely happy-path-only.

## Pattern signature

- Plan author is also the primary implementer (no cross-check)
- Estimate < 6h for a multi-subsystem feature
- Error paths absent or terse in task list
- Council or reviewer adds ≥ 5 items that weren't in original plan

All four true → divergence > 5× is likely. Second reviewer required before dispatch.

## References

- `docs/plans/2026-05-04-pipeline-consolidation-v2.md` — v2 incorporates 34 v1-REJECT fixes
- `docs/council/COUNCIL-LOG.md` — 2026-05-04 Pipeline Consolidation v2 council entry
- `docs/decisions/0265-enforced-deployment-pipeline.md` — ADR governing the pipeline being planned
