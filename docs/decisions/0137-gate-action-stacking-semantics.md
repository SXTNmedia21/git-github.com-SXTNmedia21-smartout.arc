---
title: "Gate Action Stacking Semantics — gate_action × cascade_gate_write"
id: ADR_0137
status: draft
layer: decision
created: 2026-04-18
updated: 2026-04-18
module: cascade
tags: [adr, cascade, c4-governance, authority, gate-action, cascade-gate-write, capability, wave-2b]
---

# ADR-0137: Gate Action Stacking Semantics — `gate_action` × `cascade_gate_write`

## Context and Problem Statement

The cascade governance architecture now has two structurally distinct gates that each produce a C4 decision:

- **`gate_action` (ADR-0099, ADR-0101)** — the unified authority gate used by the agent router and engine dispatch. Evaluates authority (role × capability), channel restriction (ADR-0078), and four-eyes (ADR-0101). Answers: *"Is this actor permitted to run this capability in this channel?"*
- **`cascade_gate_write` (ADR-0091)** — the governance write gate, a Postgres `SECURITY DEFINER` RPC. Evaluates framework triggers and data-rule diffs, auto-creates `change_proposal` rows when review is required. Answers: *"Given this proposed data change, does the framework require review?"*

ADR-0091 line 40 states explicitly that `gate_action` is NOT a substitute for `cascade_gate_write` — they solve different problems. But the relationship between them *when a capability tool writes to a governance-gated table* has never been codified. The gap is concrete today: `packages/ai/src/capabilities/shift-lifecycle/tools.ts:177-181` calls `gate_action` and then writes `.from("schedule_shift").update(...)` directly, bypassing `cascade_gate_write`. Every other capability tool that writes to a governance-gated entity has the same shape.

ADR-0114 R3+R4 (accepted 2026-04-17) imply both gates must fire, but without an explicit stacking contract, the Wave 2B capability migration cannot proceed — authors don't know which gate deny short-circuits which, how failure maps to LLM output, or whether the two can be combined into a single call.

## Decision Drivers

- **Two orthogonal questions, two gates:** authority ("may the actor act?") and data rules ("does the change need review?") are independent. Collapsing them hides one of the two invariants.
- **Universal coverage survives the stack:** `cascade_gate_write` must remain the last line of defence for every write to a governance-gated table, including writes initiated by a capability tool that already passed `gate_action`. A capability-only gate leaves direct SQL, Edge Functions, and service-role scripts ungoverned.
- **Deterministic short-circuit order:** if `gate_action` denies, the write must never be attempted — no data reaches `cascade_gate_write`. This is both a cost optimization and a telemetry invariant (no "blocked by authority, then proposed by rules" double-event).
- **Wave 2B unblock:** capability tool authors need an explicit contract before migrating call sites to `gatedInsert`/`gatedUpdate`/`gatedDelete`. Without it, migration risks silently dropping one of the two gates.
- **Agent Trust Gate (CLAUDE.md):** any plan touching Server Actions / useMutation / capability tools must pass the Trust Gate. Three concurrent write paths can silently diverge in authority + telemetry; an explicit stacking ADR is the mitigation.

## Considered Options

1. **Sequential stacking (chosen)** — every capability tool writing to a governance-gated entity calls `gate_action` first (deny short-circuits), then `cascade_gate_write` via the `gatedInsert`/`gatedUpdate`/`gatedDelete` wrappers. Both gates fire on every successful write path.
2. **Unified super-gate** — merge `gate_action` and `cascade_gate_write` into a single RPC that evaluates authority + data rules in one pass.
3. **Capability-only gating** — trust `gate_action` for capability tool writes and skip `cascade_gate_write` on the assumption that authority implies data authorization.
4. **Data-only gating** — skip `gate_action` for tool writes on the assumption that `cascade_gate_write` already covers governance.

## Decision Outcome

Chosen option: **"Sequential stacking"**, because it is the only shape that preserves both invariants (authority and data rules) while remaining compatible with `cascade_gate_write`'s universal-coverage guarantee (ADR-0091). The unified super-gate is rejected because it conflates two orthogonal decisions and couples the agent-router authority path to the Postgres write path (agent-router must be able to evaluate authority before deciding whether to call a tool at all — this is a pre-write question, not a write question). Capability-only gating is rejected because it re-introduces the "secondary door" ADR-0091 closed — direct SQL and service-role writes would remain ungoverned. Data-only gating is rejected because it strips the four-eyes and channel-restriction layers that only `gate_action` evaluates.

### Stacking contract

Every capability tool that writes to a governance-gated entity (as defined by `isGovernanceGated()`) MUST:

1. **Call `gate_action` first.** The agent router or tool body invokes `gate_action(actor, capability, channel, context)`. If the outcome is `deny`, the tool returns immediately with a `blocked` result (see ADR-0138). No write is attempted. No `cascade_gate_write` call. No `activity_trail` row for the would-be write (the deny itself is audited by `gate_action`).
2. **Call `cascade_gate_write` second.** If `gate_action` returns `allow` (or `allow_with_approval` whose approval is already satisfied), the tool proceeds to the write via `gatedInsert`/`gatedUpdate`/`gatedDelete` from `packages/supabase/src/gate-client.ts`. These wrappers invoke `cascade_gate_write` inside the same transaction as the write itself (per ADR-0091).
3. **Map both gates' outcomes to a single `ToolGateResult`.** See ADR-0138 for the result shape. `gate_action` deny → `{ outcome: 'blocked' }`. `cascade_gate_write` `proposed` → `{ outcome: 'proposed' }`. `cascade_gate_write` `applied` → `{ outcome: 'applied' }`.

### Failure semantics

| Stage | Failure | Tool result | Write occurs? |
|-------|---------|-------------|---------------|
| `gate_action` deny | Authority/channel/four-eyes denied | `blocked` | No |
| `cascade_gate_write` `proposed` | Framework rule requires review | `proposed` + `proposal_id` | No; proposal row created |
| `cascade_gate_write` `blocked` (WP1) | Hard rule block | `blocked` | No |
| `cascade_gate_write` `applied` | Passed both gates | `applied` | Yes |
| `cascade_gate_write` `applied_with_exception` (WP1) | Passed with exception logged | `applied_with_exception` | Yes |

The two gates have **distinct** failure semantics. A `gate_action` deny is an authority question — the actor never had the right to initiate this action, regardless of data. A `cascade_gate_write` `proposed` is a data question — the actor is permitted to act, but the specific change requires review. The LLM, the UI, and the audit log must all distinguish these cases (see ADR-0138 for the canonical result shape).

### Non-substitution clarification

Per ADR-0091 line 40: `gate_action` is NOT a substitute for `cascade_gate_write`. This ADR extends that statement: `cascade_gate_write` is also NOT a substitute for `gate_action`. The two gates are orthogonal axes of the C4 governance plane:

- `gate_action` = **authority axis** (who × capability × channel)
- `cascade_gate_write` = **data axis** (proposed diff × framework rules)

Neither dimension subsumes the other. A capability tool writing to a governance-gated entity MUST evaluate both.

### Out-of-scope writes

Writes to entities NOT governance-gated (per `isGovernanceGated()`) skip `cascade_gate_write` but still pass through `gate_action` if initiated by a capability tool. Writes to governance-gated entities from non-capability paths (Server Actions, Edge Functions, service-role scripts) skip `gate_action` but still pass through `cascade_gate_write` (ADR-0091's universal coverage).

## Rules & Consequences

- **Good, because** both invariants survive capability-initiated writes. No silent downgrade of either authority or data-rule governance.
- **Good, because** the short-circuit order (authority first, then data) gives deterministic telemetry — exactly one deny event per denied action, attributed to the correct axis.
- **Good, because** Wave 2B capability migration now has an explicit contract: wrap direct `supabase.from(...).update(...)` calls with `gatedUpdate(...)` and keep the existing `gate_action` call.
- **Bad, because** every capability write is now two RPCs instead of one. Mitigated by the fact that `gate_action` already runs before most capability tools today (the proposal here is to add `cascade_gate_write`, not to add both from scratch).
- **Bad, because** the two gates can, in pathological configurations, disagree with each other in ways that surprise the actor (e.g. `gate_action` says "you may edit shifts," `cascade_gate_write` says "but this specific change needs review"). Mitigated by ADR-0138's result contract surfacing both outcomes cleanly to the LLM and the UI.
- **Agent Impact:**
  - Every capability tool in `packages/ai/src/capabilities/*/tools.ts` that writes to a governance-gated entity MUST migrate to `gatedInsert`/`gatedUpdate`/`gatedDelete` before Wave 2B closes. The existing `gate_action` call is preserved as-is.
  - Direct `supabase.from(...).insert()/.update()/.delete()` inside a capability tool against a governance-gated entity is an ESLint error (extension of the rule shipped with ADR-0091 WP3).
  - Tool authors writing new capabilities consult `isGovernanceGated()` at tool-design time, not runtime, to decide whether `gatedInsert`-family wrappers are required.
  - Prompt templates for Botsson / Emma / WalkAi consume the stacked result shape defined in ADR-0138 — they must handle `blocked` (authority) and `blocked` / `proposed` (data rules) as distinct user-facing messages.

---

> Registered in `docs/decisions/0000-decision-log.md`.
> Status: draft — promote to accepted when Wave 2B capability migration closes and the stacking contract is verified in production.
