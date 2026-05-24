---
title: "`invoke_capability_tool` Engine-Dispatch Action-Type Contract"
id: ADR-0424
status: accepted
layer: decision
created: 2026-05-25
updated: 2026-05-25
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
- [[ADR-0173]] — frozen-4 capability boundaries
- [[ADR-0356]] — cascade-namespace-delegation audit symmetry
- [[ADR-0151]] — server-derived workspace_id
- [[ADR-0421]] sub-pattern C — EF/capability duplication
- L-0355 — C2 reframing (duplicate-logic surface vs engine_process gap depth)
