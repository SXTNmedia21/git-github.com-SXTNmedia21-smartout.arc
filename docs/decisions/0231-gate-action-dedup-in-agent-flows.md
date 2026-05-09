---
title: "gate_action Deduplication in Agent Flows (single evaluation per mutation)"
id: ADR-0231
status: proposed
layer: decision
created: 2026-04-28
updated: 2026-04-28
---

# ADR-0231: `gate_action` Deduplication in Agent Flows

## Context and Problem Statement

Code-trace by System Agent Coordinator (council 2026-04-28) verified that `gate_action` fires **twice** during agent-driven mutations:

1. `services/stage-engine/src/core/agent-router.ts:221` — router calls `gate_action` at intent classification time, before capability dispatch (line 257 comment: "Authority for the matched capability = what gate_action decided").
2. Capability tool `gate.ts:63` — capability invokes `gate_action` again before mutation (e.g. `packages/ai/src/capabilities/journey/gate.ts:63`, `shift-lifecycle/gate.ts:63`).

ADR-0229 mandates dual-gate (`gate_action` + `cascade_gate_write`) on capability mutations during the transitional window. Adding `cascade_gate_write` without dedup means **three RPC calls per agent mutation** (router gate + capability gate + cascade gate). Each RPC writes a `gate_evaluation` row; `gate_action`-fires-twice produces duplicate authority audit rows that ADR-0101 four-eyes scoping cannot reconcile (per-entity history is double-counted).

## Decision Drivers

- ADR-0229 Phase 0-B1 transitional window will impose noticeable latency without dedup.
- ADR-0101 four-eyes lookup queries `gate_evaluation` history; double-firing inflates approver counts and breaks "two distinct actors" semantic.
- Router and capability tool both have legitimate need for the gate verdict — deletion of either firing site is not viable.
- Cache invalidation must respect `gate_action`'s mutation effects: writing a `gate_evaluation` row, four-eyes lookup, default-allow warning emission to `activity_trail`.

## Considered Options

1. **Router fires gate; capability tool reads cached verdict from request context.** Capability tool trusts router — never re-invokes RPC. Skips double-`gate_evaluation` write but requires capability tools to handle "no verdict in context" path safely.
2. **Capability tool fires gate; router fires only when no capability is dispatched (e.g. read-only flow).** Router becomes pass-through for write paths.
3. **Both fire; deduplicate at RPC level via `gate_correlation_id` UUID** that router seeds and capability propagates. RPC checks for existing `gate_evaluation` row with that correlation_id and short-circuits.
4. **Status quo — accept double-fire as cost of router-level admission control.**

## Decision Outcome

Chosen option: **"Option 1 — router fires, capability reads from request context"**, because:

- Single RPC per mutation regardless of agent vs Server Action surface.
- Four-eyes history stays clean (single approver row per evaluation).
- Default-allow warning fires once (ADR-0189 / migration `20260516130000` semantic).
- Router-level admission control (the reason for the dual-fire) is preserved — capability tool still fails closed if context lacks a verdict (defensive).
- Option 3 (correlation_id) was the runner-up but adds RPC complexity without removing the second roundtrip.

## Rules & Consequences

### Implementation

1. **`services/stage-engine/src/core/agent-router.ts`** — after `gate_action` returns, attach `gateVerdict: GateActionResult` and `gateEvaluationId: string` to the agent context propagated to capability tools. Add `gate_correlation_id: UUID` to context (new field) — even if Option 1 is chosen, the correlation_id helps audit reconciliation later.
2. **`packages/ai/src/lib/gate-action.ts`** (new shared helper, replaces 5 per-capability `gate.ts` thunks per ADR-0229 Phase 0) — exposes `requireGateVerdict(ctx)` that reads from request context and throws if missing. Capability tools call this BEFORE any mutation.
3. **Server Action surface** is unaffected by this dedup — Server Actions are not invoked through agent-router and call gate_action exactly once via the shared helper (Option C dual-gate pattern from ADR-0229).
4. **Tests** — agent-router test verifies `gate_action` fires exactly once per agent flow; capability tool tests use mock context with pre-attached verdict.

### Consequences

- **Good, because** agent flows drop from 2-3 RPC calls to 1 (gate_action) + 1 (cascade_gate_write when capability hits a governance-affected table).
- **Good, because** ADR-0101 four-eyes history stays single-row-per-action. Approver counts accurate.
- **Good, because** default-allow warning to `activity_trail` (migration `20260516130000`) fires exactly once per agent action.
- **Bad, because** capability tools become slightly more coupled to router-supplied context. Mitigated by the shared helper enforcing the contract.
- **Bad, because** non-agent capability invocations (direct stage-engine calls outside the router path, if any exist) must explicitly invoke `gate_action` themselves. Verified during Phase 3: only the agent-router path invokes capability tools currently; if Stage Engine grows non-router invocation surfaces later, this contract must be re-evaluated.
- **Agent Impact:** Capability authors MUST use `requireGateVerdict(ctx)` from `packages/ai/src/lib/gate-action.ts` — never call `gate_action` RPC directly. Server Action authors continue using shared `gateAction()` helper that always invokes RPC.

## References

- ADR-0099 (gate_action)
- ADR-0101 (four-eyes via gate_evaluation history)
- ADR-0137 (gate_action stacking semantics — confirm as accepted with this ADR)
- ADR-0189 (CI parity for authority seed)
- ADR-0229 (dual-gate transitional architecture — P4 prerequisite)
- L-0165 (gate double-evaluation in agent flows)
- `services/stage-engine/src/core/agent-router.ts:221` (router gate_action call site)
- `packages/ai/src/capabilities/{journey,shift-lifecycle}/gate.ts:63` (capability gate_action call sites)

> After writing: register in `docs/decisions/0000-decision-log.md`.
