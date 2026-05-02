---
name: Voice-agent tool wiring pattern (Phase 0d)
description: How tools are wired into the LiveKit voice.Agent and the ask() bridge to stage-engine
type: project
---

Phase 0d (2026-04-30) wired full tool surface into services/voice-agent.

**LiveKit tool registration pattern:**
- `voice.Agent({ instructions, tools })` — `tools` is `ToolContext` = `Record<string, FunctionTool>`
- `llm.tool({ description, parameters, execute })` creates a `FunctionTool`
- The orb tools in `tools-orb.ts` use this pattern already
- `buildAllBotssonTools()` in `adapter.ts` merges orbTools + personalTools + capabilityTools

**ask() bridge:**
- `adapter.ts` exports `ask(query, label)` → `POST stage-engine:5010/agent/chat`
- Forwards `channel: "voice"` so stage-engine Layer 3 guards reject chat-only tools
- Emits `tool_call` + `tool_response` activity events over LiveKit data channel for Arena LogView
- `profile_id` + `workspace_id` come from `context_init` message (trusted: BFF resolved via JWT)

**Why voice-agent doesn't import @smartout/ai:**
- It's a standalone Node.js process — no monorepo package dep configured
- All capabilities route via stage-engine HTTP, not direct import
- ADR-0132 pattern: voice → BFF/service → stage-engine → capabilities

**llm.ToolContext import:**
- Linter converts `import { llm }` to `import type { llm }` when used only for type
- Both compile fine; `llm.ToolContext` is the return type annotation for `buildAllBotssonTools()`

**Phase 0e gaps:**
- context_init wait: if first ask() fires before context_init arrives, returns early error
- ADR-0151 full voice path: profile_id in stage-engine POST body is still technically
  forgeable (context_init came from browser). Full fix = derive from room participant metadata
- E2E test for voice tool round-trip
