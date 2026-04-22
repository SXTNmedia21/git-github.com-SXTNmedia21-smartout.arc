---
title: "registerEvent() without extends BaseEvent is untyped at emit sites"
id: LEARNING_0072
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [telemetry, typescript, registry, discriminated-union, emit]
---

# Learning-0072: `registerEvent()` without `extends BaseEvent` is untyped at emit sites

## Context

Year Wheel Redesign Council (2026-04-20). The spec proposed six new telemetry events. Its migration step 0 instructed implementers to "register the six new events in `packages/telemetry/src/registry.ts`". The Agent Coordinator's code-trace flagged this as a BLOCKER: `registerEvent()` alone does not type-check the shape of `emit()` call sites.

## Discovery

`packages/telemetry/src/registry.ts` enforces event shape through a **discriminated union type** over `export interface X extends BaseEvent { event: "<literal>"; properties: { ... } }` declarations. The runtime `EVENT_REGISTRY` / `registerEvent()` is a separate artifact — it drives destinations and routing, not type safety.

If an event is registered at runtime but not added to the TS union:

- `emit({ event: "new_thing", ... })` passes type-check **only if** `"new_thing"` matches some existing literal; otherwise it fails loudly (which is fine).
- If the author widens the union ad-hoc (`event: string`), the `properties` shape is unconstrained — any payload is accepted at compile time, then silently mismatches the destination contract at runtime (see L-0038 for activity_trail silent-drop).

The trap: the spec said "register the event" without specifying the dual-registration requirement. A developer following the spec literally would add a single `registerEvent()` entry, then spend debugging cycles understanding why `emit()` either won't compile or accepts the wrong shape.

## Impact

### Rule

Every new telemetry event requires **both**:

1. A TypeScript `export interface X extends BaseEvent { event: "<literal>"; properties: { ... } }` declaration, added to the discriminated-union `Event` type.
2. A `registerEvent()` runtime entry with `destinations` + `category`.

Missing either makes `emit()` untyped or unroutable. Neither half is sufficient.

### How to apply

- When writing a spec that adds telemetry events, spell out both halves as separate migration steps or sub-bullets. Don't collapse to "register the event".
- Audit tool: grep `registerEvent(` without matching `extends BaseEvent` for the same event literal to find untyped events in the registry.
- The 2026-04-20 council promoted this from implicit convention to explicit rule after three councils (2026-04-16 Botsson R2, 2026-04-17 Post-Audit, 2026-04-20 Year Wheel) each surfaced a variant of the "emit → destination" gap.

### Paired learnings

- L-0038 (activity_trail silent-drop via missing `properties.entity`) — provider-side enforcement.
- L-0041 (registry-declaration gap — governance events declared `["posthog"]` but expected `activity_trail`) — registry-side declaration drift.
- L-0072 (this) — type-side enforcement: both halves must exist.

## References

- Spec: `docs/superpowers/specs/2026-04-20-year-wheel-redesign-design.md` §7
- ADR-0164: Season-namespace unification (separate but entangled with this rule)
- Council: `docs/council/COUNCIL-LOG.md` 2026-04-20 session
- Registry: `packages/telemetry/src/registry.ts` (see the `SeasonCreated` pair at lines 1120–1126 + 5217–5220 for a correct dual-registration example)
