---
title: "Registered telemetry event without producer is a phantom contract"
id: LEARNING_0083
status: canonical
layer: learning
created: 2026-04-20
updated: 2026-04-20
tags: [telemetry, contracts, helpdesk, registry-integrity]
---

# Learning-0083: Registered telemetry event without producer is a phantom contract

## Context

`packages/telemetry/src/registry.ts:2762` declares `HelpdeskQueryReassigned` and `registry.ts:5864` routes it through posthog + logger + activity_trail + engine_event. The helpdesk engine_process seed (`20260515130200_helpdesk_query_process_seed.sql:81`) references the event via `event_type_any_of: ['helpdesk.query.resolved', 'helpdesk.query.reassigned']`. STATE-SUMMARY listed "Reassign dropdown" as a UI-only Phase 1.1 item.

Agent-coord code-trace 2026-04-20 revealed: **no code emits `helpdesk.query.reassigned`**. `packages/ai/src/capabilities/helpdesk_query/` exports exactly four tools — `openTicket`, `listMyQueue`, `getTicket`, `resolveTicket`. No `reassignTicket`. No web Server Action, no mobile mutation, no engine-dispatch step producing the event. The event exists in the registry as an aspiration.

## Discovery

Registering a telemetry event in the type-union + routing map creates a **false surface of readiness**. Readers of the registry assume: "it's declared, therefore something emits it, therefore the downstream (engine_process step 2, UI, analytics) can rely on it."

In reality, the lifecycle looks like:
1. Registry declaration — 1 minute.
2. Producer (capability tool OR Server Action OR mobile hook OR trigger) — hours-to-days.
3. Consumer (engine_process step, UI, telemetry analysis) — additional hours.

When step 1 ships but step 2 doesn't, step 3 wires against a non-existent contract. No runtime error — just silent dead weight. In our helpdesk case, engine_process step 2 waits forever for an event nothing emits, AND Phase 1.1 "reassign dropdown" was scoped as UI-only because the registry claim implied the producer existed.

## Impact

Two rules going forward:

1. **No registry entry without a producer in the same PR.** Adding `EventInterface` + routing must be atomic with the first `emit()` call that produces the event. If the producer is Phase 2, the registry entry waits for Phase 2. "Pre-registering the contract" is a smell — it pretends readiness that isn't there.
2. **Code-tracer (Layer 4) Phase-3 review must grep every newly-registered event name across code paths.** Zero emit sites = reject the registry entry.

Generalizes to any typed contract: Zod schema without a validator site, enum value without a consumer, RPC signature without an invoker. Registering the shape without the behavior is a silent-ship pattern.

## References

- `packages/telemetry/src/registry.ts:2761-2769` — HelpdeskQueryReassigned declaration.
- `packages/telemetry/src/registry.ts:5864` — routing table entry.
- `supabase/migrations/20260515130200_helpdesk_query_process_seed.sql:81` — wait_for_event anchor.
- `packages/ai/src/capabilities/helpdesk_query/index.ts:7` — exports exclude reassignTicket.
- Origin: 2026-04-20 verification council, agent-coord Layer 4 trace.
- Related: L-0061 (orphan capability tools dormant until engine_trigger points at them).
