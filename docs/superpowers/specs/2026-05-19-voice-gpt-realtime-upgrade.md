---
title: "Voice agent upgrade — gpt-4o-realtime-preview → gpt-realtime GA"
status: draft
created: 2026-05-19
updated: 2026-05-19
module: ai
tags: [spec, voice, livekit, openai, realtime, model-upgrade]
---

# Voice agent upgrade — gpt-4o-realtime-preview → gpt-realtime GA

## Why

`gpt-4o-realtime-preview` family deprecated 2026-04-30 (19 days past). Requests >200k tokens already return errors; full removal imminent. Plugin default in `@livekit/agents-plugin-openai ^1.3.0` ambiguous between old preview and new GA — current `agent.ts:400` relies on plugin default, no explicit pin.

`gpt-realtime` GA brings:
- −20% audio cost ($32/$64 vs $40/$80 per 1M tokens)
- +48% instruction following
- +34% tool-call accuracy
- async function calls (long-running tools no longer freeze convo — direct fix to perceived latency on `query_smartout` + cascade reads)
- image input (unlocks ADR-0136 mobile camera evidence path)
- native MCP server support

## Scope

1. Pin `@livekit/agents-plugin-openai` `^1.3.0` → `^1.4.3` in `services/voice-agent/package.json`.
2. Set explicit `model: "gpt-realtime"` in `services/voice-agent/src/agent.ts:400`.
3. Update `services/voice-agent/scripts/vad-bench/recorder.ts:1` hardcoded `gpt-4o-realtime-preview` → `gpt-realtime`.
4. Pre-verify: grep stage-engine + livekit container logs for `model=` on `/v1/realtime` WS handshake to confirm current production model.
5. Scaffold `image_input` flag — Zod schema in `packages/ai/src/schemas/` accepts optional `image[]` payload; channel-pin (ADR-0078) enforces audio+text default, image opt-in per session. NO UI wiring (reserved for ADR-0136).
6. Draft ADR — grep next free slot per L-0287, reference deprecation cliff + 4 measured improvements.
7. Run `vad-bench` Norwegian baseline pre-upgrade + post-upgrade; record p50/p95 deltas.

## Out of scope

- Mobile camera UI (ADR-0136 separate sortie)
- `gpt-realtime-2` (GPT-5-class reasoning successor) — defer until 2-week observation period on `gpt-realtime` GA
- MCP server hosting via Realtime (could replace bridge code later — separate ADR)
- Voice/speed re-tuning (`speed:1.35` + `silence_duration_ms:250`) — only revisit if vad-bench Norwegian regresses >10%

## Risk

- New model prosody envelope ≠ old. `speed:1.35` tuned on preview (L-0233 + 2026-05-13 "prater litt sakt" fix). Mitigate: manual Norwegian listening test across 3 missions before merge.
- No bench gate (E9 removed per ADR-0282 R6). Runtime-only telemetry — regressions visible only post-rollout. Mitigate: canary on dev workspace 24h before promote.
- Cost telemetry pricing constants — verify no test hardcodes old $40/$80 values.
- Plugin `^1.4.3` may bring breaking changes since 1.3.0 — check `livekit/agents-js` release notes for RealtimeModel signature changes.

## Acceptance

See `docs/plans/PLAN-voice-gpt-realtime-upgrade.md` journeys 1–5.
