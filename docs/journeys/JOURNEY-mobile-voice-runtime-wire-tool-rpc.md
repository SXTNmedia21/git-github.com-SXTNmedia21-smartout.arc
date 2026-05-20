---
title: "Journey — Mobile registers + serves voice-agent tool RPC"
feature: mobile-voice-runtime-wire
status: draft
updated: 2026-05-20
created: 2026-05-20
module: mobile
tags: [journey, voice, livekit, mobile, rpc, l-0234]
---

# Journey — Mobile registers + serves voice-agent tool RPC

## Context

Voice-agent `client-tool-rpc.ts` implements full RPC protocol (`botsson-tool-call` publish + `botsson-tool-result` await, 10s timeout). Mobile declares 5 tools in `apps/mobile/src/lib/botsson-tools.ts` (`mobile_navigate_to`, `mobile_open_sheet`, `mobile_show_toast`, `mobile_start_punch`, `mobile_call_leader`) and `executeMobileTool()` dispatches them — but mobile never registers tools with voice-agent nor listens for call events. L-0234 view-tools mirror dead-wired on mobile.

## Journey: User says "åpne vaktlisten" → mobile navigates

**Precondition:**
- Voice session active per JOURNEY-mobile-voice-runtime-wire-context-publish
- User on Dashboard / Kalender tab
- Workforce snapshot already published

**Steps:**

1. **NEW (P4)**: Immediately after `botsson-context` publish, mobile publishes `botsson-tools-register` with 5 tool schemas → voice-agent `client-tool-rpc.ts:buildToolStubs()` creates llm.tool() entries; `agent.updateTools(next)` applied
2. **NEW (P4)**: Mobile subscribes to data-channel topic `botsson-tool-call` via `RoomEvent.DataReceived`
3. User speaks: "Åpne vaktlisten"
4. ASR + stage-engine intent classifier → routes to `mobile_navigate_to` tool with arg `{ route: '/schedule' }`
5. Voice-agent invokes tool stub → publishes `botsson-tool-call` with `{ call_id: uuid, tool: 'mobile_navigate_to', args: { route: '/schedule' } }`
6. **NEW (P4)**: Mobile receives event → matches call_id, dispatches via `executeMobileTool()` → mobile router navigates to `/schedule`
7. **NEW (P4)**: Mobile publishes `botsson-tool-result` with `{ call_id, ok: true, result: { navigated_to: '/schedule' } }`
8. Voice-agent Promise resolves before 10s timeout → response returned to stage-engine
9. Realtime LLM speaks confirmation "Vaktlisten er åpen" → User hears confirmation + sees Schedule screen

**Postcondition:**
- Mobile UI matches voice intent
- Telemetry `voice.bootstrap.rpc_completed` emitted with call_id + latency_ms
- Voice-agent ready for next tool call in same session

**Error paths:**

- Tool registration publish fails → voice-agent falls back to server-side tool set only; telemetry `voice.bootstrap.tool_register_failed`
- RPC timeout 10s (e.g. app backgrounded mid-call) → voice-agent Promise rejects; Realtime LLM apologizes "kunne ikke gjennomføre handlingen"; telemetry `voice.rpc_timeout`
- Mobile receives unknown tool name → mobile publishes `{ call_id, ok: false, error: 'unknown_tool' }`; voice-agent surfaces to LLM; LLM responds with fallback
- Call_id mismatch (stale event from prior session) → mobile drops silently; voice-agent times out per normal path
- HARNESS_ADAPTER_VOICE_ENABLED flag OFF → voice-agent uses `buildAllBotssonTools()` (server tools only), mobile RPC tools unreachable until flag flipped or capability-tagging sortie ships

## Acceptance

- [ ] `botsson-tools-register` published within 100ms of `botsson-context` publish
- [ ] Voice command "åpne vaktlisten" navigates mobile to `/schedule` within 2s
- [ ] All 5 declared mobile tools round-trip successfully via voice command (smoke test)
- [ ] Call_id correlation 1:1 (no dropped or mismatched results)
- [ ] `voice.bootstrap.rpc_completed` latency < 1500ms per round-trip
- [ ] HARNESS_ADAPTER_VOICE_ENABLED state documented in handoff

## References

- L-0234 — voice view-tools mirror via activity-event
- `services/voice-agent/src/client-tool-rpc.ts` (protocol)
- `apps/mobile/src/lib/botsson-tools.ts` (5 tools, executeMobileTool)
- ADR-0078 — channel + PII; mobile RPC tools respect voice channel constraints
- ADR-0327 — Phase 4 voice-tool-resolver feature flag
