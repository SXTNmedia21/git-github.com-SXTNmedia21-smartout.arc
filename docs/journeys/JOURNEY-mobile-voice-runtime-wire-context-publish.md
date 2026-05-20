---
title: "Journey — Mobile publishes botsson-context on LiveKit data channel"
feature: mobile-voice-runtime-wire
status: draft
updated: 2026-05-20
created: 2026-05-20
module: mobile
tags: [journey, voice, livekit, mobile, adr-0297]
---

# Journey — Mobile publishes botsson-context on LiveKit data channel

## Context

Predecessor sortie shipped BFF returning `WorkforceSnapshot` inline. Mobile receives the payload but does NOT publish it on the LiveKit data channel topic `botsson-context`. Voice-agent's `setSessionContext()` therefore never fires for mobile sessions. ADR-0297 closure requires runtime publish.

## Journey: Employee opens voice on mobile, first turn carries snapshot to voice-agent

**Precondition:**
- Employee authenticated on mobile
- Workspace policy `channel_ai_policy.voice_participation = 'interactive'`
- Mic permission granted

**Steps:**

1. User long-presses FAB → BotssonSheet expands; voice-mode auto-selected per AI Prefs (default voice ON)
2. `useBotssonVoiceSession.start()` invoked
3. Token minted via `livekit-token` Edge Function
4. `Room.connect(serverUrl, token)` resolves → `RoomEvent.Connected` fires
5. Mic enables → Orb status = listening
6. User speaks first utterance: "Hei Botsson, hvem jobber kveldsvakt på torsdag?"
7. ASR fires → mobile POSTs `/api/emma/voice/transcript` with `{ text, sessionId: null, channel: 'voice' }`
8. BFF assembles workforce snapshot (already implemented in P1), returns response `{ text, sessionId, snapshot: { version, hash, payload } }`
9. **NEW (P3)**: Mobile parses `snapshot` from response → stores in BotssonProvider context
10. **NEW (P3)**: Mobile publishes `botsson-context` data-channel message with payload → voice-agent `setSessionContext()` fires; `getSessionContextSnapshot()` populated
11. Voice-agent forwards subsequent turns to stage-engine with workforce facts inlined in system-prompt slice
12. Realtime LLM answers with concrete names + shift times (no "jeg trenger flere detaljer" fallback)
13. TTS speaks answer → User hears specific employee names

**Postcondition:**
- Voice-agent has session context for remainder of room session
- Mobile voice quality matches web voice for workforce queries
- Telemetry: `voice.bootstrap.snapshot_published` emitted (mobile-side, on publish ack)
- Telemetry: `voice.bootstrap.snapshot_sent` emitted (server-side, already in place from P1)

**Error paths:**

- BFF returns response WITHOUT `snapshot` field (e.g. warm turn, version matches) → mobile skips re-publish; existing voice-agent state retained
- LiveKit data channel publish fails (room state mid-disconnect) → mobile retries once on next `RoomEvent.Connected`; if 3 retries fail, log telemetry `voice.bootstrap.publish_failed` + continue voice session in degraded mode (voice-agent falls back to query_smartout tool roundtrip per existing behavior)
- Snapshot payload size > LiveKit data-msg cap → BFF already handles via `payload_url` → mobile fetches via GET `/api/emma/voice/snapshot/[version]` then publishes
- `RoomEvent.Connected` fires multiple times (reconnect) → mobile dedupes publish via `lastPublishedVersion` ref

## Acceptance

- [ ] `voice.bootstrap.snapshot_published` fires within 1500ms of `RoomEvent.Connected`
- [ ] Voice-agent docker log shows `setSessionContext()` invoked with workspace + workforce non-null for mobile session (P3-verify artefact)
- [ ] Second voice turn answered without `query_smartout` tool roundtrip (snapshot present)
- [ ] Telemetry payload includes non-empty workspace_id + actor_id (ADR-0134)
- [ ] PII whitelist enforced — no bank/tax/personnummer in published payload

## References

- ADR-0297 — workforce snapshot bootstrap pipe
- ADR-0078 — channel + PII boundary
- L-0233 — voice-agent context proof required, not assumed
- `services/voice-agent/src/context.ts:setSessionContext`
- `apps/mobile/src/hooks/use-botsson-voice-session.ts` (Room.connect resolution)
- `apps/web/src/app/api/emma/voice/transcript/route.ts` (snapshot return — P1 implementation)
