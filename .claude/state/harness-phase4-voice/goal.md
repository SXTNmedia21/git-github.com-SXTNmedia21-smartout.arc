---
goal_id: harness-phase4-voice
status: pending_user_confirm
created: 2026-05-14
worktree: /home/sxtnl/dev/smartout.ai-wt-1
branch: feat/harness-phase4-voice
base: development
predecessor_adr: ADR-0327
predecessor_sortie: harness-phase35-client-exec (chat dead-pipe closed; voice still on original pre-Phase-1 path)
predecessor_pattern: L-0234 (voice activity-event mirror) — extend, don't reinvent
---

# Goal — harness-phase4-voice

## Outcome (technical, source of truth)

Wire voice consumer to HarnessAdapter per ADR-0327 Phase 4. Voice-agent worker reads tools via `HarnessAdapter.getToolsForChannel("voice", pageRoute, userContext)` at session start (instead of static `buildAllBotssonTools()`). Client-shipped tools from browser reach voice LLM via session context payload. When voice LLM invokes a client-shipped tool, voice-agent publishes RPC over LiveKit data channel; browser-side `LiveKitVoiceSession.registerTool` map (currently stub) resolves the name to an implementation, invokes it, publishes result back; voice-agent forwards result to Realtime LLM continuation.

## Acceptance criteria (binary, testable)

1. `packages/agent-sdk/src/providers/livekit.ts:38-40` `registerTool` stub replaced with real implementation: stores `name → impl` in instance Map. Maintained for session lifetime.
2. Browser-side `LiveKitVoiceSession` publishes registered tool DEFINITIONS to LiveKit data channel at session start (topic="botsson-client-tools", payload includes ClientToolDefinition[]).
3. Voice-agent worker receives this data event in `RoomEvent.DataReceived` handler in `services/voice-agent/src/agent.ts`. Existing pattern at lines 217-236 already handles `context_init` — extend to handle `client_tools_register`.
4. Voice-agent constructs HarnessAdapter (or uses existing chat-tool-resolver if reusable) and calls `getToolsForChannel("voice", pageRoute, userContext)` to get capability bundle. Merges with client-shipped tools (client-tool-wins on name collision — same merge logic as resolver).
5. Voice-agent registers merged tool list on the `voice.Agent` instance via existing LiveKit Agents API (`agent.updateTools(...)` or similar — pick the correct API from @livekit/agents v1.3).
6. PII tools stripped for voice channel — same authority pass as chat. Verify ADR-0078 holds (`revealPersonnummer` and friends NOT in voice tool list even if browser shipped them).
7. When voice LLM invokes a CLIENT-SHIPPED tool (name in browser registry, not in server-side capabilities):
   - Voice-agent intercepts the tool call (do NOT execute server-side stub)
   - Publishes RPC over LiveKit data channel (topic="botsson-client-tool-call", payload: `{ call_id, name, arguments }`)
   - Awaits response on `botsson-client-tool-result` topic
   - Forwards result to LLM continuation
8. Browser side: `LiveKitVoiceSession` listens for `botsson-client-tool-call` topic, looks up implementation in registry, invokes with arguments, publishes result on `botsson-client-tool-result` topic with same `call_id`.
9. Timeout safety: voice-agent caps tool-call wait at 10 seconds. If no response, sends "tool execution timed out" result to LLM.
10. Tests:
    - `LiveKitVoiceSession.registerTool` unit tests: 4+ cases (register, retrieve, multiple tools, deregister)
    - Voice-agent integration test (or unit-test-via-mock): when receiving `client_tools_register` event, registers them on the Agent
    - Browser-side RPC handler test: receives `botsson-client-tool-call`, invokes impl, publishes result
11. Voice-agent typecheck + tests pass: `pnpm --filter @smartout/voice-agent typecheck && test`
12. Repo-wide `pnpm turbo typecheck` passes
13. JOURNEY-harness-phase4-voice.md has `verified: true`
14. HANDOFF written

## Out of scope (explicitly deferred)

- **Hot-swap on route change** — voice session is long-lived; ideally re-fetch tools when browser navigates. MVP: tools registered ONCE at session start. Page-route changes during a voice session keep the original tool set until session restart. Phase 4.5 or follow-up sortie handles dynamic re-registration.
- **Streaming tool-call responses** — Realtime LLM tool execution is request/response. No streaming variant.
- **Multi-step client-tool chains within single LLM turn** — same as chat 3.5; one client-tool call per turn MVP. LLM can chain by issuing next turn's call.
- **Capability tagging** (`risk_tier`) — still hardcoded deny-list (deferred from Phase 1+2 + 3 + 3.5)
- **Voice-agent unit tests against real LiveKit** — mock data-channel layer; integration test deferred
- **Operator action** — flipping `HARNESS_ADAPTER_VOICE=true` (or whatever flag name); separate deploy-conductor sortie. Suggested default: feature-flag `HARNESS_ADAPTER_VOICE` parallel to `HARNESS_ADAPTER_CHAT`. When OFF, voice falls back to existing static `buildAllBotssonTools()` (backward-compat).

## Affected missions

- **botsson-voice-mission** — primary consumer; this sortie wires it
- **75 page-scope `_tools/use-*-tools.ts`** — implementations now fire from voice too (not just chat per Phase 3.5)
- **L-0234 voice activity-event mirror** — same data-channel pattern; extends `BotssonShell.handleVoiceActivity` (which already routes events to page bridges)

## Contracts modified / new

- Browser-side `LiveKitVoiceSession.registerTool(name, impl)`: real impl stores in Map
- Browser-side `LiveKitVoiceSession`: new internal method `publishToolDefinitions()` (or similar) called at session start
- LiveKit data channel topics:
  - `botsson-client-tools-register` (browser → voice-agent, session start)
  - `botsson-client-tool-call` (voice-agent → browser, on LLM invocation)
  - `botsson-client-tool-result` (browser → voice-agent, after impl runs)
- Voice-agent: new handler in `services/voice-agent/src/agent.ts` `RoomEvent.DataReceived` for the three topics
- Voice-agent: replace `buildAllBotssonTools()` with HarnessAdapter resolution when `HARNESS_ADAPTER_VOICE=true`; fall back when off
- Feature flag: `HARNESS_ADAPTER_VOICE` (env var on voice-agent process)

## Risks

- **R1: LiveKit Agents 1.3 API for dynamic tool registration** — uncertain whether `agent.updateTools()` exists or how to inject post-construction. Mitigation: Wave 0 investigation (5 min) before Wave 1; if API doesn't allow runtime injection, MVP becomes "voice-agent reads tools BEFORE Agent construction" — browser publishes BEFORE Agent boots, requires session-start handshake (~50ms latency cost, acceptable).
- **R2: Realtime LLM tool-call interception** — tool execution flow in Realtime API is opaque vs `generateText`. May not have a "pause + ask client + resume" hook. Mitigation: investigate `voice.Agent` tool callback API; if no pause-hook, implement tool body as `async () => { publishRPC; await response; return result }` — tool body itself does the roundtrip.
- **R3: Data channel ordering / dropped messages** — LiveKit data channel may not guarantee delivery. Mitigation: use `unreliable: false` per LiveKit docs; add explicit ack via `call_id` matching; client retries on timeout.
- **R4: Authority bypass via client-shipped tools** — same as Phase 3.5b R5. Mitigation: HarnessAdapter authority pass already strips PII tools for voice (ADR-0078); client cannot ship a tool with PII-tier name because authority strips by name regex.
- **R5: PII tool ships to voice anyway** — browser-side BotssonProvider.botssonTools may include tools that fail voice's PII check. Mitigation: voice-agent applies authority again after merge (defense-in-depth, same as Phase 3.5 resolver).
- **R6: Voice session can't get pageRoute** — voice session may start before any page-scope tools register. Mitigation: browser publishes `botsson-client-tools-register` AFTER `context_init` AND after BotssonProvider has gathered tools (existing useEffect dep on `botssonTools`). Voice-agent waits for both events before composing Agent tools.

## Plain-language version (4 sentences, ELI10)

Phase 3.5 made chat-Botsson actually push the buttons on 75 page tools. Phase 4 does same for VOICE-Botsson — but instead of HTTP roundtrip (chat), it uses voice-room data channel (analog wire that's always open during call). Browser tells voice-Botsson "here are my buttons" at session start; when voice-Botsson decides to press one, it shouts down the wire, browser pushes button, shouts answer back, voice continues talking. Done when voice-Botsson can fire `listOpenDeviations` from HMS page during live voice session and read result aloud.

## Status

`pending_user_confirm` — awaiting "go".
