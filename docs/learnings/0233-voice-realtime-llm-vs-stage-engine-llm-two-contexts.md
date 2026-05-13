---
id: L_0233
title: "Voice Realtime LLM ≠ stage-engine LLM — two prompt contexts, two bootstrap paths"
status: active
created: 2026-05-13
updated: 2026-05-13
module: MODULE_BOTSSON
tags: [learning, harness, voice, stage-engine, realtime-api, prompt-context, bootstrap]
related: [L-0176, L-0177, L-0238]
---

# L-0233 — Voice Realtime LLM ≠ stage-engine LLM — two prompt contexts, two bootstrap paths

## Pattern

Mr. Botsson speaks two languages from the user's point of view but has **two distinct LLM contexts under the hood**:

1. **Chat path:** browser POSTs to `/api/emma/chat` → BFF → `services/stage-engine/src/core/agent-router.ts:routeAgentMessage()` → builds a system prompt via `buildBotssonPromptFromContext()` plus appended slices (workforce, route, mission summary, world state) → sends to an Anthropic model via OpenRouter.

2. **Voice path:** browser opens a LiveKit room → `services/voice-agent/agent.ts` connects → constructs a `new voice.Agent({ instructions: mission.systemPrompt, tools })` and starts a session with `openai.realtime.RealtimeModel` → the **OpenAI Realtime API** holds its own system prompt, conversation state, and tool-call loop.

The two LLM contexts are **structurally separate**. A slice rendered by `renderWorkforceSlice()` in stage-engine is visible **only** to the chat-path LLM. The voice-path Realtime LLM cannot see it. Each context requires its own bootstrap.

## How the gap surfaced (2026-05-13)

Phase 1 (commit `5b4b6e52b`) wired the workforce snapshot through:

- BFF endpoint built the snapshot.
- Stage-engine Zod schema accepted `workforce_context` in the request body.
- `renderWorkforceSlice()` appended `## Arbeidsstokk` to the system prompt.

Curl-test of `POST /agent/chat` with `channel: "voice"` body returned `"3 — Alice Andersen."` — proved the slice reached the LLM. Apparent E2E pass.

But live voice test still showed Botsson calling `query_smartout` to look up Jonas Bakken's `profile_id` (6 s) and again for his shift ID (13 s). Workforce was in the prompt — **for stage-engine**. Voice-agent's Realtime LLM never reads stage-engine's system prompt. It only sees what `agent.ts` sets in its own `instructions` parameter + whatever lives in its own `chatCtx`.

The slice had to be injected a **second time** via a different mechanism: `agent.updateChatCtx()` on the LiveKit voice.Agent (commit `84037c6a3`). After Phase 2, conversational turns returned audio in 0.87-1.31s with zero tool calls — confirming the Realtime LLM finally saw the slice.

## Why this happens

The stage-engine LLM context lives in a server-process system prompt assembled per request. The Realtime LLM context lives in an OpenAI session whose `instructions` are baked at session-start. The LiveKit `voice.Agent` exposes `updateChatCtx(ctx: ChatContext)` for runtime modification — that's the only handle to mutate the Realtime LLM's chat history after start.

## Concrete pattern for bootstrap-facts that must reach both LLMs

For any fact-snapshot that should ground both chat and voice answers:

1. **Single source of truth:** the BFF endpoint that the browser fetches at session-init. One JSON shape.
2. **Chat path:** ship in request body, add to Zod schema, append to system prompt in stage-engine. Slice renderer lives in stage-engine (or in `@smartout/ai/prompts/*` if it's shared).
3. **Voice path:** browser publishes the same JSON shape via LiveKit data channel `botsson-context` as `context_init.<field>`. Voice-agent stores in module state via `setSessionContext()`, builds the slice using its own copy of the renderer (or duplicates it inline — see ADR-0289 for the duplication freeze rationale), and calls `agent.updateChatCtx(next)` where `next = agent.chatCtx.copy(); next.addMessage({ role: "developer", content: slice })`.
4. **Verify both ends separately.** A passing curl-test of stage-engine's `/agent/chat` does **not** prove voice has the data. The voice-side proof is a docker log line like `[botsson-voice] workforce injected: …` plus an absence of `query_smartout` calls in the next conversational turn.

## Anti-pattern to avoid

> "I rendered the slice in stage-engine, so both chat and voice have it."

False. Stage-engine and voice-agent are two services with two LLM contexts. Voice-agent calls stage-engine via `ask()` only for **specific tool routing** (e.g. `query_smartout`), not for prompt context. The Realtime LLM's prompt and chat-history are entirely separate from stage-engine's.

## Forward implications

- Any future bootstrap-fact (site-map, year-wheel summary, recent-shifts feed, K1b memory highlights) must follow the same two-path injection pattern.
- The `WorkforceContext` shape exists in **two places**: `packages/ai/src/agents/context-types.ts` (canonical, used by stage-engine) and `services/voice-agent/src/context.ts` (duplicated minimal type, no `@smartout/ai` import). Acceptable until ADR-0289 voice-agent registry-duplication freeze is lifted.
- The slice renderer exists in **two places**: `services/stage-engine/src/core/agent-router.ts:renderWorkforceSlice` and `services/voice-agent/src/agent.ts:renderWorkforceSlice`. They must produce identical text on the same input. Drift = chat and voice answer the same question differently.

## References

- ADR-0078: voice channel PII defence layers
- ADR-0132: mobile/voice → BFF only
- ADR-0289: voice-agent tool-registry duplication freeze
- [ADR-0297](../decisions/0297-workforce-snapshot-session-bootstrap.md): workforce snapshot bootstrap (the originating ADR for this pattern)
- Commits: `5b4b6e52b` (Phase 1 stage-engine), `84037c6a3` (Phase 2 voice-agent)
- LiveKit `voice.Agent` API: `agent.chatCtx` getter + `agent.updateChatCtx(ctx)` setter, both in `@livekit/agents@1.3.0/dist/voice/agent.d.ts`
- Files: `services/voice-agent/src/agent.ts:89-129` (DataReceived listener with workforce inject), `services/stage-engine/src/core/agent-router.ts:renderWorkforceSlice`
