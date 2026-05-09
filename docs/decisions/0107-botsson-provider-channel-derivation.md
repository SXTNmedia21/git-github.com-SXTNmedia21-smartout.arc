---
title: "BotssonProvider Channel Derivation (closes ADR-0078 mobile gap)"
id: ADR-0107
status: accepted
layer: decision
created: 2026-04-15
updated: 2026-04-15
module: mobile
tags: [adr, security, mobile, botsson, channel, adr-0077, adr-0078, adr-0099]
---

# ADR-0107: BotssonProvider Channel Derivation

**Status:** Accepted
**Date:** 2026-04-15

## Context and Problem Statement

The mobile `BotssonProvider` (`apps/mobile/src/providers/botsson-provider.tsx`)
hard-codes `channel: "mobile"` inside the `sessionContext` it exposes to every
Botsson session on the mobile surface. This value is not a valid
`SessionChannel` (`packages/ai/src/capabilities/types.ts` — the union is
`chat | voice | sms | email | autonomous | telegram | system`) and it breaks
the three-layer PII defence mandated by ADR-0078:

1. **Layer 1 — Process** (`engine_process.allowed_channels`) compares the
   originating channel against a chat/voice whitelist. `"mobile"` matches
   nothing and either fails open (if a downstream consumer coerces) or fails
   shut on every PII capability, depending on the code path.
2. **Layer 2 — Capability** (`CapabilityDefinition.allowedChannels`) filters
   capabilities by channel. `"mobile"` again matches nothing.
3. **Layer 3 — Tool** (`AgentToolContext.channel` via `ctx.channel !==
   'chat'` guards on intake tools). A device-label here silently normalises
   to `chat` in some call-sites (string inclusion / falsy check patterns),
   which is the worst outcome: a voice-initiated mobile session would be
   treated as chat and bypass the voice-PII block.

Council 6.4 (2026-04-15) flagged this as a security-critical bug because the
agent-router (`services/stage-engine/src/core/agent-router.ts`) and the new
`gate_action` RPC (ADR-0099) both consume `channel` verbatim when deciding
whether voice is permitted for a capability/process. A platform label leaking
into that field defeats the entire defence.

The conceptual error is category mismatch: *device type* (phone/tablet/web)
and *interaction channel* (chat/voice/sms/system) are orthogonal. A phone can
do chat. A desktop browser can do voice. The `channel` field is a security
boundary; `device_type` is telemetry metadata. They must never share a slot.

## Decision Drivers

- ADR-0077/0078 defence-in-depth only works if every executor sees a correctly
  typed `SessionChannel`.
- ADR-0099 unified `gate_action` RPC reads the channel parameter verbatim —
  invalid values silently collapse into a default-allow or default-deny state
  that is not auditable.
- Mobile is a first-class surface; it must carry the same guarantees as web.
- The fix must be mechanical enough that a test prevents regression.

## Decision Outcome

**Channel is derived from session `mode`, never set from a platform label.**

Contract:

| `mode`              | `channel`  |
|---------------------|------------|
| `'voice'`           | `'voice'`  |
| `'text'` (or null)  | `'chat'`   |
| system-initiated    | `'system'` (set by the dispatcher, not the provider) |

Rules:

1. `BotssonProvider` must type `channel` as `SessionChannel` — never a
   free-form string, never a device label.
2. If `mode` transitions mid-session (voice → text or text → voice) the
   exposed `channel` updates accordingly in the same render cycle.
3. Device metadata (phone/tablet) lives on a separate `device_type` field on
   the session context, used only for telemetry (`agent session_started`
   event `data.channel` retains its historical `"mobile" | "web"` shape, per
   the telemetry registry; that field is NOT a `SessionChannel`).
4. Before a session is started (`mode === null`) the context channel defaults
   to `'chat'` to preserve the safest interpretation for any pre-session
   consumer.

## Rules & Consequences

- **Good, because** the mobile surface now honours ADR-0077/0078/0099 without
  per-capability patches.
- **Good, because** all future Botsson embeddings (web Botsson, kiosk mode,
  Telegram bridge) inherit the same contract — device label must never
  masquerade as channel.
- **Good, because** enforcement lives inside the provider that owns the
  session lifecycle, with a jest test that proves it.
- **Bad, because** any downstream consumer that previously relied on the
  literal string `"mobile"` will break — there are currently none.
- **Agent Impact:** when adding a new Botsson client (web provider, kiosk,
  etc.), derive `channel` from `mode`. Never use platform/device strings for
  the channel field. `device_type` is a separate attribute if you need it.

## Test Evidence

`apps/mobile/src/providers/__tests__/botsson-provider.test.tsx` asserts:

- idle provider → `channel === 'chat'`, `device_type === 'mobile'`
- `startTextSession()` → `channel === 'chat'`
- `startVoiceSession()` → `channel === 'voice'`
- mode transition text → voice → `channel` flips to `'voice'`
- `device_type` is stable across channel transitions
- tool receiving the context through the Layer-3 guard sees
  `ctx.channel === 'voice'` when mode is voice (simulated guard)

## Related ADRs

- ADR-0077 — Contract Intake PII Handling
- ADR-0078 — Engine Process Channel Restriction
- ADR-0099 — Unified Authority-Gate (reads `channel` via `gate_action`)

---

> Registered in `docs/decisions/0000-decision-log.md`.
