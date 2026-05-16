---
goal_id: harness-phase35-client-exec
status: pending_user_confirm
created: 2026-05-14
worktree: /home/sxtnl/dev/smartout.ai-wt-1
branch: feat/harness-phase35-client-exec
base: development
predecessor_adr: ADR-0327
predecessor_sortie: harness-phase3-chat (shipped 063bcd187 — bundle resolved but not yet passed to LLM; client tools have stub implementations)
---

# Goal — harness-phase35-client-exec

## Outcome (technical, source of truth)

Close the two `DEAD-PIPE-ADR-0327-C1` TODOs in `services/stage-engine/src/routes/agent/chat.ts` (Phase 3.5a) AND ship the client-tool-execution roundtrip protocol so LLM-invoked client tools actually fire in the browser (Phase 3.5b).

### Phase 3.5a — Bundle to LLM

When `HARNESS_ADAPTER_CHAT=true` and `resolveChatTools` returns a bundle, pass `bundle.definitions` + `bundle.implementations` (merged with whatever capability tools `routeAgentMessage` would resolve) into `generateText`. Replace or augment the existing `toVercelTools(selectedTools)` call site at `services/stage-engine/src/core/agent-router.ts:654`. Client-shipped tool DEFINITIONS reach the LLM's tool list.

### Phase 3.5b — Client-tool roundtrip

When LLM picks a CLIENT tool (one whose implementation is a stub returning "client-side tool — not directly invokable from stage-engine"), don't run the stub. Instead:

1. Stage-engine emits a `client_tool_call_required` event to BFF (via SSE stream or response field)
2. BFF returns event to browser (Botsson chat client)
3. Browser invokes the actual client-tool `implementation` (from `BotssonProvider.botssonTools.implementations`) with the args
4. Browser POSTs `client_tool_call_result` to BFF (new endpoint or same chat route with `tool_result` field)
5. BFF forwards to stage-engine
6. Stage-engine resumes LLM with tool result; LLM continues conversation

## Acceptance criteria (binary, testable)

1. `services/stage-engine/src/core/agent-router.ts:routeAgentMessage` accepts optional `bundle?: ToolBundle` parameter. When present, merges bundle.definitions/implementations with existing selected tools before `generateText`. When absent, existing behavior.
2. Chat route at `services/stage-engine/src/routes/agent/chat.ts` removes `DEAD-PIPE-ADR-0327-C1` comments and PASSES `resolved.bundle` to `routeAgentMessage` when `harnessAdapterChatEnabled()` returns true.
3. Stage-engine integration test: send `/agent/chat` with `client_tools` populated + `HARNESS_ADAPTER_CHAT=true`. Mock LLM. Assert LLM's `tools` parameter includes BOTH capability tools AND client-shipped tools.
4. Stage-engine: when LLM tool-call targets a CLIENT-SHIPPED tool (identified by name being in `bundle.definitions` but NOT in server-side `selectedTools` registry), stage-engine returns response with new field `client_tool_calls: Array<{ tool_call_id, name, arguments }>` instead of executing the stub.
5. BFF chat route propagates `client_tool_calls` from stage-engine response to client response body.
6. BFF chat route accepts NEW request field `client_tool_results: Array<{ tool_call_id, result: string }>` — when present, forwards to stage-engine which resumes the conversation with those results filled in as tool messages.
7. Browser-side: `BotssonChat.tsx` detects `client_tool_calls` in response, runs `botssonTools.implementations[name](args)` for each, collects results, POSTs back to BFF with `client_tool_results`. Conversation continues.
8. End-to-end test (integration or browser): from page with `useRegisterTools("test-scope", ...)`, send a chat message that triggers the test tool, assert browser-side implementation ran AND result reached LLM follow-up.
9. Repo-wide `pnpm turbo typecheck` passes.
10. All existing chat tests still pass (6 route pipeline + 10 resolver + 5 BFF).
11. JOURNEY-harness-phase35-client-exec.md has `verified: true`.
12. HANDOFF written.

## Out of scope (explicitly deferred)

- **Phase 4** — voice consumer wiring (different transport — LiveKit data channel for tool roundtrip; pattern from 3.5b applies but transport differs).
- **Capability tagging** — still hardcoded PII deny-list (deferred from Phase 1+2 + Phase 3).
- **Streaming chat responses** — stage-engine currently returns full response after `generateText` resolves. Tool-roundtrip pattern works request/response; streaming variant would interleave `client_tool_calls` events. For 3.5b, batch-mode (full response → call client tools → resume) is acceptable; streaming roundtrip is Phase 3.6+.
- **Removing `toVercelTools` fallback path** entirely. Stays per ADR Migration Path.
- **Multi-step tool chains involving client tools** — `stepCountIs(5)` already in place; one client-tool call per conversation turn is the MVP. Multi-step (LLM calls client tool, gets result, calls another client tool, etc.) works if the protocol round-trips properly but is not E2E-tested.
- **Operator action** — flipping `HARNESS_ADAPTER_CHAT=true` in production. Separate deploy-conductor sortie.

## Affected missions

- **botsson-chat-mission** — primary consumer; this sortie completes its dead-pipe closure
- **botsson-voice-mission** — downstream; Phase 4 will adapt 3.5b pattern for voice transport
- **All 42 page-scope `_tools/use-*-tools.ts` hooks** — their implementations finally fire when LLM calls them (currently stub closures in stage-engine; this sortie routes back to browser)

## Contracts modified / new

- `routeAgentMessage` signature: add optional `bundle?: ToolBundle` parameter
- Stage-engine `/agent/chat` response shape: add optional `client_tool_calls` field
- BFF `/api/botsson/chat` response shape: same field propagated
- BFF `/api/botsson/chat` request shape: add optional `client_tool_results` field
- Stage-engine `/agent/chat` request shape: same
- New event type in telemetry registry (if path requires): `harness.client_tool_call.required` + `harness.client_tool_call.completed` — defer if telemetry already covers via existing `tools.invoked` shape

## Risks

- **R1: LLM hallucinates client-tool args.** When LLM calls a tool client wasn't built to handle, browser-side `implementation` may throw. Mitigation: each implementation wraps in try/catch, returns error string. Browser sends error as result. LLM apologizes + recovers.
- **R2: Roundtrip latency** — extra hop adds ~200-500ms per client-tool call. Mitigation: log latency; acceptable for MVP (no perf budget bust expected).
- **R3: Tool-call disambiguation** — stage-engine must know which tools are CLIENT (need roundtrip) vs SERVER (execute inline). Mitigation: `bundle.definitions` from harness includes a marker or stage-engine cross-checks against `selectedTools` server registry. Implementer agent decides cleanest mechanism.
- **R4: Conversation state across roundtrip** — stage-engine `generateText` ends turn after first tool-call if client. Resume requires session state. Mitigation: existing `session_id` flow already handles multi-turn; we just need to record the tool-call-pending state in session + resume with tool results.
- **R5: Authority bypass via tool args** — client could ship malicious args. Mitigation: authority pass already strips disallowed tools from bundle (Phase 3 R4). Args validation is the responsibility of each tool implementation in the browser.
- **R6: Response shape change breaks existing clients** — adding `client_tool_calls` field to response. Mitigation: optional field; existing clients ignore it. Backward-compatible.

## Plain-language version (4 sentences, ELI10)

Phase 3 plugged chat-Botsson into phone-book but it can SEE entries it can't CALL — like phone with no dial button. 75 page tools register, LLM sees them in list, but if LLM tries to call one it gets back placeholder text instead of action. Phase 3.5 builds dial button: when LLM picks client tool, message bounces stage-engine → BFF → browser → browser fires actual tool → result bounces back → conversation resumes. We know it works when test page registers fake tool, LLM calls it from chat, fake tool actually runs in browser, result appears in chat reply.

## Status

`pending_user_confirm` — awaiting explicit "go" before Wave 1 dispatch.
