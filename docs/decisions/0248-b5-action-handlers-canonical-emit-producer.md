---
title: "B5 action handlers as canonical emit producer for engine lifecycle events"
id: ADR_0248
status: proposed
layer: decision
created: 2026-04-30
updated: 2026-05-20
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

## Amendment 2026-05-20 — Phase 0 pg-notify execution workers as second named producer

### Context

Audit HIGH SE-01 (2026-05-20-adr-contract-validation/02-stage-engine-bff.md) flagged
`services/stage-engine/src/workers/mission-pool-slot.ts` emitting `journey run_started`,
`journey step_reached`, `journey completed`, and `journey run_failed` at lines 371-388,
400-417, 438-455, 462-478, 485-502, 515-531 as a violation of the single-producer rule.

### Why Option A (move emits to B5 handlers) is architecturally wrong for Phase 0

The B5 handlers in `supabase/functions/engine-dispatch/handlers/` execute on pg_cron
ticks via the engine-dispatch Edge Function. They have no execution-time connection to
the pg-notify `mission_dispatch` channel that mission-pool-slot listens on.

mission-pool-slot owns lifecycle data that B5 handlers cannot reconstruct at dispatch time:
- `MissionManifest` fields (`capability`, `surface`, `journey_version_id`, `label`)
- Sixten subprocess result (`ok: boolean`, persona type)
- Per-step context (`step_key: "sixten_dispatch"`, `step_index`)
- Wall-clock `startTs` (for `duration_ms` on `journey completed`)

Moving emits to B5 handlers would require one of:
1. Re-fetching `engine_state` row in a B5 handler after-the-fact — lossy, step context gone.
2. Persisting step-by-step state to a staging table for B5 to read — over-engineering Phase 0
   work that is explicitly marked as stub execution.

Neither path preserves the telemetry contract's non-null `step_key` / `capability` /
`surface` fields without round-trip state that does not exist in the Phase 0 schema.

The Phase A4b B5 handlers named in the §Open Items are **not yet implemented**. The
existing B5 handlers (`day-line-push`, `period-locked-notifier`, `scan-overdue-invoices`,
`sync-integration`) are domain-specific tick handlers — not mission lifecycle handlers.
There is no B5 handler that receives a `mission_dispatch` notification.

### Amendment ruling

**Phase 0 pg-notify execution workers are a second named producer for `journey.*` events.**

Specifically: `services/stage-engine/src/workers/mission-pool-slot.ts` (and any future
pg-notify-based execution workers following the same pattern) MAY emit `journey.*` events
directly, subject to all of the following constraints:

1. **The worker owns the execution context.** It must hold the information required to
   satisfy all non-optional fields in the registry type (capability, surface, step_key,
   duration_ms, etc.) at emit time — not via a secondary lookup.

2. **No parallel emit with B5 handlers.** When Phase A4b B5 journey lifecycle handlers
   ship, mission-pool-slot must be refactored to remove its direct emits and route via the
   B5 handler path. The amendment grants Phase 0 interim permission, not permanent permission.

3. **Event names match the Phase A3 registry.** Phase 0 workers use the current
   `journey run_started / step_reached / completed / run_failed` registry keys. When Phase
   A4b renames to `engine_run.completed / engine_step.reached / engine_run.failed /
   engine_run.stuck`, the mission-pool-slot migration is a required paired commit.

4. **ADR-0151 workspace derivation applies.** workspace_id MUST be resolved from the
   `engine_state` row (server-side), never from the notify payload. mission-pool-slot
   already satisfies this via `stateRow.workspace_id` + `nonEmpty()` guard (line 355-356).

5. **`actor_id` MUST be non-null.** Use the `SYSTEM_ACTOR_ID` constant for system-initiated
   runs. Never pass `""` or `undefined`.

### Refined single-producer rule

The original §Decision rule "mission-pool worker MUST NOT emit any `journey.*` event
directly" is **narrowed**:

> B5 action handlers in `supabase/functions/engine-dispatch/handlers/` are the canonical
> emit producer for **Phase A4b engine lifecycle events** (`engine_run.*`, `engine_step.*`).
>
> Phase 0 pg-notify execution workers are a named second producer for the **Phase A3
> `journey.*` event family** until Phase A4b B5 handlers ship and mission-pool-slot is
> migrated. This carve-out is time-bounded and does not extend to any producer that does
> not own the execution context at emit time.

The §Agent Impact code-review rule in §Rules & Consequences is amended accordingly:
any `emit('journey.*')` outside `supabase/functions/engine-dispatch/handlers/` OR outside
a named Phase 0 pg-notify execution worker documented in this ADR is blocked at PR stage.

### Open Items added by this amendment

- When Phase A4b B5 journey lifecycle handlers ship (`campaign/botsson-arena`), add a
  paired commit that removes all direct `journey.*` emits from mission-pool-slot and
  validates that B5 handlers emit with equivalent telemetry fields.
- Add a comment in `mission-pool-slot.ts` header referencing this amendment and the
  Phase A4b migration gate.

---

> Registered in `docs/decisions/0000-decision-log.md` after merge.
