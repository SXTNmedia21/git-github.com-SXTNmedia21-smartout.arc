---
title: "Unified Authority-Gate Across agent-router and engine-dispatch"
id: ADR_0099
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
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

Extract a single authority-gate module shared by both executors.

1. **Module:** `packages/ai/src/engine/authority-gate.ts`. Pure-function gate exporting:
   - `evaluateGate({ workspaceId, capability, channel, actorRole, riskClass }) → { allow: boolean, downgradeTo?: AuthorityLevel, reason?: string }`
   - Inputs come from caller; module performs no I/O. Authority + channel data are loaded by callers using existing `loadAuthorityConfig` (`services/stage-engine/src/core/authority.ts`) or equivalent edge-function helper.
2. **agent-router** keeps its current call sequence; replaces inline min-role + channel logic with a call to `evaluateGate`.
3. **engine-dispatch** loads the engine_process row (with `min_role` and `allowed_channels`), constructs the gate input from the trigger context (which channel initiated the trigger, which actor), calls `evaluateGate`, and aborts the step with an audit event if `allow === false`.
4. **Channel propagation:** triggers must record originating channel in `engine_state.context.originating_channel`. DB-trigger paths (e.g., `schedule_shift` AFTER INSERT) default to `"system"`. Voice-initiated paths must set `"voice"` explicitly. Chat-initiated set `"chat"`.
5. **Default deny on missing data:** if `engine_authority_config` has no row for the capability, gate returns `allow: true` (status quo, status quo behavior preserved). If `allowed_channels` is non-NULL and originating channel is not in the set, gate returns `allow: false` with audit reason `channel_not_permitted`.
6. **Audit:** every gate evaluation emits a telemetry event (`authority gate_evaluated`) routed to `activity_trail`.

## Rules & Consequences

- **Good, because** ADR-0077/0078 active violation is closed; C4 enforcement is consistent across executor paths; one place to reason about authority changes.
- **Bad, because** every engine_process step now pays the cost of a gate evaluation (negligible — pure function); some triggers will need updating to set `originating_channel` correctly.
- **Agent Impact:** when adding a new engine_process action_type or a new agent-router capability, the gate is automatic via the shared module — do not reimplement.

## Migration Plan

Phase 1 of the shift-lifecycle consolidation roadmap (council 2026-04-15) ships this independently of the rest of the consolidation, because it closes an active security hole.

Steps:
1. Extract `evaluateGate` from current agent-router logic into `packages/ai/src/engine/authority-gate.ts`.
2. Refactor `agent-router.ts` to use the extracted module (no behavior change).
3. Add `originating_channel` to `engine_state.context` schema and dispatcher writes.
4. Wire `evaluateGate` into `engine-dispatch/index.ts` before each mutation step (`update_entity`, `send_notification`, `assign_task`, etc.).
5. Backfill `originating_channel = 'system'` for existing in-flight engine_states.

## Related ADRs

- ADR-0077 — PII handling (proposed).
- ADR-0078 — channel restriction.
- ADR-0091 — governance gate placement (Postgres RPC).
- ADR-0095 — Five-Layer Architecture (Decision layer requires this gate).
