---
title: "Journey — Norwegian prosody listening test at speed:1.35"
feature: voice-gpt-realtime-upgrade
journey: norwegian-prosody
status: draft
verified_at: null
e2e_test: null
created: 2026-05-19
updated: 2026-05-19
module: ai
tags: [journey, voice, norwegian, prosody, manual-test]
---

# Journey: Norwegian prosody listening test at speed:1.35

**Role:** Pontus (sortie operator + native Norwegian listener)

**Precondition:**
- Code changes T1.1 + T1.2 + T1.3 merged on `feat/voice-gpt-realtime-upgrade`
- `services/voice-agent` runs on dev workspace with `model: "gpt-realtime"` + `speed: 1.35`
- 3 missions defined: (a) admin onboarding intro, (b) employee daily check-in, (c) onboarding wizard chapter 1

## Happy Path

1. Operator runs mission (a) admin onboarding via dev workspace → Agent speaks Norwegian system-prompted greeting → Operator scores prosody on 5-point scale (1 = robotic, 5 = native-natural)
2. Operator runs mission (b) employee daily check-in → Agent prompts shift status with same speed config → Operator scores
3. Operator runs mission (c) onboarding wizard chapter 1 voice walkthrough → Agent narrates Norwegian instructions across 5+ turns → Operator scores

**Postcondition:**
- All 3 missions score ≥ 3 (acceptable) on prosody scale
- Recurrence of L-0233 "prater litt sakt" feedback NOT triggered
- Score table recorded in this journey + linked from HANDOFF
- `status: verified` set

## Error Paths

- **Scenario:** any mission scores ≤ 2 → tune `speed` down to 1.2 OR rollback to plugin default, re-test
- **Scenario:** "prater litt sakt" returns → adjust `speed` up by 0.05 increments (max 1.5 per L-0233); if no working value, file follow-up Linear ticket + flag in journey 1 delta
- **Scenario:** false-end-of-turn observed (agent cuts user off) → tune `silence_duration_ms` up from 250ms in 50ms steps
- **Scenario:** Norwegian word stress wrong on technical terms (e.g. "vaktplanlegging") → document in HANDOFF, escalate as known limitation pending `gpt-realtime-2` eval

## Verification

- [ ] Implementation matches the steps above
- [ ] Score table recorded for all 3 missions
- [ ] Manually confirmed: no "prater sakt" feedback, no false-end-of-turn

**Mark `status: verified` in frontmatter when all three boxes are checked.**
