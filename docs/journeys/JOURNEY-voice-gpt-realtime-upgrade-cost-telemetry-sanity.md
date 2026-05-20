---
title: "Journey — Cost telemetry sanity (4 voice-quality events emit cleanly)"
feature: voice-gpt-realtime-upgrade
journey: cost-telemetry-sanity
status: draft
verified_at: null
e2e_test: null
created: 2026-05-19
updated: 2026-05-19
module: ai
tags: [journey, voice, telemetry, posthog, registry]
---

# Journey: Cost telemetry sanity

**Role:** developer (sortie operator) + ops (post-canary)

**Precondition:**
- Code changes T1.1–T1.3 merged
- Telemetry registry at `packages/telemetry/src/registry.ts` recognized 4 voice-quality events per ADR-0282 R6 amendment 2026-05-10 (lines 423–449 of `services/voice-agent/src/agent.ts`)
- No hardcoded pricing constants in tests (verify via grep T1.4)

## Happy Path

1. Operator joins LiveKit voice session with `model: "gpt-realtime"` → Agent emits `voice_session_started` with model field populated → Telemetry destination chain (PostHog + logger + activity_trail + engine_event) all accept payload
2. Operator speaks 5 turns → 4 audio voice-quality events fire across session (first_speech, turn_complete × N, session_end) → PostHog dashboard shows events with `model:"gpt-realtime"` tag
3. Operator inspects `engine_event` rows in Supabase Local → All 4 event types present, no Zod parse errors in stage-engine logs

**Postcondition:**
- All 4 voice-quality events emit per session
- No `[telemetry] zod-parse-failed` errors in stage-engine stdout or stderr
- PostHog event payloads contain new model string for downstream cost dashboards
- `status: verified` set

## Error Paths

- **Scenario:** Zod parse error on emit → registry schema requires update (likely model enum); add `gpt-realtime` to allowed values, redeploy
- **Scenario:** PostHog rejects event (e.g. invalid property type) → trace via destination chain in `packages/telemetry/src/registry.ts`, fix property type
- **Scenario:** `engine_event` row missing workspace_id → L-0177 fail-fast; voice session context not resolved at emit time (regression). Block merge.
- **Scenario:** Cost dashboard query joins on old `gpt-4o-realtime-preview` model string → file follow-up to update Looker/Grafana query post-canary (NOT a blocker for this sortie)

## Verification

- [ ] Implementation matches the steps above
- [ ] 4 voice-quality events emit cleanly across 1 live session
- [ ] Manually inspected — `engine_event` rows + PostHog events both contain new model string, no Zod failures in logs

**Mark `status: verified` in frontmatter when all three boxes are checked.**
