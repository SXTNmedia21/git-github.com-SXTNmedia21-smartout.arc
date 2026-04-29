---
title: "gate_action Double-Evaluation in Agent Flows (router + capability)"
id: LEARNING_0165
status: canonical
layer: learning
created: 2026-04-28
updated: 2026-04-28
tags: [gate, agent-router, performance, audit, adr-0099, adr-0101]
---

# Learning-0160: gate_action Already Fires Twice in Agent Flows

## Context

Code-trace by System Agent Coordinator during 2026-04-28 dual-gate reconciliation council. Trace target: agent-driven mutation through `journey.run_guided` and `shift-lifecycle.publish_shifts` capabilities.

Findings:
1. `services/stage-engine/src/core/agent-router.ts:221` invokes `gate_action` at intent-classification time, before capability dispatch. Comment at line 257 explicitly says "Authority for the matched capability = what gate_action decided".
2. Capability tool then calls `callGateAction()` from local `packages/ai/src/capabilities/*/gate.ts:63` — invoking `gate_action` a second time before mutation.

Result: agent mutations write **two** `gate_evaluation` rows per action (router-fire + capability-fire), with no FK linking them. Default-allow warning to `activity_trail` (migration `20260516130000`) fires twice. ADR-0101 four-eyes lookup queries `gate_evaluation` history — duplicate rows inflate approver counts.

## Discovery

Single-trace audits (per-file review) miss double-evaluation patterns because each call site looks correct in isolation. Only end-to-end code-trace exposes the duplicate. Adding `cascade_gate_write` (per ADR-0229 dual-gate transitional architecture) without dedup would push agent flows to **three** RPC calls per mutation.

The router-level fire exists for a legitimate reason (admission control: refuse to dispatch a capability tool the user isn't authorized to invoke). The capability-level fire exists for defense-in-depth (capability tools must fail-closed if context lacks a verdict). Neither is wrong; they just weren't designed as a pair.

## Impact

1. **ADR-0231 dedup**: router fires `gate_action`, attaches `gateVerdict` + `gateEvaluationId` + `gate_correlation_id` to agent context. Capability tools call `requireGateVerdict(ctx)` from a new shared helper (`packages/ai/src/lib/gate-action.ts`) which reads from context and throws if missing.
2. **Per-capability `gate.ts` thunks dropped**: 5 near-identical files (~535 lines) consolidated into single shared helper per ADR-0229 Phase 0. Per-surface channel default claim in `journey/gate.ts:13-17` is aspirational, not load-bearing (verified Phase 3 by Supervisor — code is byte-identical to `shift-lifecycle/gate.ts`).
3. **ADR-0101 four-eyes scoping**: stays correct only when single row per evaluation. Dedup is mandatory before ADR-0229 Phase B1 capability migration.
4. **Audit reconciliation**: `gate_correlation_id` (UUID seeded by router, propagated through capability + cascade_gate_write) becomes the cross-row link during dual-gate transitional window. Drops with unified `gate_evaluate` RPC at ADR-0229 Phase B4.
5. **General principle**: when admission control and defense-in-depth use the same RPC, design them as a pair from the start — context propagation, correlation IDs, and dedup contract live in the helper, not at each call site.

## References

- ADR-0099 (gate_action)
- ADR-0101 (four-eyes via gate_evaluation history)
- ADR-0137 (gate_action stacking semantics — co-confirmed with ADR-0231)
- ADR-0229 (dual-gate transitional architecture)
- ADR-0231 (gate_action dedup in agent flows)
- `services/stage-engine/src/core/agent-router.ts:221`
- `packages/ai/src/capabilities/{journey,shift-lifecycle,season,shift-swap,availability}/gate.ts:63`

> After writing: register in `docs/learnings/0000-learning-log.md`.
