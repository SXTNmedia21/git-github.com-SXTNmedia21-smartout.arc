---
title: "Two emit owners for same semantic event = contract divergence — single canonical producer per event name in ADR"
id: L_0184
status: accepted
layer: learning
created: 2026-04-30
updated: 2026-04-30
references:
  - ADR-0246
  - ADR-0248
  - ADR-0216
---

# L-0184: Two emit owners for same semantic event = contract divergence

## Why

ADR-0246 brief proposed mission-pool worker (Arena Harness construct) emits `journey.completed/stuck/run_failed`. ADR-0216 §B5 named action handlers (engine-dispatch layer) as emit producer for `engine_step/run.*` lifecycle events.

Two producers for overlapping semantic events:
- Drift inevitable (event payload schemas evolve independently)
- Consumer-side dispatch ambiguous (which producer's row is canonical?)
- Code review gate has no clear pass/fail (both producers compile, both look right)
- Telemetry dashboards double-count or miss events

ADR-0248 closes this by naming B5 action handlers as canonical emit producer; mission-pool worker MUST invoke B5, not emit directly.

## How to apply

**Hard rule:** Each event name has exactly one canonical producer named in an ADR. Multiple call sites within that producer are fine; multiple distinct architectural producers are not.

Code review check:
- For any new `emit('namespace.event_name')` call, grep all other call sites for the same event name across the repo.
- If 2+ files emit the same event name AND they are in distinct architectural layers (capability vs stage-engine vs Edge Function vs Arena Harness worker vs BFF), block.
- Demand: which ADR names the canonical producer? Is the new emit inside the canonical producer's layer?

Council preflight:
- When a brief proposes a new emit call, demand named producer + reference to canonical-producer ADR.
- If no ADR names a canonical producer, draft one alongside the brief (ADR-0248 was drafted alongside ADR-0246 for exactly this reason).

## Pattern signature

- Brief proposes a new orchestrator/worker/runtime construct that emits
- Existing ADR names a different layer as emit producer
- Brief does not cite the existing ADR
- Reviewers in Phase 3 catch the conflict

When all four are true: split into (a) ADR ratifying the existing producer, (b) construct invokes producer rather than emitting directly.

## Why this matters

Two-owner emit drifts in two ways:
1. **Schema drift.** Producer A adds field `reason_code`; producer B never adds it. Consumer reads field, half the rows have it, half don't.
2. **Semantics drift.** Producer A emits `journey.completed` only on success; Producer B emits it on any terminal state. Consumer assumes success-only and bills for completion incorrectly.

Both drifts are silent at compile time and explosively expensive at debug time.

The fix is naming, not coordination meetings: one producer, one ADR, one code-review gate.
