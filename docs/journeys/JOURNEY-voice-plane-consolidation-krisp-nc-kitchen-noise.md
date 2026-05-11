---
title: "Journey — Krisp NC Reduces Kitchen Noise Client-Side, Voice-Agent NC-Off"
feature: voice-plane-consolidation
journey: krisp-nc-kitchen-noise
status: deferred
verified_at: null
deferred_reason: "BotssonSticky NC pill (clean/elevated/off states) not implemented — BotssonOrbVoiceMount wires Krisp processor correctly but the visual pill surface is absent from BotssonSticky.tsx"
e2e_test: "deferred — see Phase F sortie 4"
created: 2026-05-04
updated: 2026-05-10
module: MODULE_BOTSSON
tags: [journey, voice, krisp, noise-cancellation, hospitality]
---

# Journey: Krisp NC Reduces Kitchen Noise Client-Side, Voice-Agent NC-Off

**Role:** restaurant manager / kitchen staff (high-noise hospitality environment)

**Precondition:**
- `@livekit/krisp-noise-filter` installed on web (`apps/web/package.json:24`, version 0.3.4)
- `@livekit/react-native-krisp-noise-filter` installed on mobile (`apps/mobile/package.json:22`, version 0.0.3)
- Phase E E7 wiring landed: client-side Krisp processor active on local participant
- `services/voice-agent/` does NOT enable any NC plugin (verified by lint/grep — no `krisp` or `noise.*filter` import in `services/voice-agent/src/`)

## Happy Path

1. Restaurant manager opens Botsson voice on web during lunch service (kitchen ambient ~80 dB SPL)
2. LiveKit Room connects → local participant track wraps in Krisp processor: `room.localParticipant.setMicrophoneEnabled(true, { processor: KrispNoiseFilter() })`
3. Manager speaks: "vis dagens omsetning"
4. Krisp processes audio locally on-device → background kitchen clatter, voices, and equipment noise filtered out → only manager's voice transmitted
5. Voice-agent receives clean audio (NO double-processing) → ASR → tool dispatch → response
6. **Visual signal**: BotssonSticky displays NC pill in `clean` state (subtle Mic + animated equalizer in `text-muted-foreground`)
7. If kitchen gets louder: BotssonSticky pill upgrades to `elevated` state (amber `var(--color-warning)` MicOff + tooltip "Vi renser bakgrunnsstøy")
8. If Krisp fails to load: pill hidden (`off` state), voice continues with WebRTC built-in echoCancellation only (graceful degradation)

**Postcondition:**
- ≥15 dB SNR improvement on hospitality-noise A/B sample (E7 acceptance criterion)
- Voice-agent recording trace: NO Krisp / noise-filter imports server-side
- BotssonSticky NoiseLevel pill renders correctly across all 3 states
- LiveKit local-participant audio stats show `noiseLevel` metric usable for pill-state derivation

## Error Paths

- **Scenario: Krisp double-processing detected** (NC enabled both client and voice-agent) → audio artifacts, robotic voice → council escalation per Phase E E7 risk
- **Scenario: Krisp licensing fails on self-hosted** → fallback to WebRTC built-in echoCancellation only; pill shows `off` state
- **Scenario: Mobile Krisp processor incompatible with iOS background audio** → council escalation, may require disabling on mobile
- **Scenario: NoiseLevel metric unavailable from LiveKit stats** → pill defaults to `clean` state; no false `elevated` warnings

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists at `apps/e2e/tests/journey-krisp-nc-kitchen-noise.spec.ts` and passes
- [ ] Noise floor measurement: ≥15 dB SNR improvement on hospitality-noise A/B sample
- [ ] Lint/grep verification: zero `krisp` or `noise.*filter` import in `services/voice-agent/src/` (codified as AC #11 per ADR-0275)
- [ ] BotssonSticky pill manual test: clean / elevated / off states render correctly with Nordic Split tokens

**Mark `status: verified` in frontmatter when all five boxes are checked.**
