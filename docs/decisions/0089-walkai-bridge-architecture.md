---
title: "ADR-0089: WalkAi Bridge Architecture — Client vs Server Tools"
status: accepted
created: 2026-04-14
updated: 2026-04-14
module: ai
tags: [adr, architecture, walkai, botsson, voice, tools]
---

# ADR-0089: WalkAi Bridge Architecture — Client vs Server Tools

## Context

Botsson/Emma operates through two independent tool execution models:

1. **Client-side tools** (Ultravox `temporaryTool` format in `BotssonTools.ts`) — run in browser, manipulate UI state, fire-and-forget to `/api/emma/*` for persistence.
2. **Server-side capabilities** (`packages/ai/src/capabilities/`) — run server-side via stage-engine with `supabaseAdmin`, authority gating, and `emit()` telemetry.

These systems evolved independently and have no shared abstraction. When a user asks Emma via voice to perform a server-side operation (e.g., create a contract), the voice LLM has no tool for it and falls back to incorrect behavior (creating a notepad note).

## Decision

The bridge between client-side and server-side tools operates through the **existing stage-engine chat pipeline** (`/api/botsson/chat` -> stage-engine `/agent/chat`). There is no direct bridge between the two tool systems.

### Rules

1. **Client-side tools:** NEVER access database directly, NEVER mutate business state. They morph views, navigate pages, open drawers, manage local state (notes, tasks).
2. **Server-side tools:** NEVER touch UI state, NEVER assume browser APIs exist. They access database, call external services, enforce authority.
3. **Contract mutations:** Chat-only, enforced by `allowedChannels: ["chat"]` on capabilities and filtered in `selectTools()`.
4. **New data access needs:** Add to existing server-side capabilities, not new API endpoints. Exception: lightweight client tools that call `/api/emma/*` endpoints for local-state persistence (tasks, notes, memory).
5. **PII in voice:** Absolutely forbidden per ADR-0077 and ADR-0078. No intake tools in voice channel.

### Future Extension

If voice needs server-side read-only data (e.g., contract status), the recommended approach is a "capability proxy" API route that authenticates, allow-lists specific tools, enforces channel restrictions, and returns the result. This is NOT implemented yet — defer until concrete demand exists.

## Consequences

- Voice Emma cannot create contracts directly. The admin uses chat mode for contract operations.
- Voice Emma CAN look up employees (via `search_profiles_by_name` in chat pipeline) and open entity drawers with correct UUIDs.
- Each new voice tool is a deliberate, reviewed addition — no auto-generation from server capabilities.
