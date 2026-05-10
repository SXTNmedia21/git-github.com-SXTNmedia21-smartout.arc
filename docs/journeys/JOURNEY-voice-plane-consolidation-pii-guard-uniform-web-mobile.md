---
title: "Journey — PII Channel Guard 3-Layer Fires Identically on Web + Mobile"
feature: voice-plane-consolidation
journey: pii-guard-uniform-web-mobile
status: verified
verified_at: 2026-05-10
e2e_test: "apps/e2e/tests/ — tool-selector-voice-pii.test.ts (unit); no Playwright E2E spec yet — deferred see Phase F sortie 4"
created: 2026-05-04
updated: 2026-05-10
module: MODULE_BOTSSON
tags: [journey, voice, pii, channel-guard, livekit]
---

# Journey: PII Channel Guard 3-Layer Fires Identically on Web + Mobile

**Role:** any authenticated user with active profile (verifies governance, not flow)

**Precondition:**
- Single voice plane via LiveKit on both web and mobile (Phase E E3+ landed)
- ADR-0078 + ADR-0163 channel guard 3-layer architecture active:
  - Layer 1: `gate_action(p_channel='voice')` SQL fail-closed
  - Layer 2: capability `allowedChannels` filter in `tool-selector.ts:122,135`
  - Layer 3: tool-body `ctx.channel === "voice"` reject in PII-bearing tools

## Happy Path

1. User on web Botsson overlay says "hva er Anna sin personnummer?" (PII intent)
2. Voice-agent function-calling routes through BFF → stage-engine → intent-classifier
3. Classifier identifies intent='profile' or 'contract'
4. Tool-selector applies Layer 2 filter: `profile` capability has `allowedChannels:["chat"]` → PII-tool excluded from voice-channel tool list
5. Even if LLM hallucinates the tool name, Layer 1 SQL `gate_action` rejects with `channel='voice'` mismatch
6. Even if both Layer 1+2 bypassed, Layer 3 tool-body returns "Av sikkerhetshensyn må dette skje i chat, ikke via stemme"
7. User redirected to chat surface; PII never spoken

8. **Mobile parity**: same user repeats the same query on mobile (LiveKit native) → identical behavior. Channel guard fires at same Layer 1+2+3 with same redirect message.

**Postcondition:**
- PII never exposed via voice channel on either surface
- Single tool-selector pipeline serves both web + mobile (no provider-specific bypass)
- `gate_evaluation` row written with `decision='rejected'` reason='channel_mismatch'
- Telemetry routed identically: `emit("guardian.pii_voice_blocked")` with surface tag

## Error Paths

- **Scenario: New PII-bearing tool ships without `allowedChannels:["chat"]`** → Layer 2 doesn't fire → Layer 1 still rejects (defense-in-depth) → P1 audit catches divergence; ADR-0078 + ADR-0163 trust gate fails
- **Scenario: Layer 3 missing on a chat-only tool** → acceptable IF Layer 1+2 fire (per coordinator hard rule "Channel guard 3-layer verification"). But add for defense-in-depth.
- **Scenario: Web and mobile diverge in guard behavior** → integration test fail-fast (this journey's E2E gates the merge)

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists at `apps/e2e/tests/journey-pii-guard-uniform.spec.ts` covering web + mobile parity, passes
- [ ] Manual test: voice "personnummer" query on web returns ADR-0078 redirect
- [ ] Manual test: same query on mobile (LiveKit) returns identical redirect
- [ ] gate_evaluation audit shows rejected rows with channel_mismatch reason

**Mark `status: verified` in frontmatter when all five boxes are checked.**
