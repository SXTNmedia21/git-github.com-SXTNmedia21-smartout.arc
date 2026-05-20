---
title: "Plan — voice-gpt-realtime-upgrade"
feature: voice-gpt-realtime-upgrade
spec: ../superpowers/specs/2026-05-19-voice-gpt-realtime-upgrade.md
status: draft
updated: 2026-05-19
created: 2026-05-19
module: ai
tags: [plan, voice, livekit, openai, realtime]
---

# Plan — voice-gpt-realtime-upgrade

> Branch: `feat/voice-gpt-realtime-upgrade` | Worktree: `~/dev/smartout.ai-wt-4` | Module: ai

**Spec:** [Voice agent upgrade — gpt-4o-realtime-preview → gpt-realtime GA](../superpowers/specs/2026-05-19-voice-gpt-realtime-upgrade.md)

## Journeys (the contract)

- [JOURNEY-voice-gpt-realtime-upgrade-latency-regression](../journeys/JOURNEY-voice-gpt-realtime-upgrade-latency-regression.md) — vad-bench p50/p95 within ±10% of pre-upgrade baseline
- [JOURNEY-voice-gpt-realtime-upgrade-norwegian-prosody](../journeys/JOURNEY-voice-gpt-realtime-upgrade-norwegian-prosody.md) — manual Norwegian listening test at speed:1.35 across 3 missions (admin/employee/onboarding)
- [JOURNEY-voice-gpt-realtime-upgrade-cost-telemetry-sanity](../journeys/JOURNEY-voice-gpt-realtime-upgrade-cost-telemetry-sanity.md) — 4 voice-quality events emit with new model name, no Zod break in telemetry registry
- [JOURNEY-voice-gpt-realtime-upgrade-async-function-call-smoke](../journeys/JOURNEY-voice-gpt-realtime-upgrade-async-function-call-smoke.md) — long query_smartout call (>2s) does not freeze conversation, user can speak mid-call
- [JOURNEY-voice-gpt-realtime-upgrade-image-input-flag-scaffold](../journeys/JOURNEY-voice-gpt-realtime-upgrade-image-input-flag-scaffold.md) — Zod schema accepts optional image[] payload, channel-pin enforces audio+text default, image opt-in per session

## Goal

Cut the deprecation cliff (`gpt-4o-realtime-preview` removed 2026-04-30, 19 days past) and capture the four GA wins: −20% audio cost, +48% instruction-following, +34% tool-call accuracy, async function calls. Scaffold image-input schema for ADR-0136 follow-up.

## Tasks

### Pre-flight verification

- [ ] T0.1 Grep stage-engine container logs for `model=` on `/v1/realtime` WS handshake — confirm which model production currently negotiates (verify whether plugin 1.3.0 default = old preview or already GA)
- [ ] T0.2 Capture `vad-bench` Norwegian baseline (3 runs, p50/p95) BEFORE any code change. Record in `docs/learnings/voice-gpt-realtime-baseline.md`

### Code changes

- [ ] T1.1 `services/voice-agent/package.json` — pin `@livekit/agents-plugin-openai` `^1.3.0` → `^1.4.3`. Verify peer-dep compat with `@livekit/agents` and `@livekit/agents-plugin-silero`. Run `pnpm install --filter @smartout/voice-agent`.
- [ ] T1.2 `services/voice-agent/src/agent.ts:400` — add explicit `model: "gpt-realtime"` to `RealtimeModel` constructor (above `voice:` line). Comment cites spec + deprecation date.
- [ ] T1.3 `services/voice-agent/scripts/vad-bench/recorder.ts:1` — replace `gpt-4o-realtime-preview` with `gpt-realtime` in WS URL.
- [ ] T1.4 Grep repo for any other `gpt-4o-realtime-preview` references — update or document why not.

### Image-input scaffold (no UI wiring)

- [ ] T2.1 `packages/ai/src/schemas/voice-session.ts` (new or extend existing) — Zod schema `VoiceSessionConfig` adds optional `image_input?: { enabled: boolean; max_images_per_turn?: number }` field
- [ ] T2.2 Channel-pin (ADR-0078) — extend `pinChannel()` to enforce `audio+text` default, allow `image` opt-in only when `image_input.enabled === true`. Tests: 2 happy-path + 2 rejection
- [ ] T2.3 Wire scaffold through stage-engine session bootstrap — read flag from authority config, propagate to BFF response. NO UI surface, no orb integration. Reserved for ADR-0136.

### Validation

- [ ] T3.1 `pnpm turbo typecheck` 0 errors
- [ ] T3.2 `pnpm --filter @smartout/voice-agent test` green
- [ ] T3.3 `vad-bench` post-upgrade — 3 runs, compare p50/p95 vs baseline. Document delta in plan + journey 1.
- [ ] T3.4 Norwegian listening test — 3 missions on dev workspace, manual pass/fail per journey 2 verification table
- [ ] T3.5 Canary `services/voice-agent` on dev workspace 24h before promote. Capture posthog `voice_quality_*` events, compare median latency vs baseline.

### Documentation

- [ ] T4.1 Draft ADR — grep next free slot (`ls docs/decisions/0*.md | sort | tail -5`), reference deprecation cliff + 4 measured improvements + image-input scaffold rationale per L-0287
- [ ] T4.2 Register ADR in `docs/decisions/0000-decision-log.md`
- [ ] T4.3 Write `docs/HANDOFF-voice-gpt-realtime-upgrade.md` at closure (decisions + learnings + canary results)

## Acceptance Criteria

- [ ] Every declared journey has `status: verified` in frontmatter
- [ ] Typecheck passes: `pnpm turbo typecheck`
- [ ] Decision log updated for any architectural choices (model swap, image-input flag, plugin pin)
- [ ] At least one E2E test exists per journey (recommended — voice agent tests live in `services/voice-agent/__tests__/`)
- [ ] vad-bench post-upgrade within ±10% of pre-upgrade baseline (journey 1)
- [ ] Norwegian listening test passes on 3 missions (journey 2)
- [ ] Canary 24h with no `voice_quality_error_*` regression (deferred to ops post-merge)
