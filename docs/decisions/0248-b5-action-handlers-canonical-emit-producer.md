---
title: "B5 action handlers as canonical emit producer for engine lifecycle events"
id: ADR_0248
status: proposed
layer: decision
created: 2026-04-30
updated: 2026-04-30
references:
  - ADR-0246
  - ADR-0216
  - ADR-0175
  - ADR-0215
  - L-0094
  - L-0184
---

# ADR-0248: B5 action handlers as canonical emit producer for engine lifecycle events

## Intro

ADR-0246 Phase A4b emit `journey.completed/stuck/run_failed` requires a single, named producer. This ADR closes a two-owner ambiguity caught in Phase 3 council review (L-0184):

- Brief proposed mission-pool worker (Arena Harness construct) as emit producer.
- ADR-0216 §B5 named action handlers in `supabase/functions/engine-dispatch/` as emit producer.

Two producers for overlapping semantic events = contract divergence. This ADR names one.

## Decision

**B5 action handlers in `supabase/functions/engine-dispatch/handlers/` are the canonical emit producer for engine lifecycle events.**

Event names (per `packages/telemetry/src/registry.ts` after Phase A4b):
- `engine_step.reached` — emitted by step advancement handlers
- `engine_run.completed` — emitted by terminal-state handlers when run succeeds
- `engine_run.failed` — emitted by terminal-state handlers when run fails
- `engine_run.stuck` — emitted by stuck-detector reactivation (ADR-0215 Option A)

Mission-pool worker (Arena Harness construct) is **NOT an emit owner**. When mission-pool worker needs to surface state, it INVOKES B5 handlers via the engine-dispatch layer. Mission-pool worker may emit Arena-Harness-internal events (`mission_pool.dispatched`, `mission_pool.terminal`) but MUST NOT emit any `engine_*` or `journey.*` event directly.

## Considered alternatives

1. **Mission-pool worker as emit owner (brief's original proposal).** Rejected: violates ADR-0216 §B5 which names action handlers; produces parallel emits; Arena Harness construct should not own engine-domain telemetry.
2. **Both producers, with disambiguation by source field.** Rejected: contract divergence inevitable; consumer-side filtering by source field has 0 production track record in this codebase.
3. **B5 action handlers as canonical (chosen).** Single producer, named in ADR, code-review gate enforces.

## Rules & Consequences

- **Good, because** single canonical producer prevents drift; respects ADR-0216 §B5; aligns with engine-dispatch as ground-truth runtime; consumer-side reads have one shape.
- **Bad, because** B5 action handlers must be implemented before ADR-0246 Phase A4b can ship — the dependency is now explicit; mission-pool worker development must explicitly route through B5 (extra integration point).
- **Agent Impact:**
  - Code review: any `emit('engine_*')` or `emit('journey.*')` outside `supabase/functions/engine-dispatch/handlers/` blocked at PR stage.
  - Mission-pool worker (Arena Harness, in-flight per `PLAN-arena-harness-migration.md`) MUST integrate via engine-dispatch layer, not emit directly.
  - ADR-0215 stuck-detector reactivation Option A flips when B5 handlers ship the `engine_run.stuck` emit.

## Open Items

- B5 action handler implementation owned by `campaign/botsson-arena` per ADR-0216 §B5 + handoff capstone §Known Open-Loop. ADR-0246 Phase A4b is gated on this work.
- Telemetry registry entries for `engine_step.reached / engine_run.completed / engine_run.failed / engine_run.stuck` must be added to `packages/telemetry/src/registry.ts` when B5 handlers ship — paired commit, no orphan registry entries.

---

> Registered in `docs/decisions/0000-decision-log.md` after merge.
