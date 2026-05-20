---
title: "Journey — Mobile voice session receives workforce snapshot"
feature: mobile-voice-bootstrap-pipe
status: verified
updated: 2026-05-20
created: 2026-05-20
module: mobile
tags: [journey, voice, livekit, mobile, adr-0297]
---

# Journey — Mobile voice session receives workforce snapshot

## Context

Web Botsson voice surface sends `botsson-context` on the LiveKit data channel at session start (`BotssonOrbVoiceMount.tsx`). Voice-agent (`services/voice-agent/src/context.ts`) sets module-scope session context and `adapter.ts:ask()` injects the snapshot into stage-engine `/agent/chat` calls. Mobile path is missing this entirely — Realtime LLM sees null workspace + null user + empty workforce facts.

## Journey: Employee opens voice on mobile after sign-in

**Precondition:**
- Employee authenticated on mobile app (Supabase session valid)
- Workspace policy `channel_ai_policy.voice_participation = 'interactive'`
- Mic permission granted

**Steps:**

1. User taps Orb in BotssonShell → `useBotssonVoiceSession.start()` invoked
2. System mints LiveKit token via `supabase.functions.invoke('livekit-token', { purpose: 'ai_voice' })` → System returns token + serverUrl + voiceParticipation policy
3. System opens `Room.connect(serverUrl, token)` → User sees Orb status = connecting
4. **NEW**: After room connect resolves, system fetches workforce snapshot from BFF (or BFF returns it in token response) → System assembles `{ user, workspace, workforce }` per ADR-0297 schema
5. **NEW**: System publishes data-channel message on topic `botsson-context` with snapshot payload → Voice-agent `setSessionContext()` fires; module-scope state populated
6. System enables mic → User sees Orb status = listening; mic icon active
7. User speaks: "Hvem jobber kveldsvakt på torsdag?"
8. ASR transcript fires → BFF `/api/emma/voice/transcript` forwards to stage-engine
9. Voice-agent `adapter.ts:ask()` calls `getSessionContextSnapshot()` → returns non-null with shifts_today/tomorrow populated
10. Stage-engine system-prompt slice receives workforce facts → Realtime LLM answers with actual names + shift times
11. TTS speaks answer → User hears specific employee names instead of "Jeg trenger flere detaljer"

**Postcondition:**
- Voice-agent has session context for the remainder of the room session
- Mobile voice answers match web voice quality for workforce queries
- Telemetry event `voice.bootstrap.snapshot_sent` emitted with workspace_id + actor_id

**Error paths:**

- BFF snapshot assembly fails → Mobile retries once; if still failing, voice session continues with `requires_query_smartout: true` flag → Realtime LLM falls back to query_smartout tool roundtrip (degraded mode, latency penalty noted in telemetry)
- Data-channel publish fails (room not ready) → Mobile retries on `RoomEvent.Connected`; if 3 retries fail, voice session ends with user-facing error "kunne ikke laste arbeidsdata"
- PII whitelist violation (workforce snapshot includes forbidden field) → BFF rejects at assembly time; mobile receives 422; voice session continues with minimal context (user + workspace only, no workforce)
- Snapshot version drift mid-session (workforce_snapshot updated server-side, e.g. new shift added) → Mobile detects via response payload version field; re-publishes `botsson-context` on next turn

## Acceptance

- [ ] Snapshot published within 500ms of room connect resolved
- [ ] Voice-agent `getSessionContextSnapshot()` returns non-null for mobile sessions (verified via docker log inspection)
- [ ] Telemetry `voice.bootstrap.snapshot_sent` fires with non-empty workspace_id + actor_id (ADR-0134)
- [ ] PII whitelist enforced — no bank/tax/personnummer in snapshot
- [ ] Web parity test: same voice query returns equivalent answer quality on web + mobile

## References

- ADR-0297 — workforce snapshot bootstrap pipe
- L-0233 — two LLM contexts (verify via docker log)
- `services/voice-agent/src/context.ts:setSessionContext`
- `services/voice-agent/src/adapter.ts:ask` (lines ~55-110)
- `apps/web/src/lib/botsson-context-snapshot.ts` (reference implementation)
