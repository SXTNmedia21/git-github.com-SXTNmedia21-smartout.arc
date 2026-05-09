---
title: "update_context_targeted Action Type — Cross-State Context Patching"
id: ADR-0236
status: accepted
layer: decision
created: 2026-04-29
updated: 2026-04-29
---

# ADR-0236: `update_context_targeted` Action Type — Cross-State Context Patching with Workspace Integrity Guard

## Context and Problem Statement

ADR-0234 introduced `update_context` action_type that patches `engine_state.context` for the executing state itself (`state.id`). The handler at `engine-dispatch/index.ts:854-940` is documented (lines 824-852) as "CURRENT state only, not the linked domain entity" with test guards (`update_context_test.ts:88-181`) asserting it never writes to `state.entity_id` or any other state.

ADR-0235 requires patching the **original ticket's** `engine_state.context` from a breach-handler process whose own state is a transient sibling. The two states have different IDs, are in different processes, but MUST be in the same workspace. Three contract designs were considered for this cross-state primitive:

1. Add `target` payload field to `update_context` (`'current_state' | 'state_id_from_payload'`).
2. Add `target_state_id` payload field to `update_context` (defaults to `state.id` if absent).
3. **Split into two action_types: keep `update_context` for current-state (existing), add `update_context_targeted` for cross-state (new).**

Council 2026-04-29 voted 3-1 for option 3 (Steward + Harness + Supervisor preferred split; Code-Tracer preferred extension).

## Decision Drivers

- **Call-site clarity**: a blueprint author reading `update_context_targeted` immediately knows the step writes to a different state. A `target` flag inside `action_payload` hides intent and is harder to grep.
- **Authority gating differs**: cross-state writes require an integrity check (source.workspace_id === target.workspace_id) that current-state writes do not need. Two action_types let `executeStep` enforce different invariants without payload-shape branching.
- **Telemetry routing**: `engine_event.action_type` is searchable. Operators investigating "where do cross-state writes happen?" need a distinct action_type — not a payload flag.
- **ADR-0091 future-proofing**: row-level authorization on cross-state writes (likely a Phase 3 concern) attaches to one action_type, not a payload-conditional check.
- **Existing test contract preservation**: `update_context_test.ts:88-96` explicitly asserts the handler targets `state.id` only. Splitting preserves this test as-is rather than weakening it.

## Considered Options

1. **Single `update_context` with `target` flag in `action_payload`.** Rejected — hides intent, breaks ADR-0234's documented "current state only" contract, requires conditional gating logic inside one handler.
2. **Single `update_context` with optional `target_state_id` field.** Rejected — same drawbacks as option 1, plus easier to misconfigure (omitting the field silently routes to current-state).
3. **Split into `update_context` (current-state, existing) + `update_context_targeted` (cross-state, new).** Chosen — distinct action_types, distinct gating, distinct test surfaces.
4. **No new action_type — Option B from ADR-0235 (fire-delayed-triggers direct write).** Rejected by ADR-0235 on ADR-0091/0099/0161 grounds.

## Decision Outcome

Chosen option: **Split into two action_types.**

`update_context_targeted` handler contract:

- **Action payload shape**: `{ target_state_id: string, set: Record<string, unknown> }`
- **Resolution**: handler reads `target_state_id` from `action_payload`. If absent, the dispatcher reads from the executing state's `context.target_state_id` (forwarded from the breach event payload at process spawn time). If both absent: handler fails the step with status=`blocked`.
- **Workspace integrity guard (load-bearing)**: handler MUST verify `source_state.workspace_id === target_state.workspace_id` before patching. On mismatch: block source state with `last_error="update_context_targeted: workspace mismatch"`, emit `engine.cross_state_write_blocked` telemetry event (workspace boundary breach), do NOT patch target. This is a CVE-class guard — without it, a misconfigured blueprint could leak writes across tenants.
- **Target state lookup**: `SELECT id, workspace_id, context FROM engine_state WHERE id = $1`. If row not found: block source state with `last_error="update_context_targeted: target_state_id not found"`, do NOT patch.
- **Patch semantics**: shallow merge `{...target.context, ...patch}`. Same as `update_context`. Reject nested-key paths (`{"context.foo.bar": ...}`). Strip immutable keys (`id`, `workspace_id`) with warn log.
- **Idempotency**: caller is responsible. The handler does not check whether the patch keys are already set. For SLA-breach-specific idempotency, the breach-handler process can include a guard step before `update_context_targeted` that match-states on `context.sla_breached_at IS NULL`.
- **Telemetry**: emit `engine.context_patched_targeted` on success, `engine.cross_state_write_blocked` on workspace mismatch. PII-safe — log patch KEYS only, never patch VALUES (per ADR-0163).
- **Authority**: registered in `GATED_MUTATION_TYPES` alongside `update_context`. The `gate_action` check uses the surrounding process's authority (e.g., `helpdesk_query` for the breach-handler), not a per-action authority.

## Rules & Consequences

- **Good, because** the contract is explicit. A blueprint reviewer reading `update_context_targeted` knows immediately the step writes cross-state. No payload archaeology.
- **Good, because** the workspace-integrity guard is enforced at one well-tested location. Future cross-state writes inherit it for free.
- **Good, because** existing `update_context` test contract is preserved unchanged. Splitting is purely additive — no regression risk on the current-state path.
- **Good, because** the audit trail (`engine_event.action_type='update_context_targeted'`) makes cross-state writes greppable for security review.
- **Bad, because** two action_types feel duplicative for blueprint authors. The naming alone (`update_context` vs `update_context_targeted`) requires reading docs to understand the distinction.
- **Bad, because** the breach-handler blueprint must include `target_state_id` in either action_payload or the spawned state's context. Forgetting either causes a hard failure at fire time. Mitigation: dispatcher's clear error message + tests.
- **Agent Impact:** when authoring a blueprint that patches a different state, use `update_context_targeted`. Forward `target_state_id` either via `action_payload` (constant target) or via the spawning event's payload → `state.context.target_state_id` (dynamic target).
- **Agent Impact:** when authoring a tool that emits a breach-style event for a transient handler to consume, ALWAYS include `engine_state_id` in the event payload. The dispatcher's spawn flow forwards this into the new state's context, where the handler step reads it.
- **Agent Impact:** future cross-cutting concerns (e.g., dunning lifecycle, contract sign-off escalation) reuse this action_type. DO NOT invent per-capability cross-state primitives. The workspace integrity guard is the single point of replacement when ADR-0091 row-level authorization arrives.

## Test Plan

`update_context_targeted_test.ts` (new file, sibling of `update_context_test.ts`):

1. **Happy path**: source state spawns with `target_state_id` in context, action_payload has `set: { sla_breached_at: '2026-04-29T...' }`. Target state's context is shallow-merged. Source state advances.
2. **Workspace mismatch**: target state's `workspace_id` differs from source's. Source blocks. Target unchanged. `engine.cross_state_write_blocked` event emitted.
3. **Target not found**: `target_state_id` references nonexistent row. Source blocks with `last_error` containing "target_state_id not found".
4. **Missing target_state_id**: action_payload + state.context both lack the field. Source blocks with `last_error` containing "missing target_state_id".
5. **Nested-key rejection**: action_payload `set: { 'context.foo.bar': 1 }`. Source blocks.
6. **Immutable-key stripping**: action_payload `set: { id: 'evil', sla_breached_at: '...' }`. `id` stripped with warn log. `sla_breached_at` patched.
7. **PII-safe logging**: emitted log lines contain patch keys but not values.

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
