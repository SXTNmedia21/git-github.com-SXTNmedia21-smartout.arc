---
title: "Dead infrastructure has a clock — wire it before new work"
id: L-0067
status: accepted
layer: learning
module: meta
created: 2026-04-19
updated: 2026-04-19
tags: [learnings, dead-code, governance, deadlines]
---

# Learning-0067: Dead infrastructure has a clock — wire it before new work depends on it

## What Happened

The 2026-04-13 council on Communications/Chat/Channels flagged two tables as dead: `channel_ai_policy` (zero consumers) and `channel_event` (zero consumers). Both had schema, both had RLS, both had index design. Neither had any code path writing or reading them. The council set a 90-day deadline (expires 2026-07-13): wire them up with real consumers or drop them.

The 2026-04-19 helpdesk council, six days later, proposed a feature that **depends on both tables**: `channel_event` for ticket state transitions, `channel_ai_policy` for per-desk AI-representative behavior. But the feature's phasing placed the wiring work in Phase 2 (after schema ships in Phase 1). This pattern repeats L-0029 (speculative infrastructure added for future use; future never arrives in intended form).

Two failure modes stacked:
1. The dead tables stayed dead for another feature cycle, consuming the 90-day buffer.
2. The helpdesk feature would ship with its own ad-hoc state event log, duplicating `channel_event` or writing to `engine_event` only — either way, `channel_ai_policy` remains unread.

## What We Learned

Dead infrastructure has three properties that make "we'll wire it when we need it" fail:

1. **Shape drift:** The dead table was designed for a use case that no longer matches when a real feature arrives. Six weeks of codebase evolution has moved the patterns around it.
2. **Test gap:** Dead tables have no integration tests, no query patterns, no performance baselines. The first real consumer has to build all that from scratch.
3. **Governance erosion:** Each time a feature lands without wiring dead infra, the deadline becomes less credible. After three misses, nobody takes the deadline seriously.

The anti-pattern is: "Let's add `feature_config` with all the columns we might need; we'll wire it later." The correct pattern is: "We don't add `feature_config` until the first consumer is ready to both read and write it, in the same PR."

For infrastructure already flagged dead with a deadline, the rule is stricter: **any feature that touches the dead infra's domain must either wire it in the same phase or explicitly propose its deletion.** Deferring to "Phase 2" is a decision to miss the deadline.

## The Rule

1. **Deadline-blocking inventory:** Before any new feature enters a phase-planning discussion, grep for dead infrastructure in the feature's domain. If found, the feature plan has two options:
   - Wire the dead infra in the same phase as the feature ships (blocking).
   - Explicitly propose deletion (blocking — requires ADR).
2. **No "Phase 2 wiring" for deadline-flagged infra.** If the council flagged a table dead with a deadline, a new feature that depends on it cannot defer the wiring. Either ship with it wired, or ship without depending on it.
3. **Council tracking:** Each council must check prior councils for open deadlines in the same domain. A feature that fails to address an open deadline is a scope gap.

## References

- Council 2026-04-13 — flagged `channel_ai_policy` + `channel_event` dead, 90-day deadline.
- Council 2026-04-19 — helpdesk feature depends on both; chair required wiring in Phase 0 Week 2.
- L-0029 — four parallel permission mechanisms (precedent for speculative infra).
- ADR-0160 — wires `channel_event` as projection of `engine_event`.
- ADR-0162 — requires `channel_ai_policy` read-path in `packages/ai/src/capabilities/communication/policy.ts:66`.
