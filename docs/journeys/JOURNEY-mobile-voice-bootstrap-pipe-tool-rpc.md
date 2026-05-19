---
title: "Journey — Mobile registers tools and serves voice-agent RPC"
status: draft
updated: 2026-05-20
created: 2026-05-20
module: mobile
tags: [journey, voice, livekit, mobile, rpc, l-0234]
---

# Journey — Mobile registers tools and serves voice-agent RPC

## Context

Voice-agent (`services/voice-agent/src/client-tool-rpc.ts`) implements the full RPC protocol: publish `botsson-tool-call` with call_id, park Promise, await `botsson-tool-result` with matching call_id (10s timeout). Mobile declares 5 tools in `apps/mobile/src/lib/botsson-tools.ts` (`mobile_navigate_to`, `mobile_open_sheet`, `mobile_show_toast`, `mobile_start_punch`, `mobile_call_leader`) and `executeMobileTool()` dispatches them — but no code registers the tools nor listens for call events. L-0234 view-tools mirror absent on mobile.

## Journey: User asks voice to navigate the app

**Precondition:**
- Voice session active per JOURNEY-mobile-voice-bootstrap-pipe-workforce-snapshot
- User on Dashboard screen
- Workforce snapshot already published

**Steps:**

1. **NEW**: Immediately after `botsson-context` publish, system publishes data-channel message on topic `botsson-tools-register` with array of tool schemas from `botsson-tools.ts` → Voice-agent `client-tool-rpc.ts:buildToolStubs()` creates llm.tool() entries; `agent.updateTools(next)` applied
2. **NEW**: Mobile subscribes to data-channel topic `botsson-tool-call` (RoomEvent.DataReceived filter on topic name)
3. User speaks: "Åpne vaktlisten"
4. ASR + stage-engine intent classifier routes to `mobile_navigate_to` tool with arg `{ route: '/schedule' }`
5. Voice-agent invokes tool stub → publishes `botsson-tool-call` with `{ call_id: uuid, tool: 'mobile_navigate_to', args: { route: '/schedule' } }`
6. **NEW**: Mobile receives event on `botsson-tool-call` topic → matches call_id, dispatches via `executeMobileTool()` → mobile router navigates to `/schedule`
7. **NEW**: Mobile publishes `botsson-tool-result` with `{ call_id, ok: true, result: { navigated_to: '/schedule' } }`
8. Voice-agent Promise resolves before 10s timeout → response returned to stage-engine
9. Realtime LLM speaks confirmation "Vaktlisten er åpen" → User hears confirmation + sees Schedule screen

**Postcondition:**
- Mobile UI matches voice intent
- Telemetry event `voice.bootstrap.rpc_completed` emitted with call_id + latency_ms
- Voice-agent ready for next tool call in same session

**Error paths:**

- Tool registration publish fails → Voice-agent falls back to server-side tool set only (no mobile-specific tools available); telemetry `voice.bootstrap.tool_register_failed` fires
- RPC timeout (10s, e.g. app backgrounded mid-call) → Voice-agent Promise rejects; Realtime LLM apologizes "kunne ikke gjennomføre handlingen"; telemetry `voice.rpc_timeout` fires with tool name
- Mobile receives unknown tool name → Mobile publishes result `{ call_id, ok: false, error: 'unknown_tool' }`; voice-agent surfaces error to LLM; LLM responds with fallback
- Call_id mismatch (mobile receives stale call from prior session) → Mobile drops silently; voice-agent times out per normal path
- Tool executes but mobile crashes before result publish → Voice-agent times out at 10s; no retry on tool side

## Acceptance

- [ ] `botsson-tools-register` published within 100ms of `botsson-context`
- [ ] Voice prompt "åpne vaktlisten" navigates mobile to `/schedule` within 2s of LLM speak start
- [ ] All 5 declared tools in `botsson-tools.ts` round-trip successfully via voice command
- [ ] Call_id correlation 1:1 (no dropped or mismatched results)
- [ ] Telemetry `voice.bootstrap.rpc_completed` fires per round-trip with latency under 1.5s

## References

- L-0234 — voice view-tools mirror via activity-event
- `services/voice-agent/src/client-tool-rpc.ts` (full protocol, lines 1-120)
- `apps/mobile/src/lib/botsson-tools.ts` (5 tools, `executeMobileTool` line 155)
- ADR-0078 — channel pinning; mobile RPC tools must respect voice channel constraints
