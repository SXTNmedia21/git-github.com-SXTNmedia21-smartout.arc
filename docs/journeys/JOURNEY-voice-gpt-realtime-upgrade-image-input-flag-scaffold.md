---
title: "Journey — Image-input flag scaffold (Zod schema + channel-pin, no UI)"
feature: voice-gpt-realtime-upgrade
journey: image-input-flag-scaffold
status: draft
verified_at: null
e2e_test: null
created: 2026-05-19
updated: 2026-05-19
module: ai
tags: [journey, voice, image-input, channel-pin, adr-0078, adr-0136-prep]
---

# Journey: Image-input flag scaffold

**Role:** developer (sortie operator)

**Precondition:**
- Code changes T1.1 + T1.2 + T1.3 merged
- ADR-0078 channel-pin mechanism live in BFF + stage-engine
- ADR-0136 mobile camera evidence ADR readable as North Star (not implemented this sortie)

## Happy Path

1. Developer extends Zod schema `VoiceSessionConfig` in `packages/ai/src/schemas/voice-session.ts` → Adds optional `image_input?: { enabled: boolean; max_images_per_turn?: number }` field → Schema validates with image_input absent (backwards compat)
2. Developer extends `pinChannel()` to enforce `audio+text` default + allow `image` opt-in only when `image_input.enabled === true` → Adds 2 happy-path tests (enabled→accepts image, disabled→rejects) + 2 rejection tests (missing flag→rejects, malformed payload→rejects)
3. Developer wires scaffold through stage-engine session bootstrap → Reads flag from authority config → Propagates to BFF response → BFF threads to voice-agent session config

**Postcondition:**
- Schema accepts optional image_input field, defaults to `{ enabled: false }` when absent
- pinChannel rejects image payload when flag disabled, accepts when enabled
- 4 tests green in `packages/ai/__tests__/` (or equivalent location)
- NO UI surface mounted (verified via grep — no `image_input` references in `apps/web/` or `apps/mobile/`)
- `status: verified` set

## Error Paths

- **Scenario:** ADR-0078 pinChannel signature breaks downstream consumers → audit call-sites in `services/stage-engine/`, update each with default `{ image_input: { enabled: false } }`
- **Scenario:** Authority config schema lacks `image_input` field → extend `engine_authority_config` Zod schema; document in ADR
- **Scenario:** Voice-agent crashes when image payload arrives despite flag disabled → channel-pin enforcement faulty; fix + add regression test
- **Scenario:** Scope creep toward UI surface → STOP. Image UI = separate sortie under ADR-0136. Reject any commit that adds React component referencing `image_input`.

## Verification

- [ ] Implementation matches the steps above
- [ ] 4 channel-pin tests green (2 happy + 2 rejection)
- [ ] Manually verified: grep `apps/web/ apps/mobile/` for `image_input` returns ZERO React component references; only stage-engine / BFF / voice-agent / packages/ai matches

**Mark `status: verified` in frontmatter when all three boxes are checked.**
