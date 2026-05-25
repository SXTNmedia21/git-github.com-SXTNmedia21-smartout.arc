---
title: "Sortie F Phase 2 (T-Handler) — BLOCKED on Deno/Node module boundary"
status: blocked
updated: 2026-05-25
created: 2026-05-25
module: ai
affected_domains: [engine-dispatch, capabilities]
tags: [blocker, escalation, adr-0424, sortie-f, t-handler]
---

# Sortie F Phase 2 — T-Handler BLOCKED

> Branch: `feat/engine-invoke-cap-tool-handler`
> Worktree: `/home/sxtnl/dev/smartout.ai-wt-23`
> Phase 1 deliverables: PR #476 (schema) + PR #477 (resolver shim) + PR #478 (telemetry registration) — all merged on `development`.

## TL;DR

**T-Handler cannot ship as scoped.** The `invoke_capability_tool` action-type handler must
live in `supabase/functions/engine-dispatch/index.ts` (a Deno Edge Function), but capability
tool bodies + the T-Shim resolver live in `packages/ai` (a pnpm Node ESM package). **Deno
cannot import from `packages/ai`** — the existing engine-dispatch code base already
acknowledges this explicitly. The handler therefore cannot reach `resolveCapabilityTool()`
or any capability tool body from inside the EF runtime.

This is a structural boundary that requires architectural resolution before T-Handler can
proceed. It is the exact "logic beside cascade" anti-pattern that ADR-0424 was meant to
close — surfaced one layer deeper than the ADR anticipated.

## Evidence (sibling-pattern check completed)

### 1. Existing engine-dispatch comment, line 3057-3061 in `supabase/functions/engine-dispatch/index.ts`

> "Lives outside executeStep so the switch stays readable. Deno can't
> import @smartout/billing — the adapter logic below is a minimal
> inline mirror of the Node-side adapters."

### 2. Existing handler `supabase/functions/engine-dispatch/handlers/sync-integration.ts`, line 16-19

> "Deno cannot import @smartout/billing — the adapter shape below is a
> minimal inline mirror of the Node-side adapter interface."

### 3. Existing `supabase/functions/pos-sync/index.ts`, line 50-52

> "Types (mirror of packages/ai/src/adapters/pos/lightspeed.ts)
> Duplicated here because Edge Functions cannot import from packages/ai
> (Node ESM vs Deno module boundary)."

### 4. Grep for any Smartout package import in `supabase/functions/`

```
$ grep -rn "@smartout" supabase/functions/engine-dispatch/index.ts \
                       supabase/functions/engine-dispatch/handlers/*.ts
# Only comments documenting that imports are not possible. Zero real imports.
```

### 5. No HTTP bridge endpoint exists

```
$ grep -rn "invoke.*tool\|tool.*invoke\|tool/run" services/stage-engine/src/routes/
# No tool-invocation endpoint in stage-engine that an EF could callback into.
```

### 6. No prior precedent for capability invocation from an EF

```
$ find . -name "*.ts" | xargs grep -l "invoke_capability_tool"
./packages/telemetry/src/registry.ts       # event-type registration only
./packages/ai/src/engine/resolve-capability-tool.ts  # Node-only resolver
```

Neither file references engine-dispatch. The Phase 1 deliverables are correctly built but
collectively form a Node-side surface that the Deno-side dispatcher cannot reach.

## What WAS confirmed valid before hitting the blocker

- ADR-0424 read in full. Note: contract specifies **recursion depth = 1** (§Recursion limit),
  not "max 3 nested" as the prompt suggested. Handler will enforce depth = 1 once
  invocation path is unblocked.
- Phase 1 schema migration `20260715100000_engine_invoke_capability_tool.sql` adds 6
  columns + 2 partial indexes correctly. The `idx_engine_state_step_invoke_cap` index
  exists exactly for the depth check.
- Phase 1 telemetry variant `engine.action.invoked.invoke_capability_tool` is registered
  with destinations `[posthog, logger, activity_trail, engine_event]`. **This destination
  set IS reachable from a Deno EF** — sibling handlers already insert into `engine_event`
  + `activity_trail` directly without going through the Node `emit()` helper.
- `gate_action` is invocable from the EF via `supabase.rpc("gate_action", { ... })` — the
  existing dispatcher loop at `index.ts:726` already uses this exact pattern for the 11
  GATED_MUTATION_TYPES set.
- The handler skeleton from the prompt is sound in shape (gate → execute → persist → emit
  → advance). Only the `execute` step is unreachable.

## Why the obvious workarounds are not in scope for this sortie

### Workaround A — Inline-mirror the capability tool body in the EF (sync-integration pattern)

The existing `sync-integration.ts` handler duplicates the billing-adapter shape inline.
This works for **one specific tool** (billing sync). It does NOT scale to the ADR-0424
contract, which says any capability tool must be invocable. Inlining N tools across M
capabilities into the EF reproduces Sub-pattern C of ADR-0421 (the very pattern ADR-0424
exists to close).

Inline-mirror is also explicitly forbidden by my prompt:
> Forbidden: Edits to packages/ai/src/engine/resolve-capability-tool.ts (T-Shim shipped,
> READ-ONLY here).

I cannot reach the body without duplicating it, and duplicating is the wrong call.

### Workaround B — HTTP bridge: EF calls back to stage-engine `/invoke-capability-tool`

This is the architecturally sound path: stage-engine (Node) exposes an internal endpoint
that resolves the capability tool, calls `gate_action`, and invokes execute(). The EF
becomes a thin HTTP caller. This pattern matches how other Node services are reached.

However:
- No such endpoint exists today (verified via grep above).
- This requires a new route in stage-engine, a new internal-auth contract between EF and
  stage-engine, new env vars (`STAGE_ENGINE_INTERNAL_URL` for EF), and a corresponding
  unit-test surface in stage-engine.
- That is a separate sortie scope — and arguably should be the actual Phase 2 design.

### Workaround C — Move engine-dispatch to a Node service

The handler logic moves out of `supabase/functions/engine-dispatch/` into a Node service
(stage-engine or a new `engine-dispatch-node`), so it can import `packages/ai` directly.
The existing `pg_cron`/event-trigger spawn path then targets the Node service URL.

This is a campaign-scale refactor, not a sortie. Explicitly out of T-Handler scope.

## Recommendation

**Escalate to orchestrator + system-agent-coordinator + system-steward.** This is the
exact class of decision (architectural cross-runtime contract) that the agent-coordinator
hat exists to gate.

Recommended next move:

1. **Council on transport layer** — decide between Workaround B (HTTP bridge to
   stage-engine) and Workaround C (move dispatcher to Node). System-agent-coordinator +
   system-steward + supervisor should weigh in. Likely outcome: B (lower blast radius,
   preserves existing engine-dispatch wiring).
2. **Write ADR-0424 amendment** — add §Transport layer specifying the EF↔Node bridge
   contract: route, auth, request/response shape, error semantics, depth-propagation.
3. **Phase 2-A (new sortie)** — implement the stage-engine `/internal/invoke-capability-tool`
   endpoint with full T-Handler invariants (gate, execute, emit, persist).
4. **Phase 2-B (this sortie, re-scoped)** — implement the EF-side handler as a thin HTTP
   caller into the new endpoint. The schema persistence, gate metadata, telemetry emit,
   and recursion depth check all happen EF-side; only the actual `tool.execute()` body
   runs in Node.

That split preserves T-Handler's scope (EF dispatcher logic) while honouring the runtime
boundary.

## What I did NOT do

- Did NOT register a new capability (forbidden per ADR-0173 + prompt).
- Did NOT add migration files (T-Schema already shipped per Phase 1).
- Did NOT edit `packages/ai/src/engine/resolve-capability-tool.ts` (forbidden per prompt).
- Did NOT edit `packages/telemetry/src/registry.ts` (forbidden per prompt).
- Did NOT invent an `AgentToolContext` shape inside the EF (would violate the prompt's
  "do NOT invent ctx" rule and L-0177 silent-fallback class).
- Did NOT inline-mirror a capability tool body (would reproduce ADR-0421 Sub-pattern C —
  the exact pattern ADR-0424 exists to prevent).
- Did NOT push a commit / open a PR. Worktree clean except for this blocker doc and the
  pre-existing plan stub.

## Files touched in this worktree

- NEW `docs/plans/SORTIE-F-HANDLER-BLOCKED.md` (this file)
- Pre-existing untracked `docs/plans/PLAN-engine-invoke-cap-tool-handler.md` (plan stub
  created by `/start-feature`, never populated).

No source files modified. No commits created.

## References

- ADR-0424 §Handler invariants — depth limit 1, gate_action before body, delegated_via
  propagation
- ADR-0421 Sub-pattern C — EF/capability duplication is the anti-pattern this work is
  meant to close
- ADR-0356 — audit symmetry pattern (delegated_via, actor_capability)
- ADR-0204 — gate_action invariant (gate BEFORE body)
- ADR-0173 — frozen-4 capability boundaries
- L-0177 — silent-fallback class (handler must fail-fast on null resolve)
- L-0353 — contract-promise-without-fulfillment (do not register a handler that no-ops)
