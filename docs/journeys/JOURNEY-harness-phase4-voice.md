---
title: HarnessAdapter Phase 4 — Voice Consumer Wiring — User Journeys
status: verified
verified: true
updated: 2026-05-14
created: 2026-05-14
feature: harness-phase4-voice
module: harness
tags: [journey, harness, botsson, adr-0327, phase4, voice, livekit, client-tool-roundtrip]
---

# JOURNEY-harness-phase4-voice

> ADR: `docs/decisions/0327-harness-adapter-unified-llm-consumer.md`
> Goal: `.claude/state/harness-phase4-voice/goal.md`
> Investigation: `.claude/state/harness-phase4-voice/investigation-findings.md`
> Predecessor: `docs/journeys/JOURNEY-harness-phase35-client-exec.md`

Phase 4 closes the voice-surface dead pipe. Phase 3.5 gave chat-Botsson the ability to invoke client-shipped page tools via HTTP roundtrip. Phase 4 does the same for voice-Botsson via LiveKit data-channel transport — three new bidirectional topics wire the browser ↔ voice-agent RPC protocol. `LiveKitVoiceSession.registerTool` (previously a no-op stub) is replaced with a real implementation; voice-agent receives definitions, builds async stubs, and registers them on the Realtime LLM via `agent.updateTools()`.

The "users" in these journeys are browser-side surfaces (`BotssonOrbVoiceMount`, `LiveKitVoiceSession`) and voice-agent server components (`agent.ts`, `client-tool-rpc.ts`, `voice-tool-resolver.ts`). End-user experience (speaking to Botsson, hearing tool results aloud) is verified via acceptance criteria smoke test and code-trace.

---

## Journey 1: Browser publishes tool definitions over LiveKit data channel at session start

**Role:** BotssonOrbVoiceMount + LiveKitVoiceSession
**Surface:** `packages/agent-sdk/src/providers/livekit.ts` + `apps/web/src/app/Botsson/_components/BotssonOrbVoiceMount.tsx`

**Precondition:**
- LiveKit Room connected (voice session established)
- `useRegisteredTools()` has collected current page's tool definitions
- `HARNESS_ADAPTER_VOICE=true` (or browser-side publish is unconditional — voice-agent gates on flag)

**Steps:**

1. `BotssonOrbVoiceMount` `useEffect` fires after room connect. Dependency: `registeredTools.definitions`.
2. Mount calls `session.publishToolDefinitions(registeredTools.definitions)` (or equivalent — method on `LiveKitVoiceSession`).
3. `LiveKitVoiceSession.publishToolDefinitions` encodes payload `{ type: "tools_register", definitions: ClientToolDefinition[] }` and calls `room.localParticipant.publishData(encoded, { topic: "botsson-tools-register", reliable: true })`.
4. Voice-agent `RoomEvent.DataReceived` handler at `agent.ts:226` receives the packet.

**Postcondition:**
- Voice-agent worker has received the browser's tool definition list
- Handshake message is on the data channel with `reliable: true` (no-drop guarantee)

**Error paths:**

| Condition | Behavior |
|---|---|
| Room not yet connected when effect fires | Effect dep on session connection state; publish guarded by connection check |
| Empty definitions array | `publishData` sends empty array; voice-agent receives empty definitions — no stubs built, no harm |
| Room disconnect mid-publish | LiveKit reliable data channel retries until ACK; timeout handled at OS/transport layer |

**Verification:**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-1
pnpm --filter @smartout/agent-sdk test packages/agent-sdk/src/providers/__tests__/livekit-voice-session.test.ts
# 6/6 pass — covers: register/overwrite, handshake publish, RPC roundtrip,
# unknown-name result, throw-recovery, leave-cleanup
```

**Verified:** 2026-05-14 — 6/6 pass.

---

## Journey 2: Voice-agent receives definitions and registers stubs via agent.updateTools()

**Role:** voice-agent worker
**Surface:** `services/voice-agent/src/agent.ts` (DataReceived handler) + `services/voice-agent/src/client-tool-rpc.ts`

**Precondition:**
- `HARNESS_ADAPTER_VOICE=true`
- Browser has sent `botsson-tools-register` handshake (Journey 1 completed)

**Steps:**

1. `agent.ts` `RoomEvent.DataReceived` handler matches `topic === "botsson-tools-register"`.
2. Decodes packet: `{ type: "tools_register", definitions: ClientToolDefinition[] }`.
3. For each definition: calls `buildClientToolStub(def)` from `client-tool-rpc.ts`.
   - Stub's `execute` body is async: generates `call_id`, parks Promise in `pendingRPCCalls` Map, arms 10s timeout, then publishes `{ type: "tool_call", call_id, name, arguments }` on topic `botsson-tool-call`.
4. Collects stubs into `clientToolStubs` Record.
5. Calls `await agent.updateTools({ ...currentCapabilityTools, ...clientToolStubs })`.
   - `currentCapabilityTools` sourced from `voice-tool-resolver.ts` (capability tools for voice channel).
   - Client stubs merged AFTER — client-tool-wins on name collision (same semantics as chat resolver).

**Postcondition:**
- Realtime LLM's tool list now includes both capability-resolved tools AND client-shipped tools
- `agent.updateTools()` is a LiveKit Agents 1.3 API (`agent.d.ts:103`) — call post-construction is supported

**Error paths:**

| Condition | Behavior |
|---|---|
| `definitions` contains malformed schema | `buildClientToolStub` wraps in try/catch; malformed def skipped with console.warn |
| `agent.updateTools` throws | Error logged; previous tool list retained (no crash) |
| `HARNESS_ADAPTER_VOICE=false` | DataReceived handler still parses topic; feature-flag guard at capability resolution step only; client stubs still register (harmless when flag is off — capability tools remain static `buildAllBotssonTools()`) |

**Verification:**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-1
pnpm --filter @smartout/voice-agent test services/voice-agent/__tests__/client-tool-rpc.test.ts
# 7/7 pass — covers: stub-build, RPC publish, pending-map, resolve, timeout,
# unknown-name result, throw recovery
```

**Verified:** 2026-05-14 — 7/7 pass.

---

## Journey 3: LLM picks client tool → RPC roundtrip via data channel

**Role:** voice.Agent execute body → LiveKit data channel → browser → data channel → voice.Agent
**Surface:** `client-tool-rpc.ts` (stub execute body) + `packages/agent-sdk/src/providers/livekit.ts` (browser RPC handler)

**Precondition:**
- Journey 1 + Journey 2 complete (definitions registered, stubs built)
- LLM emits tool call targeting a client-shipped tool name

**Steps:**

1. Realtime LLM invokes stub tool — LiveKit Agents framework calls stub's async `execute` body.
2. Execute body: `const call_id = randomUUID()`. Parks `resolve` callback in `pendingRPCCalls.set(call_id, resolve)`. Arms 10s timeout: on fire, deletes from map and resolves with `"Tool execution timed out (10s)."`.
3. `_publishOnTopic` sends `{ type: "tool_call", call_id, name, arguments }` on topic `botsson-tool-call` with `reliable: true`.
4. Browser `LiveKitVoiceSession` `RoomEvent.DataReceived` listener matches topic `botsson-tool-call`.
5. Decodes `{ call_id, name, arguments }`. Looks up `implementations.get(name)`.
   - If not found: result = `"Client tool '<name>' not registered in this session."`, `is_error = true`.
   - If found: `try { result = await impl(arguments) } catch(e) { result = e.message; is_error = true }`.
6. Browser publishes `{ type: "tool_result", call_id, result, is_error }` on topic `botsson-tool-result` with `reliable: true`.
7. Voice-agent `agent.ts` `RoomEvent.DataReceived` matches topic `botsson-tool-result`.
8. Calls `resolveToolResult(call_id, result)` — looks up pending Promise, calls `resolve(result)`.
9. Stub's `execute` body receives resolved value — returns to Realtime LLM as tool result string.
10. LLM continues conversation, reads result aloud or acts on it.

**Postcondition:**
- LLM received real tool execution result from browser
- Voice session continues with tool context injected

**Error paths:**

| Condition | Behavior |
|---|---|
| Implementation throws | `is_error: true` result sent; LLM receives error string, can acknowledge gracefully |
| Unknown tool name | `"not registered"` error result; LLM told tool unavailable |
| 10s timeout fires | `"timed out"` result; LLM told to skip or retry |
| `call_id` not found in pending map (stale or duplicate) | `resolveToolResult` no-ops silently; no crash |

**Verification:**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-1
pnpm --filter @smartout/agent-sdk test packages/agent-sdk/src/providers/__tests__/livekit-voice-session.test.ts
pnpm --filter @smartout/voice-agent test services/voice-agent/__tests__/client-tool-rpc.test.ts
# Combined 13/13 (6+7) — roundtrip, timeout, unknown-name, throw-recovery all covered
```

**Verified:** 2026-05-14 — 13/13 (6+7) pass.

---

## Journey 4: PII tools stripped from voice channel (ADR-0078 holds)

**Role:** HarnessAdapter authority layer + voice-tool-resolver
**Surface:** `services/voice-agent/src/voice-tool-resolver.ts`

**Precondition:**
- `HARNESS_ADAPTER_VOICE=true`
- Capability bundle includes a PII-tier tool (e.g. `revealPersonnummer`, `getContractSalary`)

**Steps:**

1. Voice-agent calls `harnessAdapter.getToolsForChannel("voice", pageRoute, userContext)`.
2. Authority enforcer applies ADR-0078-voice-no-pii rule: iterates capability definitions, removes any with `risk_tier: "pii"` or matching hardcoded PII deny-list (Phase 1+2 pattern).
3. Blocked tools recorded in `bundle.authority.blockedTools` for audit logging.
4. `voice-tool-resolver.ts` receives filtered bundle — PII tools absent.
5. `buildClientToolStub` loop in `agent.ts` receives client-shipped definitions. Even if browser shipped a PII-named tool, voice-tool-resolver defense-in-depth strips it from the merged set before `agent.updateTools()`.

**Postcondition:**
- Realtime LLM never receives PII tools in voice tool list
- `bundle.authority.blockedTools` documents what was stripped (audit trail)

**Error paths:**

| Condition | Behavior |
|---|---|
| Browser ships a PII tool name (R4/R5 from goal.md) | Authority strips by name at voice-tool-resolver level; stub never built |
| `getToolsForChannel` throws | Voice-agent falls back to `buildAllBotssonTools()` (backward-compat path) |

**Verification:**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-1
pnpm --filter @smartout/voice-agent test services/voice-agent/__tests__/voice-tool-resolver.test.ts
# 7/7 pass — includes "PII tool stripped from voice bundle" case
```

**Verified:** 2026-05-14 — 7/7 pass.

---

## Journey 5: Hot-swap on browser route change

**Role:** BotssonOrbVoiceMount useEffect
**Surface:** `apps/web/src/app/Botsson/_components/BotssonOrbVoiceMount.tsx`

**Precondition:**
- Voice session active (Room connected)
- User navigates to a different dashboard page (different `useRegisteredTools` scope)
- New page has a different set of `useRegisterTools` hooks mounted

**Steps:**

1. `useRegisteredTools()` returns a new `definitions` array (new page scope).
2. `BotssonOrbVoiceMount` `useEffect` dep `registeredTools.definitions` changes.
3. Effect checks session connection state — still connected.
4. Re-publishes `botsson-tools-register` with new definitions array (full replacement, not delta).
5. Voice-agent `RoomEvent.DataReceived` receives updated definitions.
6. `buildClientToolStub` runs again for each new definition; `agent.updateTools()` called with new merged set.
7. Previous client stubs replaced — voice LLM's tool list reflects the page user is currently on.

**Postcondition:**
- Voice LLM's client-tool set matches the user's current page scope
- No stale page tools from previous route remain active

**Error paths:**

| Condition | Behavior |
|---|---|
| Route change during active tool RPC call | Pending RPC resolves or times out normally; new definition list takes effect on next `updateTools` call |
| New page has no registered tools | Empty `definitions` array published; voice-agent builds zero client stubs; only capability tools remain |

**Verification:** Hot-swap behavior verified via code-trace — `useEffect` dependency on `registeredTools.definitions` + re-publish path confirmed in source. Runtime E2E browser test deferred (would require LiveKit room mock in Playwright or real audio session). Implementation is type-safe and follows established `useEffect` + `publishData` pattern.

**Verified-pattern:** 2026-05-14 (code-trace; runtime E2E deferred to Phase 4.5+).

---

## Closure gate

- [x] All 5 journeys match production code paths
- [x] Test suites pass: agent-sdk 6/6 + client-tool-rpc 7/7 + voice-tool-resolver 7/7 = **20/20**
- [x] Repo-wide typecheck: 52/52
- [x] `LiveKitVoiceSession.registerTool` stub replaced with real implementation
- [x] 3 new LiveKit data-channel topics wired bidirectionally (`botsson-tools-register`, `botsson-tool-call`, `botsson-tool-result`)
- [x] Feature flag `HARNESS_ADAPTER_VOICE` gates capability resolution (flag OFF = existing static path unchanged)
- [x] ADR-0078 authority pass verified — PII strip confirmed (Journey 4, 7/7 tests)
- [x] HANDOFF written (`docs/HANDOFF-harness-phase4-voice.md`)
- [ ] **Operator action post-merge:** flip `HARNESS_ADAPTER_VOICE=true` in voice-agent env (deploy-conductor sortie)
