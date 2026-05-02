---
title: "Phantom-emit risk in schema migration phases — split schema cutover from emit"
id: L_0182
status: accepted
layer: learning
created: 2026-04-30
updated: 2026-04-30
sibling_of: L-0094
references:
  - ADR-0246
  - ADR-0248
  - L-0094
  - L-0130
---

# L-0182: Phantom-emit risk in schema migration phases

## Why

When a migration phase ships emit calls for events whose producer or consumer does not yet exist, telemetry is polluted with no observability gain. ADR-0246's original Phase A4 (single phase: schema cutover + emit) caught this pattern in Phase 3 Trust Gate.

## How to apply

When a multi-phase migration includes emit() calls, split the phase that adds emits from the phase that adds schema. Schema cutover ships when consumers can read the new shape; emit ships when producer + consumer both exist in main.

Hard rule, paired with L-0094:
> **Emit calls require both producer and consumer to exist in main before merging.** Any PR adding `emit(...)` for a new event name must reference (a) the producer site (file:line) and (b) at least one consumer registration in `packages/telemetry/src/registry.ts` with an active route. Trust Gate enforces.

Council preflight check: if a migration plan ships emit() in the same phase as schema DDL, request a phase split.

ADR-0246 Phase A4 split:
- A4a (schema cutover) ships when A0–A3 green, INDEPENDENT of A4b
- A4b (emit) blocked until ADR-0248 producer (B5 action handlers) ships + consumer registered

## Pattern signature

- Plan describes "Phase X: cutover + emit"
- Producer is named but does not exist in repo
- Consumer is named but registry entry does not exist
- Plan estimates "this is the same phase, ships together"

When all four are true: split.

## Sibling

L-0094 (phantom-emit contracts) — original 4th-occurrence pattern from Auth Invitation Wave H 2026-04-22. L-0182 is the schema-migration variant of the same class. Promoting them together to a single hard rule is recommended in next council retrospective.
