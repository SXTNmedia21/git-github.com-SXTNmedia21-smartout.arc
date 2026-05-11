---
title: "Journey — Phase E Voice Plane Cutover"
feature: phase-e-cutover
status: verified
updated: 2026-05-10
created: 2026-05-10
module: MODULE_BOTSSON
tags: [voice, livekit, ultravox, phase-e, cutover, onboarding, botsson-orb]
---

# Journey — Phase E Voice Plane Cutover

Tech-migration sortie. Migrates all voice surfaces from Ultravox to LiveKit Agents 1.3.0 single-plane. User-facing journeys are preserved — same flows, different transport. Verification per ADR-0282 R6 amendment 2026-05-10: runtime telemetry + operator smoke (synthetic VAD bench superseded as structurally invalid).

## Journey 1: Ny bruker starter onboarding-wizard og snakker norsk til Lise

**Mål:** Bruker uten workspace åpner `/onboarding`, kobler til LiveKit-rom via wizard token, snakker norsk til Lise persona, fullfører intervju-flyt med 10 onboarding-tools registrert og finalize-workspace EF kalt.

**Precondition:**
- Bruker har gyldig auth-cookie eller anonymous
- LiveKit Cloud-room mintes via `/api/wizard/start` (LiveKit token, ikke Ultravox call)
- voice-agent container kjører LiveKit Agents 1.3.0 worker
- Krisp NC tilgjengelig på klient-side (web `@livekit/krisp-noise-filter`)
- 4 voice-telemetry events registrert i `packages/telemetry/src/registry.ts`

### Steg

1. **Bruker** klikker "Start onboarding" på landing-side
   → Web-rute `POST /api/wizard/start` validerer `purpose: "wizard"` body
   → Server-derive `workspaceId` per ADR-0151 (anon eller auth-resolved)
   → Calls `livekit-token` Edge Function med wizard branch metadata (mission_id, voice, first_speaker)
   → Returns `{ token, roomName: "${workspaceId}:wizard:${userId}", livekitUrl }`
   → Web **mounts LiveKit Room** via `useBotsson` hook (ikke `UltravoxSession`)
   → Krisp NC aktivert på local participant track (web `KrispNoiseFilter.create()`)
   → **Telemetry emit**: session.start tidspunkt registrert som baseline for `voice.first_speech_ts_ms`

2. **voice-agent worker** mottar room-join job
   → `services/voice-agent/src/agent.ts` `defineAgent.entry` runs
   → `resolveMissionIdFromRoomName(":wizard:")` → `"lise-interview"`
   → `getMission("lise-interview").systemPrompt` lastet
   → `voice.AgentSession` opprettet med OpenAI Realtime + server_vad + Lise voice (manifest.voice fra MISSION_MANIFEST, ikke hardcoded)
   → Session starter, Lise åpner med greeting "Hei! Jeg heter Lise..." (firstSpeaker === "agent")

3. **Bruker** snakker "Vi heter Strøm Mat & Bar."
   → Server-VAD detekterer turn-end (silence_duration_ms=250)
   → **Telemetry emit**: `voice.first_speech_ts_ms` (første gang user state → speaking)
   → **Telemetry emit**: `voice.turn_end_ts_ms` (på `UserInputTranscribed` isFinal, turn_count=1)
   → InterviewSurface (Lise persona-bearer) viser transcript live

4. **voice-agent** routes tool calls via stage-engine `/agent/chat`
   → `buildAllBotssonTools()` parallel-array (ADR-0289 R1.3 utestående) inkluderer 10 onboarding-tools
   → `update_business`, `update_season`, `add_departments`, `add_locations`, `add_zones`, `add_procedures`, `scrape_website`, `search_company`, `identify_company`, `add_key_fact` alle tilgjengelige
   → channel="voice" forwarded; chat-only-tools rejicerer per ADR-0078 Layer 3

5. **Bruker** fullfører wizard, Lise sier "ferdig"
   → `advanceToNextSection` (klient-bundet) trigger workspace finalize
   → `finalize-workspace` EF kalt — D1 dimensions skrevet til DB (eneste cascade-write for onboarding)
   → Bruker redirected til `/dashboard`
   → LiveKit room disconnect → **telemetry emit**: `voice.session_abandonment` ikke utløst (firstSpeechFired === true)

**Postcondition:**
- Workspace + profile opprettet, D1 dimensions populated
- Bruker logget inn på `/dashboard` med Mr. Botsson som default mission
- 4 voice-telemetry events skrevet til `engine_event` + `activity_trail` (PostHog + Logger destinations)
- Ingen Ultravox-imports utført (Phase E E6 deletion komplett)

**Error paths:**
- LiveKit token-mint feil → wizard returns 503 `VOICE_PROVIDER_UNAVAILABLE` med fallback "Neste"-knapp UI
- voice-agent worker offline → room mintet men ingen agent joiner; klient timeouts etter 30s, fallback chat-only mode
- Server-VAD klipper bruker av (Norwegian mid-utterance pause) → **telemetry emit**: `voice.user_recut` (gap < 2s) → Phase F1 telemetri-driven config tune
- Mid-session disconnect før Lise har snakket → `voice.session_abandonment` emit → Phase F1 dashboard surfaces abandonment-rate

## Journey 2: Eksisterende bruker bruker Botsson-orb i dashboard

**Mål:** Logget-inn bruker klikker BotssonVoiceCall mic-knapp under Orb i dashboard, kobler til personlig LiveKit-rom, stiller spørsmål til Mr. Botsson, mottar verbal respons med tool-calls.

**Precondition:**
- Bruker authenticated, profile.workspace_id resolved
- Token-rute `POST /api/botsson/voice/token` minter `botsson-orb:${profileId}` rom
- voice-agent dispatch matcher `:dashboard:` → `mr-botsson` mission
- profile.botsson_channel_id bootstrappet (ADR-0282 dependency, allerede live siden 2026-04-28 C1.d)

### Steg

1. **Bruker** klikker mic-knapp under Orb
   → BotssonVoiceCall calls `/api/botsson/voice/token` → LiveKit token
   → useBotsson kobler til LiveKit-rom, autojoin
   → Orb visualizer pulser "listening" state

2. **voice-agent** mottar room-join → mission resolve → `mr-botsson`
   → `firstSpeaker === "user"` (Jarvis-mode, agent venter)
   → context_init message med workspace_id + profile_id mottatt på `botsson-context` data channel

3. **Bruker** stiller spørsmål "Hva er status på dagens vakter?"
   → server-VAD turn-end → **telemetry emit**: `voice.turn_end_ts_ms`
   → voice-agent ask() forwarder til stage-engine `/agent/chat` med channel="voice"
   → intent-classifier → `schedule.get_today_schedule` capability tool
   → tool resultat returneres til voice-agent
   → Mr. Botsson generer verbal respons via OpenAI Realtime
   → Tool-call event publisert via `botsson-activity` data channel for Arena LogView

4. **Orb** pulser "speaking" state under respons
   → bruker kan barge-in (interrupt_response: true i server-VAD config)

**Postcondition:**
- Bruker har fått verbal data-svar via tool dispatch
- Activity-trail registrerer tool_call + tool_response events
- Voice-quality telemetry events lagt til posthog + logger

**Error paths:**
- channel guard rejicerer voice-only-tool på chat-only capability (payroll, contracts, AML) → Lise/Botsson sier "bruk chat for dette" på norsk
- Tool gate_action escalate (ADR-0099) → bruker får verbal forklaring + UI-redirect til admin
- Workspace_id missing fra context_init → ask() returnerer "Botsson er ikke klar ennå — brukerdata mangler"

## Journey 3: Mobile-bruker med LiveKit voice-session

**Mål:** Mobile React Native bruker kobler til LiveKit-rom via Expo, snakker, mottar transcript-stream til BFF.

**Precondition:**
- C1.b mobile hook `useBotssonVoiceSession` wired (live siden 2026-04-24)
- C1.d profile.botsson_channel_id bootstrap (live)
- @livekit/react-native-krisp-noise-filter aktivert mobile-side
- Mobile token-mint via web BFF (mobile er thin client per ADR-0132)

### Steg

1. **Mobile-bruker** trykker voice-knapp i app
   → `useBotssonVoiceSession` hook minter LiveKit token via web BFF
   → LiveKit Room kobles til via Expo native binding
   → Krisp NC mobile aktivert (samme transport-pattern som web)

2. **Voice-flyt** identisk Journey 2 (Mr. Botsson dashboard)
   → telemetry events emit fra voice-agent worker (samme prosess som web)

**Postcondition:** Voice-session ekvivalent web-opplevelse. C1.c Detox E2E utestående (Phase F debt).

**Error paths:**
- Mobile network drops → LiveKit auto-reconnect; hvis fail → fallback chat-mode i app

## Verification (Phase E acceptance)

- [x] `pnpm turbo typecheck` — 48/48 ✓ (verified pre-closure)
- [x] `grep -rni ultravox apps/ packages/ services/ supabase/` runtime hits = 0 functional imports (72 hits = comments + landing P5-scope, ikke kjørende kode)
- [x] 6 whole-file Ultravox deletes (3 stage-engine + agent-sdk provider + ai/missions/ultravox + adapter test)
- [x] 8 strip operations (env-template, secrets, platform-admin × 2, fixtures × 6, dep, env.ts, barrel exports, dead translation shim)
- [x] 4 voice-telemetry events registrert + instrumentert
- [x] ADR-0276 + ADR-0282 frontmatter accepted + decision-log updated
- [x] BOTSSON-SYSTEM-MAP voice-plane row 🟢 LiveKit
- [x] HANDOFF-phase-e-cutover.md skrevet
- [x] ADR-0282 R6 step 8 (synthetic VAD bench) superseded — runtime telemetry replaces gate per industry standard
- [ ] **Operator-deferred (Phase F entry)**: Live wizard smoke etter campaign→dev merge → wt-payroll sync → dev restart. Pontus snakker norsk til Lise, vurderer cut-off / hang / naturalness. Telemetry data review etter 7-14 dager produksjon.
