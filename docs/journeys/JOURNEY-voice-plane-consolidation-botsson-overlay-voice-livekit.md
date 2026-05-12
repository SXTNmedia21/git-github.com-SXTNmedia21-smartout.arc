---
title: "Journey — Botsson Overlay Voice on Web Routes Through Voice-Agent"
feature: voice-plane-consolidation
journey: botsson-overlay-voice-livekit
status: verified
verified_at: 2026-05-10
e2e_test: "deferred — see Phase F sortie 4"
created: 2026-05-04
updated: 2026-05-10
module: MODULE_BOTSSON
tags: [journey, voice, botsson, overlay, livekit]
---

# Journey: Botsson Overlay Voice on Web Routes Through Voice-Agent

**Role:** authenticated employee/manager/admin (post-workspace user with active profile)

**Precondition:**
- User authenticated with active profile in workspace
- Botsson overlay (BotssonShell + BotssonProvider) mounted
- `BotssonProvider.tsx:693` post-flip uses `provider:"livekit"`
- Voice tool surface registered server-side via `buildAllBotssonTools()` in voice-agent

## Happy Path

1. User opens any dashboard page with BotssonShell mounted → BotssonProvider initializes LiveKit Room via `useBotsson` (rewritten to use VoiceProvider abstraction with `provider="livekit"`)
2. User triggers voice session (e.g., orb tap or hotword) → BFF mints LiveKit token → connects to `services/voice-agent/` LiveKit Room
3. User says "vis dagens vakter" → LiveKit Agents 1.3.0 native function-calling → voice-agent server-side `buildAllBotssonTools()` resolves to `schedule.get_today_shifts` capability tool → `adapter.ts:53 ask()` → stage-engine `/agent/chat` → workspace-scoped query → spoken response via TTS
4. Active speaker indicator updates via `RoomEvent.ActiveSpeakersChanged`
5. Orb 6-state machine transitions: idle → connecting → listening → thinking → speaking → idle
6. User ends session → LiveKit Room disconnects → orb returns to idle

**Postcondition:**
- Tool result delivered via TTS in same call (no client-side temporaryTool callback)
- `activity_trail` row written for tool invocation per ADR-0134
- `agent_session_recording` row written per ADR-0184 (D1 session recorder coverage)
- Channel guard `ctx.channel="voice"` server-pinned in BFF before tool dispatch (Layer 2 enforcement)

## Error Paths

- **Scenario: User asks for personnummer or contract details on voice** → ADR-0078 channel guard fires → tool returns "Av sikkerhetshensyn må dette skje i chat, ikke via stemme" → orb suggests chat surface
- **Scenario: Network drop mid-session** → `RoomEvent.Disconnected` → orb enters `error` state → optional auto-reconnect with `Reconnecting` UI banner; PTT mute-toggle preserved on reconnect
- **Scenario: voice-agent service unavailable** → LiveKit Room connection fails → orb `error` state → fallback to chat surface
- **Scenario: tool-call result diverges from Ultravox shape** → integration test fail-fast in T1 build; not user-visible

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists at `apps/e2e/tests/journey-botsson-overlay-voice-livekit.spec.ts` and passes
- [ ] Manually tested on at least 3 dashboard pages
- [ ] Channel guard verification: PII-intent voice request returns ADR-0078 redirect message
- [ ] Recording: `agent_session_recording` row exists per voice session

**Mark `status: verified` in frontmatter when all five boxes are checked.**
