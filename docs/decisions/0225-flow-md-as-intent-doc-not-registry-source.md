---
title: "FLOW.md as Intent Doc — NOT Registry Source"
id: ADR-0225
status: accepted
layer: decision
created: 2026-04-28
updated: 2026-04-28
---

# ADR-0225: FLOW.md as Intent Doc — NOT Registry Source

## Context and Problem Statement

The 2026-04-28 protocol-pipeline spec introduced FLOW.md — a chronological function list with one row per observable journey step. Schema requires every row's `event` field to be in `packages/telemetry/src/registry.ts`, with CI gate enforcing parity. Council 2026-04-28 found: spec's own examples reference 8 unregistered events (`page.loaded`, `step.scroll.50`, `step.form.submitted`, `step.api.subscribe_ok`, etc.). ADR-0175 (telemetry contract) caps journey events at frozen-5. Adding per-row events would either explode registry from O(constant) to O(steps × journeys), or violate ADR-0175.

## Decision Drivers

- ADR-0175 telemetry contract: frozen-5 journey events (`run_started`, `step_reached`, `completed`, `stuck`, `run_failed`)
- ADR-0196 Invariant 11: no phantom emits (every emit-call has registry entry)
- `journey step_reached` already has polymorphic `step_key` payload — same mechanism FLOW.md needs
- L-0076 (this council): five phantom contracts simultaneously authored; FLOW.md was one
- Dashboard / observability use cases for FLOW.md: live timing render, e2e generation, regression tracking — none require new event names

## Considered Options

1. **Option A — FLOW.md is intent doc only, not registry source.** Examples are illustrative. Real implementation maps FLOW.md rows to existing `journey step_reached` events with `step_key` payload + per-row `expected_ms` annotation. Dashboard reads existing events, FLOW.md provides display schema. CI gate becomes "every FLOW row's `step_key` matches an `journey.md` step.key" — not "event name is in registry".
2. **Option B — Pattern-based registry contract.** ADR-0175 amendment to allow journey-scoped event namespaces. Each journey can declare its own event names. Registry validates pattern, not exact match. ADR-class change.
3. **Option C — Drop FLOW.md schema entirely.** Use existing telemetry-driven dashboards on `journey_event` table without per-journey docs.

## Decision Outcome

Chosen option: **"Option A"**, because:
- Existing `journey step_reached` event already carries `step_key` payload — purpose-fit for the closed-loop spine
- ADR-0175 frozen-5 contract preserved
- FLOW.md becomes valuable display/intent schema without expanding wire-level event namespace
- Dashboard implementation: subscribe to `journey step_reached`, group by `step_key`, render against FLOW.md row schema
- `e2e.spec.ts` generator (when built) reads FLOW.md rows + emits Playwright assertions on existing `journey step_reached` events with `step_key` filter

This ADR explicitly **forbids** treating FLOW.md `event:` field as a new event name. The field documents *what existing event marks this row's completion*, with `step_key` payload value implied. A future minor-revision of FLOW.md schema may rename `event` → `marker` to clarify, but the semantic is: marker = `journey.step_reached` with `step_key=<row.name>`.

Until a generator + dashboard exist, FLOW.md remains **INTENT, NOT IMPLEMENTED** per banner in `05-protocol-pipeline.md` §5.

## Rules & Consequences

- **Good, because** ADR-0175 frozen-5 contract preserved.
- **Good, because** existing `step_reached` polymorphism reused (no new wire-level ontology).
- **Good, because** FLOW.md still serves authoring + dashboard intent without phantom-emit risk.
- **Bad, because** "every row has a registry-bound event" claim in current spec must be reworded — `event:` field is documentation, not registry pointer.
- **Bad, because** `event_name` field naming is misleading; future rename to `marker` would be cleaner but breaks any drafts.
- **Agent Impact:** Authors writing FLOW.md must understand `event:` field is a documentation marker mapping to existing `step_reached` event. Future code-trace verifications must check `step_key` payload match, not event-name registry match.

## References

- `docs/engines/system-intelligence/05-protocol-pipeline.md` §5 (FLOW.md schema)
- `.claude/skills/journey-protocol/references/flow-md-schema.md`
- `packages/telemetry/src/registry.ts:5194-5259` (frozen-5 journey events)
- ADR-0175 (telemetry contract)
- ADR-0196 (phantom-emit invariants)
- L-0076 (phantom contracts simultaneously authored)

---

> After writing: register in `docs/decisions/0000-decision-log.md`.
