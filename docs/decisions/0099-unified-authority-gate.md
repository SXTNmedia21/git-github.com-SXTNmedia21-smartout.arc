---
title: "Unified Authority-Gate Across agent-router and engine-dispatch"
id: ADR_0099
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
supersedes-draft: "prior variant proposed a shared TS module; revised to Postgres RPC after Node/Deno split was surfaced during scoping"
module: stage-engine
tags: [adr, security, c4-governance, authority, channel-guard, adr-0077, adr-0078, adr-0091]
---

# ADR-0099: Unified Authority-Gate Across agent-router and engine-dispatch

**Status:** Accepted
**Date:** 2026-04-15

## Context and Problem Statement

The Smartout platform has **two executor paths** for capabilities and engine actions:

1. `services/stage-engine/src/core/agent-router.ts` — chat/voice initiated, used by Mr. Botsson. Implements `min_role` enforcement (commit `d4f069eb`, ADR-0091) and channel awareness.
2. `supabase/functions/engine-dispatch/index.ts` (1586 lines) — DB-trigger and cron initiated, runs engine_process steps. Performs **zero authority or channel checks** before mutating domain tables or dispatching notifications.

This means a mutation routed via Botsson is gated by `engine_authority_config` and may be channel-restricted (ADR-0077/0078 voice/PII guard), while the same mutation reached via an engine_process step is ungated. The ADR-0077/0078 declared `engine_process.allowed_channels` column is loaded into notification payloads but never used as an inbound filter. This is an active security violation.

## Decision Drivers

- **ADR-0077/0078 compliance:** voice channel must not reach PII-handling capabilities; must enforce in BOTH executor paths.
- **C4 ("Confident != Authorized"):** the principle is documented but never enforced in engine-dispatch — proposals can be applied without min_role check.
- **DRY:** two parallel implementations of the same gate logic will drift; one shared module forces consistency.
- **Don't break agent-router:** existing min-role logic in `agent-router.ts` works (commit `d4f069eb`); the unified gate must extract, not rewrite.

## Decision Outcome

**Postgres RPC as the single gate**, called by both executors. Consistent with ADR-0091 (governance gate placement as Postgres RPC with SECURITY DEFINER) and avoids the Node/Deno code-sharing problem: `services/stage-engine/` is Node/Hono and cannot share a TS module with `supabase/functions/engine-dispatch/index.ts` (Deno) without duplication. Both environments can call Postgres RPCs identically.

Decided 2026-04-15 after scoping investigation surfaced the Node/Deno split.

1. **RPC:** `public.gate_action(p_workspace_id uuid, p_capability text, p_channel text, p_actor_profile_id uuid, p_action_type text) → jsonb` with SECURITY DEFINER.
   - Returns `{ allow: bool, downgrade_to: authority_level | null, min_role_required: profile_role | null, channel_allowed: bool, reason: text | null, gate_evaluation_id: uuid }`.
   - Reads `engine_authority_config` (level + min_role per capability) and `engine_process.allowed_channels` when `p_action_type` is an engine_process step.
   - Writes one audit row to `gate_evaluation` table (new) with the inputs, outputs, and a timestamp — single source for "was this action gated, by what rule, and what was the outcome."
2. **agent-router** replaces inline `applyMinRoleDowngrade` + channel logic with a call to `gate_action` via `supabaseAdmin.rpc(...)`. Existing `loadAuthorityConfig` becomes internal to the RPC.
3. **engine-dispatch** calls `gate_action` before each mutation step (`update_entity`, `send_notification`, `assign_task`, `start_process`, `create_deviation`, `lock_checkout`, `validate_settlement`). If `allow=false`, the step aborts, a `gate.denied` telemetry event is emitted, and the engine_state is marked `blocked` pending manual resolution.
4. **Channel propagation:** triggers must record originating channel in `engine_state.context.originating_channel`. DB-trigger paths default to `"system"`. Voice-initiated paths set `"voice"`. Chat-initiated set `"chat"`. Unknown/missing = `"system"`.
5. **Default behavior:** if `engine_authority_config` has no row for the capability, gate returns `allow: true` (preserves status quo). If `allowed_channels` is non-NULL and originating channel is not in the set, gate returns `allow: false` with `reason='channel_not_permitted'`.
6. **Audit:** every gate evaluation writes to `gate_evaluation` table AND emits telemetry event `gate evaluated` (routed to activity_trail + PostHog). Denial adds `gate denied` event.

### Why RPC over shared TS module

| Criterion | TS module | Postgres RPC (chosen) |
|---|---|---|
| Cross-runtime (Node + Deno) | requires duplicated copies | single implementation |
| Consistency with ADR-0091 | divergent | aligned |
| Audit centralization | each caller writes | RPC writes once |
| Testability | unit tests per copy | one pgTAP / integration suite |
| Latency | in-process (faster) | one roundtrip per step (~2-5ms, acceptable) |
| Refactor risk | high if logic drifts | low — enforced by single schema |

## Rules & Consequences

- **Good, because** ADR-0077/0078 active violation is closed; C4 enforcement is consistent across executor paths; one place to reason about authority changes.
- **Bad, because** every engine_process step now pays the cost of a gate evaluation (negligible — pure function); some triggers will need updating to set `originating_channel` correctly.
- **Agent Impact:** when adding a new engine_process action_type or a new agent-router capability, the gate is automatic via the shared module — do not reimplement.

## Migration Plan

Phase 1 of the shift-lifecycle consolidation roadmap (council 2026-04-15) ships this independently of the rest of the consolidation, because it closes an active security hole.

Steps:
1. Migration: `gate_evaluation` table (audit log) + `public.gate_action` RPC (SECURITY DEFINER). Unit-test via pgTAP: default-allow when no config, deny when channel not in `allowed_channels`, min_role downgrade matrix.
2. Refactor `services/stage-engine/src/core/agent-router.ts`: replace inline `applyMinRoleDowngrade` + channel check with `supabaseAdmin.rpc('gate_action', ...)`. Verify no behavior change via existing tests + new integration test.
3. Add `originating_channel` to `engine_state.context` JSON schema. Dispatcher writes it when creating engine_state rows. DB-trigger paths default to `"system"`.
4. Wire `gate_action` into `supabase/functions/engine-dispatch/index.ts` before each mutation step. Blocked steps transition engine_state to `blocked` status with reason persisted.
5. Backfill existing in-flight engine_states: `UPDATE engine_state SET context = jsonb_set(context, '{originating_channel}', '"system"') WHERE context->>'originating_channel' IS NULL`.
6. Telemetry: register `gate evaluated` and `gate denied` events in `packages/telemetry/src/registry.ts` with routing to activity_trail + PostHog.

## Related ADRs

- ADR-0077 — PII handling (proposed).
- ADR-0078 — channel restriction.
- ADR-0091 — governance gate placement (Postgres RPC).
- ADR-0095 — Five-Layer Architecture (Decision layer requires this gate).
