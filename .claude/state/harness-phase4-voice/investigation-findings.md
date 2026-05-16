---
goal_id: harness-phase4-voice
phase: wave-0-investigation
created: 2026-05-14
---

# Wave 0 Investigation Findings

## API contracts (LOCKED)

**LiveKit Agents 1.3 — `agent.updateTools(tools)`** exists.
- Type: `(tools: ToolContext) => Promise<void>`
- Location: `services/voice-agent/node_modules/@livekit/agents/dist/voice/agent.d.ts:103`
- Pattern: parallel to existing `agent.updateChatCtx()` (used at `agent.ts:236`)

**Tool execute body is async.**
- Type: `(args, opts: ToolOptions) => Promise<Result>`
- Location: `tool_context.d.ts:80`
- LLM blocks until Promise resolves. Natural fit for RPC roundtrip.

**No pre-execution tool-call hook.** Only `FunctionToolsExecuted` event AFTER calls complete. Must own the `execute` body.

**No catch-all/dynamic tool registration.** Every tool named explicitly. Must build stub tools matching client-shipped definitions.

## Existing infrastructure to reuse

**voice-agent `_publishActivity`** at `services/voice-agent/src/adapter-internal.ts:39`:
- Uses `_activeLkRoom.localParticipant.publishData(payload, { topic, reliable: true })`
- Already proven for orb tools + schedule tools (L-0234 pattern)

**voice-agent `_activeLkRoom`** module-level ref at `adapter-internal.ts:19`. Set via `setActiveLkRoomForAdapter`.

**Browser tool-registry** at `apps/web/src/app/Botsson/_components/tool-registry.ts:27`:
- `Map<string, RegisteredToolSet>` holds live implementations per scope
- `useRegisteredTools()` merges all into `{ definitions, implementations }`

**Browser `useAgent`** already calls `session.registerTool()` for every tool at session start + on re-registration. The stub at `packages/agent-sdk/src/providers/livekit.ts:38-40` is the missing link.

## Topic protocol (LOCKED)

Three new LiveKit data-channel topics. No collisions with existing `botsson-activity` or `botsson-context`:

| Topic | Direction | Payload |
|---|---|---|
| `botsson-tools-register` | browser → voice-agent | `{ type: "tools_register", definitions: ClientToolDefinition[] }` |
| `botsson-tool-call` | voice-agent → browser | `{ type: "tool_call", call_id: string, name: string, arguments: Record<string,unknown> }` |
| `botsson-tool-result` | browser → voice-agent | `{ type: "tool_result", call_id: string, result: string, is_error?: boolean }` |

## Recommended implementation pattern

### Server side (voice-agent)

1. Module-level `pendingRPCCalls: Map<string, (result: string) => void>` (in `adapter-internal.ts` or new sibling)
2. `DataReceived` handler in `agent.ts:226` extended:
   - On `botsson-tools-register`: parse `definitions`, build stub `llm.tool()` entries whose execute body does RPC roundtrip; call `await agent.updateTools({ ...existingTools, ...clientToolStubs })`
   - On `botsson-tool-result`: look up `call_id` in `pendingRPCCalls`, resolve the Promise
3. Stub tool execute body:
   ```ts
   execute: async (args) => {
     const callId = randomUUID();
     const promise = new Promise<string>((resolve) => {
       pendingRPCCalls.set(callId, resolve);
       setTimeout(() => {
         pendingRPCCalls.delete(callId);
         resolve("Tool execution timed out (10s).");
       }, 10_000);
     });
     await _publishActivity(
       { type: "tool_call", call_id: callId, name: "<toolname>", arguments: args },
       "botsson-tool-call",
     );
     return await promise;
   }
   ```
4. Feature flag `HARNESS_ADAPTER_VOICE`: when ON, use HarnessAdapter capabilities AND register client stubs. When OFF, use existing `buildAllBotssonTools()` only (backward-compat).

### Browser side (agent-sdk)

`packages/agent-sdk/src/providers/livekit.ts` — replace `LiveKitVoiceSession` stub:

1. Store `room: Room` instance (constructor arg)
2. `implementations: Map<string, ClientToolImplementation>` (instance field)
3. `registerTool(name, impl)`: `implementations.set(name, impl)` — store
4. New method or session-start hook: `publishToolDefinitions(definitions)`:
   - `room.localParticipant.publishData(encode({ type: "tools_register", definitions }), { topic: "botsson-tools-register", reliable: true })`
5. Listen for `RoomEvent.DataReceived` with topic `botsson-tool-call`:
   - Decode `{ call_id, name, arguments }`
   - `const impl = implementations.get(name)`
   - If not found: result = `"Client tool '<name>' not registered in this session."`, is_error = true
   - Else: try/catch invoke `await impl(arguments)`; result = return value, or error.message + is_error: true
   - Publish result: `room.localParticipant.publishData(encode({ type: "tool_result", call_id, result, is_error }), { topic: "botsson-tool-result", reliable: true })`

### Authority

Voice channel + PII strip: HarnessAdapter authority already strips PII tools for `channel: "voice"` (Phase 1+2 work). Voice-agent calls `harnessAdapter.getToolsForChannel("voice", pageRoute, userContext)` for capability tools. Client-shipped tools also pass through authority before becoming stubs (defense-in-depth — implement in stub-building step).

## Wave 1 dispatch plan

Three parallel agents (disjoint files):

- **A1 — agent-sdk browser side:** Fill `LiveKitVoiceSession` (`packages/agent-sdk/src/providers/livekit.ts`) per spec above + tests
- **A2 — voice-agent server side:** Extend `agent.ts` + `adapter-internal.ts` (or new `client-tool-rpc.ts`) + feature flag + tests
- **A3 — HarnessAdapter integration in voice-agent + integration plumbing in browser session-context publish trigger:** Wire `harness-tool-resolver.ts` (voice equivalent of `chat-tool-resolver.ts`) + browser-side trigger for `publishToolDefinitions` after session ready

Wave 2: DOCS (JOURNEY + HANDOFF).

Risks revisited (R1-R6 from goal):
- R1: RESOLVED via `updateTools()` API
- R2: RESOLVED via async execute body with RPC inline
- R3: data-channel reliable=true mitigates dropping; timeout handles edge cases
- R4: defense-in-depth authority pass on client stubs (A2 implements)
- R5: same as R4
- R6: handshake timing — browser publishes AFTER session ready event (existing pattern)
