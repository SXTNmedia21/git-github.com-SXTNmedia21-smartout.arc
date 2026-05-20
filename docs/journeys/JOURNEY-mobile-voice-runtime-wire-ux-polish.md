---
title: "Journey — Production UX polish for mobile AI surface"
feature: mobile-voice-runtime-wire
status: verified-with-deferred-gaps
updated: 2026-05-20
created: 2026-05-20
verified_by: P7 steward gate
verification_notes: |
  Sub-journey 1 (mic-denied) verified: MicPermissionDialog renders + telemetry
  emits.
  Sub-journey 2 (network failure) verified: NetworkRetryBanner + 3-retry
  backoff + disconnect_recovered/disconnect_failed telemetry wired.
  Sub-journey 3 (voice policy flip) PARTIAL: start-path detection verified
  (policyFlipped → text fallback + mobile.voice.policy_flipped emit). Mid-session
  detection NOT IN SCOPE — `use-voice-transcripts.ts:252-269` handles 403 by
  clearing session + surfacing error, but provider does not subscribe to that
  error to flip mode. DEFERRED to follow-up sortie (P6 commit dd62300e2 notes
  "outside allow-list"). Degraded mode: 403 surfaces as error in transcript
  pane (non-blocking).
  Sub-journey 4 (Orb states) verified: 4-state STOPS Record + StatusLabel
  entries, useReducedMotion gating present.
  Sub-journey 5 (settings) verified: canonical store `use-botsson-settings-store.ts`.
  Multi-banner priority: render order set (mic → network → policy → chat-error)
  but no priority logic for concurrent banners. Acceptable for V1 (states are
  mutually-improbable); tracked as polish backlog.
  ADR-0366 compliance: zero new OKLCH/hex/rgba literals in P6 banners; pre-existing
  Orb rgba documented via header (React Native limitation).
deferred:
  - mid-session BFF 403 → policy_flipped propagation via use-voice-transcripts onError
  - multi-banner priority logic when 2+ states concurrent
module: mobile
tags: [journey, ux, mobile, polish, adr-0366]
---

# Journey — Production UX polish for mobile AI surface

## Context

After P3-P5, runtime works end-to-end. P6 brings UX to production standard: error states are graceful, Orb states reflect voice lifecycle, settings finalised, animations a11y-gated. No new features — only finishing touches.

## Journey: User encounters edge case during AI session, recovers gracefully

**Precondition:**
- Voice + text + RPC all functional (P3-P5 shipped)

### Sub-journey 1: Mic permission denied

1. User long-presses FAB → BotssonSheet opens in voice mode
2. iOS/Android prompts for mic permission → user denies
3. **NEW (P6)**: Mobile detects denial → shows inline dialog "Mikrofon trengs for stemme-AI. Du kan slå på i innstillingene, eller fortsette med skriftlig chat."
4. Dialog actions: "Åpne innstillinger" (deep-link to OS settings) OR "Skriv i stedet" (switches to text mode)
5. User taps "Skriv i stedet" → BotssonSheet switches mode = 'text', text input visible
6. Telemetry: `mobile.voice.mic_permission_denied`

### Sub-journey 2: Network failure mid-voice-session

1. User in active voice session
2. Network drops mid-utterance
3. **NEW (P6)**: Mobile detects LiveKit disconnect → Orb state → 'error'; TranscriptPane shows banner "Nettverket falt ut. Prøver igjen..."
4. Mobile retries 3× with exponential backoff
5. If reconnect succeeds: banner clears, Orb returns to listening, session resumes with same snapshot
6. If 3 retries fail: banner becomes "Kunne ikke koble til. Bytt til skriftlig?" with action button
7. Telemetry: `mobile.voice.disconnect_recovered` OR `mobile.voice.disconnect_failed`

### Sub-journey 3: Voice policy flips mid-session

1. Admin disables voice in workspace settings while user has active session
2. BFF next transcript turn returns 403 with reason `voice_policy_disabled`
3. **NEW (P6)**: Mobile detects 403 → Orb state → 'error'; TranscriptPane shows "Stemme er deaktivert i denne workspace. Bytter til chat."
4. Auto-switch mode = 'text'; voice session torn down cleanly
5. User can continue typing
6. Telemetry: `mobile.voice.policy_flipped`

### Sub-journey 4: Orb state precision

1. User speaks → Orb pulses brightly (listening)
2. User stops → Orb steady-bright (thinking)
3. TTS speaks → Orb pulses on response audio amplitude (speaking)
4. Silence again → Orb dim (idle)
5. **NEW (P6)**: All four states distinguishable visually; `useReducedMotion` gating present on pulse animations; transitions spring-physics smooth

### Sub-journey 5: Settings finalisation

1. User opens Chat tab → Settings → "Botsson AI" section visible
2. Three controls work: Voice on/off toggle, Input mode (Push-to-talk / Alltid på), Language (Norsk / English)
3. **NEW (P6)**: Single canonical store path — no remnants of `ai-prefs.ts` write functions left over
4. Changes persist across app restart
5. Telemetry: `mobile.ai_prefs.changed` per change

## Acceptance

- [ ] Mic-denied dialog appears + offers text-mode fallback
- [ ] Network failure: 3 retries + graceful fallback banner
- [ ] Voice policy flip: auto-switch to text + user notification
- [ ] Orb visually distinguishes 4 states (idle, listening, thinking, speaking) + error
- [ ] All animations gated by `useReducedMotion` per ADR-0366 / Nordic Split
- [ ] Settings persist; canonical store is `use-botsson-settings-store.ts`
- [ ] Zero hardcoded hex/rgb/rgba/oklch literals in any P6-touched file
- [ ] All new strings either via `t()` i18n OR tagged with TODO + Norwegian fallback

## References

- ADR-0366 — OKLCH literal ban
- ADR-0078 — voice policy enforcement
- Nordic Split design system + a11y rules
- L-0177 — fail-fast on null IDs (telemetry)
- Predecessor M2 — useReducedMotion gating pattern from `TranscriptPane.tsx:37`
