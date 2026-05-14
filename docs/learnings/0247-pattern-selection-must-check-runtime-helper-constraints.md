---
title: "Pattern selection must check runtime helper constraints, not just data-model invariants"
id: L_0247
status: accepted
layer: learning
created: 2026-05-14
updated: 2026-05-14
---

# L-0247: Pattern selection must check runtime helper constraints, not just data-model invariants

## Context

G1 council (2026-05-14, ADR-0307 + ADR-0309 scheduler bundle approval pattern).
Phase 3 chair (System Steward) voted Option A — per-row `change_proposal` rows
with `proposal_group_id` correlation — argued from Cascade Invariants 3
(reproducibility) + 5 (C1/C4 separation) + 8 (provenance) at the data-model
layer. Two reviewers concurred (Supervisor on telemetry, Agent-Coordinator on
per-tool ADR-0287 compliance).

Botsson Harness Builder Phase 3 dissented with Option B, but the deciding
evidence was a single code-trace: `mutateWithGate` helper at
`packages/ai/src/capabilities/_shared/mutate-with-gate.ts:255-409` is
**single-call, NOT bulk-aware**. It calls `gatedMutation()` once, runs a single
`exec` callback, returns one `MutateWithGateOk<T>`. No iteration layer.

Option A's N-row accept forces a binary choice neither option satisfies:

- (a) Loop `mutateWithGate` N times → N gate_evaluation rows (correct provenance, N RPC round-trips, expensive)
- (b) Single `mutateWithGate` with bulk-insert exec → ONE gate eval for N writes → **violates ADR-0099 "one gate eval per atomic write unit"**

Both violations. Phase 5 chair self-reversed (per Skill §1.5; L-0147 6th
precedent) and accepted Option C synthesis (single-row bundle + atomic accept).

## What Happened

Chair argued from data-model invariants only (Cascade 3/5/8). Did not trace the
runtime helper that the proposed pattern would need to call N times. Helper's
single-call structure was load-bearing — visible only by reading the helper
body, not by inspecting `change_proposal` schema.

This is the same class as **L-0176** (docstring-vs-body drift): docstrings
claim ADR compliance, bodies drift. Here, ADR-0307 spec claims "writes N change
proposals via mutateWithGate" — the spec compiles in the head; the helper body
disagrees structurally.

## Generalization

Before approving a data-model pattern that assumes bulk semantics (multi-row
INSERT/UPDATE in one logical operation), READ the helper body that the pattern
would call. Verify single-call vs bulk-aware contract structurally. Same
applies to:

- `gatedMutation` / `gateAction` family
- `emit()` telemetry helpers (ADR-0134 single-emit-per-logical-event)
- Edge Function applier subroutines
- Trigger functions (Postgres triggers fire `FOR EACH ROW` by default; bulk-INSERT does NOT collapse)

The trap signature: spec frames the operation as "bundle / bulk / batch"; the
helper underneath is single-row. When the abstraction layers differ, the
violation appears at the lowest layer (gate provenance, telemetry cardinality,
trigger fan-out) and is invisible to spec-level review.

## How to Apply

**Council Phase 2.5 fact-check addition:** for any council briefing proposing a
multi-row data pattern, the fact-check agent MUST grep the runtime helper body
(`mutateWithGate`, `emit`, applier function) and report whether the helper is
single-call or bulk-aware. If single-call, flag the brief BEFORE Phase 3
dispatch.

**Code-Tracer Mandate addition:** when a spec proposes "one X creates N Y
rows / events / writes," assign a code-tracer reviewer the explicit task of
opening the helper body that would execute the N. Trust nothing about bulk
semantics that isn't visible in the helper signature + body.

**Per-tool ADR-0287 compliance table** (Phase 3 hard rule for ≥2-tool
capabilities) MUST include a "Persistence cardinality (single / bulk)" column.
Bulk + single-call helper = blocker, escalate to chair before Phase 5.

## Sibling Learnings

- **L-0147** — Chair Self-Reversal Protocol (now 6th precedent, this one)
- **L-0176** — Docstring-vs-body drift; trust body not spec
- **L-0193 / L-0194 / L-0195** — Knowledge-bundle drift (agents trust their own claims)
- **L-0202** — Chair Phase 3 sibling-table over-engineering (5th precedent)
- **L-0239** — Retrospective briefings are claims, not contracts (6th L-0147 precedent — different framing)
- **L-0238** — Derived-state recovery via recompute (cascade invariants applied to runtime, not data-model)

## ADR Reference

- ADR-0099 (one gate evaluation per atomic write unit)
- ADR-0287 (mutateWithGate mandate)
- ADR-0307 (greedy scheduler V1; first-draft Option A invalidated by this learning)
- ADR-0309 (scheduler bundle proposal pattern; Option C accepted)
