---
title: "Journey: Mr. Botsson — Dashboard Orb Voice Call (LiveKit)"
status: done
created: 2026-05-09
updated: 2026-05-09
module: MODULE_BOTSSON
tags: [botsson, voice, livekit, orb, dashboard, journey, ADR-0282]
decisions: [ADR-0282, ADR-0151, ADR-0078]
---

# Journey: Mr. Botsson — Dashboard Orb Voice Call (LiveKit)

## Context

The BotssonShell Orb supports voice calls via LiveKit. Mic button is mounted below the Orb.
Token route: `POST /api/botsson/voice/token`.
Voice agent: `services/voice-agent` (LiveKit @livekit/agents, NOT Ultravox — ADR-0282).

Landed: 2026-04-29 (feat/botsson-orb-voice-mount, commit e5e5adaa).

## Journey: Employee Starts a Voice Call with Mr. Botsson

**Precondition:**
- Employee is authenticated in the dashboard.
- BotssonShell is visible (bottom-right corner).
- No `<DomainChatOwnership>` is declared on the current page (Orb is interactive).
- LiveKit server is reachable (`NEXT_PUBLIC_LIVEKIT_URL` is configured).
- `services/voice-agent` is running and listening for LiveKit room joins.

**Steps:**

1. Employee taps the mic button below the Orb
   → Browser requests `POST /api/botsson/voice/token`
   → Server derives `profileId` from JWT (ADR-0151 — never from request body)
   → Server mints LiveKit token for room `botsson-orb:<profileId>`
   → Token returned to browser

2. Browser connects to LiveKit room `botsson-orb:<profileId>` using the token
   → Employee sees Orb status change: pulsing animation indicates voice-ready
   → `BotssonVoiceCall` component rendered (LiveKit Orb mount)

3. `services/voice-agent` autojoins the room
   → Voice agent loads `buildAllBotssonTools()` (orb tools + personal tools + 10 domain query tools)
   → Channel = `"voice"` is forwarded to stage-engine for all tool calls
   → Stage-engine Layer 3 guard enforces channel restrictions (ADR-0078): chat-only tools rejected

4. Employee speaks a question (e.g. "Hva er mitt neste vaktbytte?")
   → LiveKit transcribes audio → text
   → Voice agent calls relevant tool (e.g. `shift_swap` capability query)
   → Stage-engine processes tool call with `channel="voice"`
   → Tool returns data
   → Voice agent synthesizes response audio
   → Employee hears Mr. Botsson speak the answer

5. Employee ends the call (taps mic button again or closes Orb)
   → Browser disconnects from LiveKit room
   → Orb returns to default state (non-pulsing)
   → Session recording hook captures `session_end` event (Phase D1)

**Postcondition:**
- Voice session recorded in `agent_session_recording` (fire-and-forget).
- Telemetry emitted via voice-agent tool calls.
- Employee has received audio response.

**Error paths:**
- Token endpoint fails (e.g. `LIVEKIT_API_KEY` missing) → 500. Orb shows error icon.
  Browser console: "Failed to get voice token." No visible error to user — add i18n error state to BotssonVoiceCall.
- `services/voice-agent` not running → LiveKit room created but no participant joins. Employee hears silence.
  Timeout (e.g. 10s no agent join) → Orb shows "Stemmeassistenten er ikke tilgjengelig akkurat nå."
- Audio permissions denied by browser → Browser shows permission prompt failure.
  Orb should catch `getUserMedia` error and show: "Mikrofontilgang kreves for stemmebruk."
- Chat-only tool called via voice → stage-engine Layer 3 guard rejects tool call. Agent responds:
  "Denne funksjonen er ikke tilgjengelig via stemme."
- Network drops mid-call → LiveKit handles reconnect. If reconnect fails, Orb shows disconnected state.

## Design Notes

**Why not `livekit-token` Edge Function?**
The `/api/botsson/voice/token` BFF route bypasses the `livekit-token` Edge Function because
channel membership validation in the EF is incompatible with personal rooms (`botsson-orb:<profileId>`).
Personal rooms do not have channel members — they are 1:1 per-user rooms.

**Tool registry for voice:**
`buildAllBotssonTools()` in `services/voice-agent` is a duplication of the stage-engine registry
(ADR-0289 — tactical duplication accepted). Voice agent does NOT use the `@smartout/ai/adapters/livekit.ts`
adapter (47 LOC converter, zero consumers) — it uses `@livekit/agents` natively with HTTP bridge to stage-engine.

**Ultravox vs LiveKit:**
Prior to ADR-0282, `/onboarding` wizard used Ultravox for voice. That path is DEPRECATED.
All new voice work uses LiveKit. Do not add new Ultravox integrations.
