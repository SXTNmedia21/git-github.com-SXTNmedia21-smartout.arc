---
title: "cascade_gate_write Channel Parameter (closes voice CVE)"
id: ADR-0230
status: proposed
layer: decision
created: 2026-04-28
updated: 2026-04-28
---

# ADR-0230: `cascade_gate_write` Channel Parameter (closes voice→Server Action ADR-0078 bypass)

## Context and Problem Statement

`cascade_gate_write` RPC (ADR-0091 WP2, migration `20260512100000`) accepts 8 parameters but no `channel`. The TypeScript wrapper `GateContext` (`packages/supabase/src/gate-client.ts:74-99`) exposes `entityType`, `entityId`, `workspaceId`, `capability`, `actorProfileId`, `currentData`, `entityIdColumn` — no `channel` field. Server Action mutations therefore cannot enforce ADR-0078 voice-channel restrictions through this gate.

`gate_action` (ADR-0099) reads `engine_process.allowed_channels` and returns `channel_allowed` + `downgrade_to`. It enforces ADR-0078 correctly. But Server Actions call only `cascade_gate_write` today (verified Phase 3 by Botsson Harness Builder, 2026-04-28 council). Voice-initiated Server Action mutations therefore bypass ADR-0078 entirely.

Today's surface is web-only Server Actions, so the bypass is theoretical. Phase C1 (mobile LiveKit, ADR-0135) and Phase B4 (helpdesk voice tickets, campaign/helpdesk Phase 3) expose the gap operationally — voice mutations would route through Server Actions without channel enforcement.

## Decision Drivers

- ADR-0078 cannot be enforced post-hoc; it must hold at the RPC boundary.
- ADR-0229 transitional architecture mandates both gates fire on Server Action mutations during Phase 0-B4 window. Both must agree on channel posture.
- The unified `gate_evaluate` RPC (ADR-0229 Phase B2-B4 destination) MUST take channel as a first-class parameter; deferring it now blocks unification.
- Migration cost is bounded: 3 production caller files (`people-actions.ts`, `season-actions.ts`, `gated-result.ts`).

## Considered Options

1. **Add `p_channel TEXT` parameter to `cascade_gate_write`, default `'system'`.** Read `engine_process.allowed_channels` (or per-capability allowed-channels seed when no engine_process binding exists), enforce + return `channel_allowed` + `downgrade_to` in JSONB response.
2. **Keep `cascade_gate_write` channel-agnostic; require Server Actions to call `gate_action` first for channel enforcement.** Doubles dispatch responsibility, requires runtime contract that callers cannot statically verify.
3. **Defer until unified `gate_evaluate` ships (ADR-0229 Phase B2-B4).** Leaves voice bypass open for ~10 weeks during which Phase C1 + Phase B4 may ship.

## Decision Outcome

Chosen option: **"Option 1 — extend `cascade_gate_write` with `p_channel` parameter"**, because:

- ADR-0078 enforcement at every gate boundary is non-negotiable.
- ADR-0229 explicitly lists this as P5 prerequisite.
- 3-file migration is small enough to land before any voice-initiated mutation surface ships.
- Forward-compatible with unified `gate_evaluate` (signature subset match).

## Rules & Consequences

### Migration Plan

1. **New migration** `YYYYMMDDHHMMSS_cascade_gate_write_channel.sql` extends RPC signature: `p_channel TEXT NOT NULL`, validates against `engine_process.allowed_channels` when `p_capability` resolves to an `engine_process_id` mapping; falls back to capability default-channel set when no process binding exists. JSONB response gains `channel_allowed` + `downgrade_to` keys mirroring `gate_action`.
2. **`packages/supabase/src/gate-client.ts`** — add `channel: SessionChannel` to `GateContext`. Required field (no default). Forward to RPC as `p_channel`. Update `GatedWriteResult<T>` to surface `channelAllowed` + `downgradeTo` from RPC response.
3. **All 3 production callers** (`people-actions.ts`, `season-actions.ts`, `gated-result.ts`) updated to pass `channel`. For Server Actions invoked from web UI, default to `'chat'` (web is conversational). For internal callers (cron, Stage Engine), pass `'system'`.
4. **`packages/supabase/src/__tests__/gate-client.test.ts`** — add channel-bypass test (RPC denies when channel not in allowed_channels for the capability).

### Consequences

- **Good, because** ADR-0078 voice-PII protection holds across both gate paths.
- **Good, because** the unified `gate_evaluate` (ADR-0229 Phase B2-B4 destination) has its channel contract pre-validated by 10+ weeks of dual-path operation.
- **Bad, because** every existing `gatedUpdate/Insert/Delete` call site must add a `channel` field — TypeScript breakage on upgrade. 3 production files affected (verified 2026-04-28).
- **Agent Impact:** All future Server Actions and capability tools that invoke `gatedUpdate/Insert/Delete` MUST supply `channel: SessionChannel` in `GateContext`. CI parity check (ADR-0189 amendment per ADR-0229 P2) verifies the field is present at every call site.

## References

- ADR-0078 (voice forbidden for critical data)
- ADR-0091 (cascade_gate_write WP2)
- ADR-0099 (gate_action — channel enforcement reference implementation)
- ADR-0135 (mobile-voice-via-livekit-not-ultravox — Phase C1 dependency)
- ADR-0229 (dual-gate transitional architecture — P5 prerequisite)
- L-0164 (channel divergence asymmetry — voice CVE pattern)
- `supabase/migrations/20260512100000_cascade_gate_write.sql` (current 8-arg signature)
- `packages/supabase/src/gate-client.ts:74-99` (current `GateContext` lacks `channel`)

> After writing: register in `docs/decisions/0000-decision-log.md`.
