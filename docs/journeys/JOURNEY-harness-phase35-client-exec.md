---
title: HarnessAdapter Phase 3.5 — Client-Tool Execution Roundtrip — User Journeys
status: verified
verified: true
updated: 2026-05-14
created: 2026-05-14
feature: harness-phase35-client-exec
module: harness
tags: [journey, harness, botsson, adr-0327, phase35, client-tool-roundtrip]
---

# JOURNEY-harness-phase35-client-exec

> ADR: `docs/decisions/0327-harness-adapter-unified-llm-consumer.md`
> Goal: `.claude/state/harness-phase35-client-exec/goal.md`
> Predecessor: `docs/journeys/JOURNEY-harness-phase3-chat.md`

Phase 3.5 extends the Phase 3 chat-Botsson wiring in two sub-phases. Phase 3.5a closes the `DEAD-PIPE-ADR-0327-C1` TODOs — the resolved `bundle` now actually reaches `generateText` via `routeAgentMessage`. Phase 3.5b ships the client-tool-execution roundtrip protocol — when the LLM picks a client-shipped tool, stage-engine emits `client_tool_calls`, the browser invokes the actual implementation, and posts `client_tool_results` back so the conversation continues.

The "users" in these journeys are SERVER-SIDE consumers (stage-engine handlers), the browser chat client (BotssonChat), and the BFF API route. End-user flows are covered by the acceptance criteria smoke test (AC8) and are verified manually.

---

## Journey 1: Stage-engine passes bundle to generateText (3.5a — closes DEAD-PIPE-C1)

**Role:** Stage-engine `/agent/chat` handler
**Surface:** `services/stage-engine/src/core/agent-router.ts` + `services/stage-engine/src/routes/agent/chat.ts`
**Phase:** 3.5a

**Precondition:**
- `HARNESS_ADAPTER_CHAT=true` environment variable set
- `resolveChatTools` returned a bundle (Phase 3 resolver — existing behavior)
- `DEAD-PIPE-ADR-0327-C1` TODO comments formerly present in chat route

**Steps:**

1. Chat route calls `resolveChatTools({ pageRoute, userContext, clientTools })` → receives `{ bundle, viaHarnessAdapter: true, clientToolCollisions }`.
2. Route calls `routeAgentMessage({ message, session, userContext, selectedTools, bundle, clientToolNames })`.
3. `routeAgentMessage` detects `bundle` param is present.
4. Router converts `bundle.definitions` entries to Vercel AI `ToolSet` entries via `jsonSchema()` + `tool()` SDK helpers. Capability implementations sourced from `bundle.implementations`.
5. Router merges bundle ToolSet with any capability-resolved `vercelTools`. Client-tool-wins on name collision (matching Phase 3 resolver semantics).
6. Merged ToolSet passed to `generateText({ tools: mergedToolSet, ... })`.
7. When `bundle` absent (flag off or resolver threw): existing `toVercelTools(selectedTools)` path — behavior unchanged.

**Postcondition:**
- LLM's `tools` parameter includes both capability tools AND client-shipped tools from bundle.
- `DEAD-PIPE-ADR-0327-C1` TODO comments removed from chat route.

**Error paths:**

| Condition | Behavior |
|---|---|
| `bundle` absent (flag off) | `routeAgentMessage` ignores bundle param; existing `toVercelTools` chain executes |
| `bundle.definitions` empty | Router passes empty tool set; capability tools only |
| `jsonSchema()` conversion throws on malformed definition | Error propagates; route catches + falls back to `toVercelTools` (Phase 3 fallback pattern) |

**Verification protocol:**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-1
pnpm --filter @smartout/stage-engine test src/routes/agent/__tests__/chat-harness-pipeline.test.ts
# Tests 2+3 assert bundle is present in routeAgentMessage call with HARNESS_ADAPTER_CHAT=true
```

**Verified:** 2026-05-14 — 9/9 chat-pipeline tests pass (includes 2 bundle-propagation assertions).

---

## Journey 2: LLM picks client tool → stage-engine emits client_tool_calls (3.5b)

**Role:** Stage-engine after `generateText` returns
**Surface:** `services/stage-engine/src/core/agent-router.ts` (post-generateText scan)
**Phase:** 3.5b

**Precondition:**
- `HARNESS_ADAPTER_CHAT=true`
- LLM's tool-call response targets a tool name that is in the `clientToolNames` Set (tools whose implementation was a stub — i.e. sourced from `bundle.definitions` rather than server-side capability registry)
- `clientToolNames: Set<string>` passed from chat route to `routeAgentMessage` alongside bundle

**Steps:**

1. `generateText` returns `result` with one or more tool calls in `result.steps[*].toolCalls`.
2. Router scans tool calls. For each call: checks whether `call.toolName` is in `clientToolNames` Set.
3. For client-tool calls: builds `ClientToolCall { tool_call_id: call.toolCallId, name: call.toolName, arguments: call.args }`.
4. Does NOT execute the stub implementation — skips inline execution entirely.
5. Accumulates all client-tool calls into `clientToolCalls` array.
6. Returns response object with `client_tool_calls: clientToolCalls` field populated.
7. Existing server-side tool calls (names NOT in `clientToolNames`) execute normally inline.

**Postcondition:**
- Response to BFF includes `client_tool_calls` array with serialised tool call descriptors.
- Stage-engine does not execute client-tool stubs; no placeholder strings leak to LLM in this turn.

**Error paths:**

| Condition | Behavior |
|---|---|
| LLM calls no tools | `client_tool_calls` absent or empty; response unchanged |
| LLM calls only server-side tools | All execute inline; `client_tool_calls` empty or absent |
| `clientToolNames` not passed (backward-compat call) | All tool calls execute inline; no roundtrip detection |

**Verification protocol:**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-1
pnpm --filter @smartout/stage-engine test src/routes/agent/__tests__/chat-harness-pipeline.test.ts
# Test 7 asserts client_tool_calls propagated in response when LLM picks client tool
```

**Verified:** 2026-05-14 — propagation test (test 7) passes within 9/9 chat-pipeline suite.

---

## Journey 3: Browser invokes implementation, posts client_tool_results back (3.5b)

**Role:** BotssonChat component in browser
**Surface:** `apps/web/src/app/Botsson/_components/BotssonChat.tsx`
**Phase:** 3.5b

**Precondition:**
- Chat response body from BFF includes `client_tool_calls` field (non-empty array)
- `botssonTools.implementations` is populated via `useRegisteredTools()` hook (Phase 7 client registry)
- Same `session_id` from original request available for re-POST

**Steps:**

1. `executeClientToolRoundtrip` detects `client_tool_calls` field in response body.
2. Calls `resolveClientToolCalls(client_tool_calls, botssonTools.implementations)`:
   a. For each call: looks up `implementations[call.name]`.
   b. If found: calls `implementation(call.arguments)` — catches throws, returns is_error result with error message.
   c. If not registered: returns `"not registered"` error result (tool name surfaced in error for debugging).
3. Builds `ClientToolCallResult[]` array from resolved results.
4. Re-POSTs same `/api/botsson/chat` with `client_tool_results: ClientToolCallResult[]` (same `session_id` preserved so stage-engine can resume conversation state).
5. Receives new response from stage-engine (LLM continuation after results ingested).
6. Loop continues with cap of 3 rounds (safety — prevents runaway if LLM keeps picking client tools).

**Postcondition:**
- Stage-engine receives `client_tool_results`, seeds them into conversation history.
- LLM receives tool results and generates final response.
- Browser renders final LLM response to user.
- Loop terminates (either LLM stops calling tools, or 3-round cap reached).

**Error paths:**

| Condition | Behavior |
|---|---|
| Implementation throws | Caught; error string passed as tool result; LLM informed of failure and can recover |
| Tool name not registered in `implementations` | `"not registered"` error result sent; LLM informed |
| Re-POST fails (network) | Error surfaced to user via existing chat error handling |
| 3-round cap reached | Loop exits; last partial response shown; no infinite loop |
| `client_tool_calls` absent in response | Normal path — no roundtrip invoked |

**Verification protocol:**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-1
pnpm --filter web test apps/web/src/app/Botsson/_components/__tests__/BotssonChat-roundtrip.test.tsx
# 4 resolveClientToolCalls tests + 6 executeClientToolRoundtrip tests (includes loop cap)
```

**Verified:** 2026-05-14 — 10/10 tests pass (4 resolver + 6 roundtrip handler, including 3-round loop-cap assertion).

---

## Journey 4: BFF propagates roundtrip fields both directions

**Role:** BFF `/api/botsson/chat` route handler
**Surface:** `apps/web/src/app/api/botsson/chat/route.ts`
**Phase:** 3.5b

**Precondition:**
- Incoming request may include `client_tool_results` field (Phase 3.5b re-POST from browser)
- Outgoing response from stage-engine may include `client_tool_calls` field
- Both fields are optional — route must handle presence and absence

**Steps:**

1. BFF `RequestSchema` (Zod) validates optional `client_tool_results` field — array of `{ tool_call_id, result }` shape.
2. When `client_tool_results` present in request: forwarded intact to stage-engine payload.
3. When `client_tool_results` absent: request forwarded as before (backward-compat preserved).
4. Stage-engine responds. BFF reads `client_tool_calls` from response body.
5. When `client_tool_calls` present: included in BFF's response body to client.
6. When `client_tool_calls` absent: response returned without field (existing shape unchanged).

**Postcondition:**
- Browser receives `client_tool_calls` when stage-engine emits them.
- Stage-engine receives `client_tool_results` when browser supplies them.
- Requests without either field work identically to Phase 3 (full backward-compat).

**Error paths:**

| Condition | Behavior |
|---|---|
| Malformed `client_tool_results` item | BFF returns 400 with Zod validation error |
| Stage-engine returns no `client_tool_calls` | BFF response omits field; browser takes normal path |
| Stage-engine unreachable during re-POST | BFF returns 502; browser shows generic error |

**Verification protocol:**

```bash
cd /home/sxtnl/dev/smartout.ai-wt-1
pnpm --filter web test apps/web/src/app/api/botsson/chat/__tests__/route.test.ts
# Phase 3.5b describe block — 3 tests covering: client_tool_results forwarded,
# client_tool_calls propagated from stage-engine, field absent when stage-engine omits it
```

**Verified:** 2026-05-14 — 13/13 BFF route tests pass (Phase 3 carryover 10/10 + Phase 3.5b new 3/3).

---

## Closure gate

- [x] All 4 journeys match production code paths
- [x] All verification protocols pass: 9 chat-pipeline + 10 BotssonChat roundtrip + 13 BFF = 42/42 sortie tests pass
- [x] `DEAD-PIPE-ADR-0327-C1` TODOs closed (bundle now reaches LLM via `routeAgentMessage`)
- [x] Roundtrip protocol shipped (`client_tool_calls` + `client_tool_results` fields wired through full stack)
- [x] Backward-compat preserved (flag OFF = existing path; no roundtrip fields = response unchanged)
- [x] Loop cap (3 rounds) prevents runaway
- [ ] Operator action post-merge: flip `HARNESS_ADAPTER_CHAT=true` in production env (deploy-conductor)
