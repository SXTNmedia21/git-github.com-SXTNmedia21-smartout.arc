---
title: "`invoke_capability_tool` Engine-Dispatch Action-Type Contract"
id: ADR-0424
status: implemented
layer: decision
created: 2026-05-25
updated: 2026-05-25
amendments:
  - "2026-05-25: §Transport layer added — HTTP bridge EF→stage-engine /internal/engine-dispatch/invoke-capability-tool (Council R6, 3:1 majority, system-agent-coordinator dissent accepted as future B6)"
  - "2026-05-25: §Endpoint contract clarification (Sortie F Phase 3) — `gate_evaluation_id` is OPTIONAL in request body (EF may omit) and ALWAYS returned in response; `actor_profile_id` REMOVED from request body per ADR-0151 §Cross-runtime extension (server-derived from `engine_state.assignee_id` with `'system'` fallback)"
implementation:
  - "PR #476 — Phase 1: schema + partial index (`idx_engine_state_step_invoke_cap`)"
  - "PR #477 — Phase 1.5: `resolveCapabilityTool()` shim in `packages/ai`"
  - "PR #478 — Phase 1: telemetry registration `engine.action.invoked.invoke_capability_tool`"
  - "PR #480 — §Transport amendment + L-0361 + ADR-0151 §Cross-runtime extension"
  - "PR #481 — Phase 2-A: Node-side internal endpoint `services/stage-engine/src/routes/internal/invoke-capability-tool.ts` (gate + execute + emit; workspace_id + actor_profile_id server-derived)"
  - "PR #482 — Phase 2-B: EF thin proxy in `supabase/functions/engine-dispatch/index.ts` + `engine.dispatch.bridge_invoked` telemetry variant"
related_adrs: [ADR-0151, ADR-0173, ADR-0193, ADR-0265, ADR-0356, ADR-0421]
---

# ADR-0424: `invoke_capability_tool` Action-Type Contract

## Context and Problem Statement

The C2 intelligence pipeline gap (GAP-A4-12 / Pattern 1' from sim council 2026-05-25)
surfaced a structural need: `engine_process` blueprints must be able to invoke capability
tools (e.g. `compose_shift_briefing`) as part of their `engine_state_step` sequence. Today
the dispatcher in `supabase/functions/engine-dispatch/index.ts` supports a fixed set of
action types (`wait_for_event`, `assign_task`, `send_notification`, `update_entity`,
`create_deviation`, `validate_settlement`, `lock_checkout`, `schedule_control`,
`start_process`, `upsert_session`). None invokes a capability tool.

Without this action-type, the C2 campaign (sortie G) must either:
- Build a parallel cron path that duplicates capability logic (already happening with
  `ops-day-brief/index.ts` — see GAP-A4-12), OR
- Build a meta-dispatcher outside Event Engine (would violate the canonical "cascade
  produces, event engine consumes" boundary in CLAUDE.md)

Both alternatives create the exact "logic beside cascade" violation the steward exists to
prevent.

## Decision Drivers

- ADR-0173 frozen-4 capability boundaries must be preserved
- [[ADR-0356]] cascade-namespace-delegation pattern already establishes the audit-symmetry
  contract (`actor_capability` + `delegated_via` in emit)
- Capability tools already carry gate_action invocations + emit registration
- Re-implementing in cron paths produces 7-pattern Type C (EF/capability duplication)

## Considered Options

1. **A** — New action-type `invoke_capability_tool` in engine-dispatch
2. **B** — Extend `assign_task` to optionally invoke a tool
3. **C** — Build an engine-dispatch plugin layer (over-architected)

## Decision Outcome

**Chosen: Option A — new action-type `invoke_capability_tool`.**

### Contract

```typescript
type InvokeCapabilityToolAction = {
  action_type: 'invoke_capability_tool';
  capability: CapabilityName;
  tool: string;
  args: Record<string, unknown>;
  actor_kind: 'engine_process' | 'platform';
  delegated_via: string;  // engine_process id, REQUIRED per ADR-0356
};
```

### Handler invariants

The dispatcher handler MUST:

1. Call `gate_action(workspace_id, capability, level)` BEFORE invoking the tool body
2. Set `actor_capability = capability` + `delegated_via = action.delegated_via` in any emit
   downstream (per [[ADR-0356]] audit symmetry pattern)
3. Enforce **recursion depth = 1** — a tool invoked by `invoke_capability_tool` cannot
   itself trigger another `invoke_capability_tool` step in the same engine_state. Prevents
   recursive engine_process spawning.
4. Propagate `workspace_id` from the parent `engine_state` row, NEVER from `action.args`
   (per [[ADR-0151]])
5. Emit `engine_dispatch.tool_invoked` with `{ engine_process_id, capability, tool, success, error_code }`

### Recursion limit

If a capability tool needs to spawn additional engine_process work, it must use the existing
`start_process` action — NOT another `invoke_capability_tool`. Recursion depth limit
enforced at depth check in handler.

## Transport layer

> **Amendment 2026-05-25 (Council R6, 3:1 majority).** Phase 1 (PR #476 schema, #477 resolver
> shim, #478 telemetry registration) landed cleanly on `development`. Phase 2 (T-Handler)
> surfaced a structural blocker documented in `docs/plans/SORTIE-F-HANDLER-BLOCKED.md`: the
> handler must execute inside `supabase/functions/engine-dispatch/index.ts` (Deno EF) but
> capability tool bodies + the T-Shim resolver live in `packages/ai` (Node ESM). Deno cannot
> import Node ESM (verified in three sibling code comments: `engine-dispatch/index.ts:3057-3061`,
> `handlers/sync-integration.ts:16-19`, `pos-sync/index.ts:50-52`).
>
> This is the same "logic beside cascade" anti-pattern ADR-0424 was meant to close, surfaced
> one layer deeper than the original ADR anticipated — captured as L-0361 (3rd-occurrence
> ADR-missing-cross-runtime-dimension; chair self-reversal trigger).

### Decision

EF handler calls back into a new internal stage-engine endpoint via HTTP. The EF stays a
thin proxy; capability tool resolution + execute() runs Node-side, where the bodies live.

**Rejected alternatives:**

- **Inline mirror in Deno** — reproduces ADR-0421 sub-pattern C (EF/capability duplication),
  the exact pattern this ADR exists to close. Forbidden.
- **Move engine-dispatch to a Node service now** — campaign-scale refactor (touches pg_cron
  targets, EF→service routing, deploy pipeline). Deferred as **future B6 sortie**; supersedes
  the bridge when ready (see §Future evolution).

### Endpoint contract

> **Phase 3 clarification (2026-05-25).** Body shape below reflects shipped implementation
> (PR #481). Two fields evolved from the original draft:
>
> 1. `actor_profile_id` **REMOVED from body** — server-derived from `engine_state.assignee_id`
>    (with `'system'` fallback) per ADR-0151 §Cross-runtime extension. Originally drafted as
>    body-supplied with "EF resolves system-bot fallback before call"; harness invariant
>    `check-server-derived-actor` flagged the body field as a forge surface. Refactored
>    `deriveWorkspaceFromEngineState` → `deriveEngineStateContext` returning
>    `{ workspace_id, actor_profile_id }`. See PR #481 commit `730f6e113`.
> 2. `gate_evaluation_id` **OPTIONAL in body, ALWAYS in response** — body field exists for
>    backward-compatibility with handler patterns that may pre-allocate a UUID for the step
>    row, but the Node endpoint **always** runs `gate_action` itself and returns the
>    authoritative `gate_evaluation_id` in the response. EF persists the **response value**
>    into the `engine_state_step` row (the body value, if supplied, is sanity-check only).
>    Original §Gate placement text already mandated Node-side gate; this clarifies the body
>    field's role. See PR #481 commit `c226fda84`.

```
POST /internal/engine-dispatch/invoke-capability-tool
Auth: x-api-key (existing platform_api_key validation path)
      + scope guard: scopes contains "engine:invoke" OR "*"

Body: {
  capability: CapabilityName,
  tool: string,
  args: unknown,                       // resolver Zod-validates server-side per tool schema
  workspace_id: NonEmptyString,        // EF-supplied; Node re-derives from engine_state row (defense)
  channel: "system",                   // reserved enum value for engine-spawned context
  engine_process_id: string,
  engine_state_id: string,
  engine_state_step_id: string,
  gate_evaluation_id?: string,         // OPTIONAL — Node returns authoritative value in response
  depth: 0,                            // EF enforces; endpoint asserts === 0 (fail-closed defense)
}

// Identity fields server-derived from engine_state_id (NOT body):
//   workspace_id (re-derived, body value sanity-check only — 400 on mismatch)
//   actor_profile_id (from engine_state.assignee_id || 'system')

Response (success): { ok: true, result: unknown, gate_evaluation_id: string, duration_ms: number }
Response (failure): { ok: false, error: string, gate_evaluation_id?: string, duration_ms: number }

Error semantics:
  400 — body schema invalid, depth > 0, workspace re-derive mismatch
  401 — auth failure (missing/invalid x-api-key, scope guard reject)
  403 — gate_action denied (capability/level not permitted for workspace)
  404 — resolveCapabilityTool() returns null (capability/tool unknown)
  500 — tool.execute() threw; body carries sanitized error message
```

### Identity re-derivation (cross-runtime)

The Node-side endpoint MUST re-derive `workspace_id` from the `engine_state` row using the
body's `engine_state_id`. Body-supplied `workspace_id` is **sanity-check only** — a mismatch
between body value and re-derived value is a 400 + audit alert (treat as forged identity
attempt, same class as L-0177 silent-fallback).

Rationale: ADR-0151 mandates server-side derivation of actor identity from a trusted source
within a runtime. This amendment **extends the rule across runtime boundaries**: every
receiving runtime re-derives identity from a propagated opaque reference (here:
`engine_state_id`), never trusting body values for authority decisions. Phase 2.5 cross-runtime
defense.

The EF still propagates `workspace_id` in the body (helps with logging + makes EF intent
explicit), but the Node side treats it as a hint, not a fact.

### Gate placement

The `gate_action` call runs **Node-side, inside the bridge endpoint**, immediately before
`tool.execute()`. The capability tool body lives Node-side and so does its authority gate —
gating where the body runs is the only placement that preserves ADR-0356 audit symmetry
(gate + emit + audit row on the same side as the mutation).

**The EF MUST NOT call `gate_action` for `invoke_capability_tool`.** EF is a thin proxy. The
`gate_evaluation_id` field in the payload is the **outcome reference** of the Node-side gate;
the EF receives the gate id (via the response) and persists it into the `engine_state_step`
row after the fetch returns. This preserves the existing dispatcher pattern of "step row
records gate outcome" while keeping the gate evaluation itself on the runtime that owns the
mutation.

Rationale: ADR-0356 §149-161 — gate runs on the side that owns the audit row. Splitting gate
(EF) from execute (Node) would double-audit and create the L-0176 docstring-vs-body drift
class at the runtime boundary.

### Recursion enforcement

The recursion depth check (ADR-0424 §Recursion limit — handler invariant 3, depth = 1) runs
**EF-side, BEFORE the bridge fetch**. The EF queries the partial index
`idx_engine_state_step_invoke_cap` (shipped in PR #476) to count ancestor
`invoke_capability_tool` steps in the same `engine_state` chain. If count > 0 → reject with
deterministic error before any network call.

The Node-side endpoint asserts `depth === 0` in the request body as redundant defense
(fail-closed per L-0177 — defense-in-depth across runtime boundary, not single-point trust).

Rationale: depth enforcement runs on the side that owns the step-history view
(`engine_state_step` is EF-accessible via Supabase RPC). Node-side endpoint has no engine
state view; trusting body depth alone would be the silent-fallback class.

### Telemetry split (avoid double-emit)

Two distinct events represent the two distinct facts:

| Event                                       | Side | Destinations                                                  | Represents                            |
| ------------------------------------------- | ---- | ------------------------------------------------------------- | ------------------------------------- |
| `engine.action.invoked.invoke_capability_tool` | Node | posthog + logger + activity_trail + engine_event (per ADR-0193) | Tool execution fact (gate + body)     |
| `engine.dispatch.bridge_invoked`            | EF   | posthog + logger + activity_trail (NOT engine_event)          | EF transport fact + latency + outcome |

The Node-side variant was registered in PR #478 and is correctly the **execution** event.
The EF-side `engine.dispatch.bridge_invoked` variant is **new**; it must be added to
`packages/telemetry/src/registry.ts` in the same sortie that implements the EF proxy (Phase
2-B). Routing excludes `engine_event` because the Node side already emits an `engine_event`
row for the execution — duplicating EF-side would produce two engine_event rows per single
logical invocation (same class as L-0094 phantom-emit-contracts).

### Env var contract

A new env var is required for EF→stage-engine internal auth:

| Var                          | Scope                          | Source                                    | Reachable from client? |
| ---------------------------- | ------------------------------ | ----------------------------------------- | ---------------------- |
| `STAGE_ENGINE_INTERNAL_KEY`  | EF → stage-engine internal API | 1Password: `op://smartout_ai_prod/stage-engine/internal-key` (+ `_dev` variant) | No                     |

This is **distinct** from `STAGE_ENGINE_API_KEY`, which scopes BFF (Next.js Server) →
stage-engine for the user-JWT path. Keys are not interchangeable:

- `STAGE_ENGINE_API_KEY` carries scope `bff:proxy` (user-routed agent traffic)
- `STAGE_ENGINE_INTERNAL_KEY` carries scope `engine:invoke` (EF-initiated tool dispatch)

Both keys honour ADR-0265 secrets protocol: provisioned via 1Password, synced to Supabase
secrets + Vercel env + droplet manifest via `sync-env-to-*.sh`. Drift-check
(`infra/scripts/drift-check.sh`) auto-detects the new env channel.

### Documentation surfaces (mandatory in same PR as Phase 2-A)

Phase 2-A endpoint implementation MUST update these reference docs in the same PR:

- `docs/reference/SERVICE_ROUTING.md` — add EF→stage-engine internal route row
  (auth: `x-api-key + scope engine:invoke`, request shape per §Endpoint contract above)
- `docs/reference/EDGE_FUNCTIONS_REFERENCE.md` — note `engine-dispatch` action-type
  `invoke_capability_tool` bridges to stage-engine; not a self-contained EF handler
- `docs/reference/ENV_VARS.md` — add `STAGE_ENGINE_INTERNAL_KEY` row, link to 1Password ref

Reference doc drift is the highest-frequency failure class in cross-runtime work (L-0359
doctrine-ADR gap is the formal-decision-level sibling; missing reference rows are the
operational-level sibling). Treat reference doc updates as merge-blocker for Phase 2-A.

### Future evolution

The HTTP bridge is **interim, not permanent**. The architecturally clean resolution is to
migrate `engine-dispatch` from a Deno EF to a Node service (stage-engine or a new
`engine-dispatch-node`), allowing direct `import { resolveCapabilityTool } from "@smartout/ai"`.

When that migration ships (deferred sortie **B6** — campaign-scale, blocks on pg_cron URL
swap + EF→service routing parity):

1. `STAGE_ENGINE_INTERNAL_KEY` retired
2. EF stub `engine-dispatch` deprecated; cron triggers swap to Node service URL
3. `/internal/engine-dispatch/invoke-capability-tool` endpoint can stay (already on the right
   side) or fold into direct call — implementation choice at B6 time
4. This §Transport layer section gets a "Superseded by ADR-XXXX (B6 dispatcher migration)"
   header

The bridge buys time for B6 to be sequenced properly (after current C2 campaign sortier
land) without blocking C2 on a runtime-migration campaign.

See [`docs/plans/B6-ENGINE-DISPATCH-NODE-MIGRATION.md`](../plans/B6-ENGINE-DISPATCH-NODE-MIGRATION.md)
for the deferred-sortie scope, trigger conditions, and migration outline.

## Rules & Consequences

- **Good:** Unblocks C2 campaign (sortie G) without violating frozen-4 boundaries
- **Good:** Re-uses existing capability tool bodies (no duplicate logic in EF)
- **Good:** ADR-0356 audit symmetry preserved automatically (handler enforces)
- **Bad:** New action-type adds dispatcher complexity (~50 LOC)
- **Bad:** Recursion-depth check is runtime, not schema — relies on handler discipline

## Agent Impact

When designing any future scheduled / cron / Event Engine work that needs capability
functionality:

1. Author the capability tool ONCE in `packages/ai/src/capabilities/`
2. Create an `engine_process` blueprint with an `invoke_capability_tool` step
3. Bind via `engine_trigger` for cron / event spawn
4. NEVER duplicate the capability logic in an Edge Function

The `ops-day-brief/index.ts` refactor (sortie G) is the canonical reference implementation
of this pattern.

## References

- 11-agent restaurant-week sim council 2026-05-25 (system-agent-coordinator framing depth)
- Council R6 2026-05-25 PM (transport-layer escalation, 3:1 HTTP bridge majority, harness B6 dissent)
- [[ADR-0173]] — frozen-4 capability boundaries
- [[ADR-0356]] — cascade-namespace-delegation audit symmetry (gate-placement precedent)
- [[ADR-0151]] — server-derived workspace_id (cross-runtime extension applies)
- [[ADR-0193]] — telemetry routing contract (4-destination pattern for execution event)
- [[ADR-0265]] — secrets/env-var protocol (new `STAGE_ENGINE_INTERNAL_KEY` honours this)
- [[ADR-0421]] sub-pattern C — EF/capability duplication (inline-mirror rejection)
- L-0355 — C2 reframing (duplicate-logic surface vs engine_process gap depth)
- L-0361 — ADR-missing-cross-runtime-dimension (3rd-occurrence pattern; this amendment closes for ADR-0424 specifically and codifies the Phase 2.5 rule for future ADRs)
- `docs/plans/B6-ENGINE-DISPATCH-NODE-MIGRATION.md` — Deferred sortie that supersedes §Transport layer when landed (Harness Specialist dissent direction)
