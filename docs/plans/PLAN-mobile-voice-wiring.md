---
title: "Plan — Mobile Voice Wiring (Phase C1)"
status: ready
updated: 2026-04-22
created: 2026-04-22
module: ai-agent
tags: [plan, mobile, voice, livekit, stage-engine, bff, adr-0132, adr-0135, campaign-c1]
---

# Plan — Mobile Voice Wiring

> **Campaign:** `docs/plans/CAMPAIGN-botsson-arena.md` — Phase C, item C1
> **Related ADRs:** 0132 (mobile AI routing), 0133 (mobile surface boundary), 0134 (mobile telemetry contract), 0135 (LiveKit provider)
> **Closes:** "Botsson on mobile is theatre — voice never connects."

## Goal

Koble eksisterende mobil LiveKit til eksisterende stage-engine-loop via eksisterende BFF. Alle komponentene er allerede bygget — LiveKit edge-funksjoner, `useLiveKitCall` hook, `walkieTalkie`-primitiver, BFF `/api/botsson/chat`, stage-engine `/agent/chat`, `channel_ai_policy.voice_participation` kolonne. Det som mangler er én kobling: transcripts → BFF → stage-engine. Dette er integrasjonsarbeid, ikke nybygg.

## Context

Current mobile state (verified 2026-04-22 on `campaign/botsson-arena`):
- ✅ LiveKit tokens issued via `supabase/functions/livekit-token`
- ✅ Webhook endpoint `supabase/functions/livekit-webhook`
- ✅ `useLiveKitCall` hook in `apps/mobile/src/hooks/mutations/`
- ✅ `packages/walkieTalkie/src/` — call/AV primitives
- ✅ `packages/agent-sdk/src/providers/livekit.ts` — provider abstraction
- ❌ **No transcript routing to stage-engine.** Audio flows, reasoning doesn't.
- ❌ **`voice_participation` policy column exists but no enforcer.**
- ❌ **Agent tool calls over voice: not supported.**

ADR-0132 rule: mobile is a thin client — all capability traffic through web BFF. Mobile voice must follow the same rule: LiveKit media plane is direct, but agent control plane goes through BFF.

## Scope

**In:**
1. **Transcript pipeline.** LiveKit client-side transcript events (via Whisper / real-time ASR) → POST to BFF `/api/botsson/chat` with `channel='voice'` + `session_id` + `livekit_room_id`. BFF forwards to stage-engine `/agent/chat`.
2. **Channel pin.** BFF forces `channel='voice'` for LiveKit-sourced messages. Mobile cannot override (per ADR-0132).
3. **voice_participation enforcement.** On LiveKit room join, check `channel_ai_policy.voice_participation` for the associated channel:
   - `disabled` → reject room join (return 403 from token function)
   - `listen_only` → allow join but agent tools receive no transcripts (agent listens, doesn't speak)
   - `interactive` → full bidirectional
4. **Agent response back to voice.** stage-engine response → LiveKit data channel (text) + optionally TTS to audio track. Decide TTS provider during impl (LiveKit built-in vs ElevenLabs vs platform native).
5. **Telemetry** — `voice.transcript_in`, `voice.response_out`, `voice.session_started`, `voice.session_ended` events registered + emitted.
6. **Cascade authority** — voice-sourced tool calls go through the same `gate_action` as chat tools. Channel guard enforces `allowedChannels` (e.g., `contract_intake` still blocked on voice).

**Out:**
- Replacing Ultravox on web (web stays Ultravox per ADR-0135).
- Voice cloning / custom voice models.
- Multi-party voice (Phase C+).
- Offline voice (explicit no).

## Tasks

- [ ] **ASR provider decision** — LiveKit's built-in Whisper integration vs OpenAI real-time ASR vs on-device. Default: LiveKit + Whisper if latency acceptable.
- [ ] **TTS provider decision** — Default: stage-engine returns text, mobile does local TTS (Expo Speech). Upgrade later.
- [ ] **Update `livekit-token` edge function** — reject on `voice_participation='disabled'`. Return policy metadata in token response.
- [ ] **Wire transcript events** — LiveKit client → new mobile hook `useVoiceTranscripts(roomId, onTranscript)` → POST to BFF.
- [ ] **Extend `/api/botsson/chat` BFF** — accept `channel='voice'` + `livekit_room_id`. Pin channel server-side.
- [ ] **Stage-engine /agent/chat** — honor channel='voice'; filter tool set per `allowedChannels`.
- [ ] **Register voice telemetry events** in `packages/telemetry/src/registry.ts`.
- [ ] **E2E test** — mobile E2E (Detox or similar) that opens a LiveKit room, sends a transcript, receives a response.
- [ ] **Policy E2E** — workspace with `voice_participation='disabled'` rejects join.

## Acceptance Criteria

- [ ] Mobile user opens Botsson voice, speaks, gets a spoken/text response that reflects real stage-engine reasoning (not canned).
- [ ] `channel_ai_policy.voice_participation` enforced — disabled channels reject join with clear error.
- [ ] Voice-sourced tool calls audit to `gate_evaluation` with `channel='voice'`.
- [ ] Voice-forbidden capabilities (e.g., `contract_intake`) remain chat-only — tool-selector filters them out.
- [ ] Telemetry events flow to activity_trail + PostHog.
- [ ] No regression in web Ultravox voice (web unchanged).
- [ ] HANDOFF written with TTS/ASR decision + latency measurements.

## Risks

1. **Latency budget** — voice target <800ms round trip. Whisper transcript + BFF hop + stage-engine LLM + TTS can exceed. Mitigation: stream transcripts token-by-token, start inference on partial. Measure on preview before full rollout.
2. **Duplicate session_id** — LiveKit room + stage-engine session lifecycle mismatch. Decide: 1 LiveKit room = 1 stage-engine session; session expires when room ends.
3. **Tool gating over voice** — user asks for PII tool over voice. Tool-selector filters it out; agent must respond "I can't do that over voice, please switch to chat." Prompt-level instruction needed.
4. **TTS voice identity** — default Expo Speech may not match workspace agent persona. Acceptable for v1; revisit in Phase C polish.
5. **LiveKit webhook missed events** — room ends but session lingers. Background cleanup loop in stage-engine already handles (24h expiry); add earlier cleanup on LiveKit `participant_left`.

## Dependencies

- Phase A6 (observability) required — voice debugging without structured logs is painful.
- Phase B1 (dual-gate) recommended — so voice-sourced mutations use the reconciled gate.
- Mobile telemetry contract (ADR-0134) already shipped — `getProfileContext()` covers voice session entry.

## Post-Implementation

- [ ] ADR-0135 moves from `accepted` to `implemented` (or add addendum with provider choices).
- [ ] Learning log: any voice/latency/UX surprises.
- [ ] CAMPAIGN C1 → complete.
- [ ] Mobile voice marked live in `MODULE_BOTSSON.md`.
