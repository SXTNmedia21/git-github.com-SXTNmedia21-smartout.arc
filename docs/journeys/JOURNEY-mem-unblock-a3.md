---
title: Journey — engine_memory writer unblock (F-MEM-UNBLOCK-A3)
feature: mem-unblock-a3
status: verified
updated: 2026-05-11
created: 2026-05-11
module: memory
tags: [memory, agent, session, engine_memory, botsson]
---

# Journey: Employee — "husk at jeg liker kaffe svart"

**Feature:** F-MEM-UNBLOCK-A3 — engine_memory auto-summary writer
**Status:** verified

---

## Journey: Employee Sends a Memory-Worthy Message

**Precondition:**
- Workspace has `engine_authority_config` row: `capability='memory'`, `level='suggest'`
- Employee profile is active in that workspace
- Stage engine is running; agent session exists or is auto-created on first chat turn

1. Employee types "husk at jeg liker kaffe svart" in the Botsson chat overlay.
   → BFF receives `POST /api/botsson/chat` with `message`, `profile_id` (JWT-derived), `workspace_id`.
   → BFF forwards to stage engine `POST /agent/chat`.
   → `chat.ts` resolves or creates an agent session (`createAgentSession`).
   → `appendConversationTurn` writes the user turn to `collected_data.conversation`.
   → Agent router processes the message (capability routing, LLM call).
   → Assistant turn appended. Response returned to user.
   → User sees a reply from Botsson.

2. Session ends — either expires (24h TTL) or user/BFF sends abandon.
   → `getSession` detects expiry OR `abandonSession` is called.
   → `writeSessionSummary(session, "expired"|"abandoned")` is called (fire-and-forget).
   → `buildSessionSummary(conversation)` extracts user turns, truncates to 1000 chars.
   → `saveMemory(...)` inserts a row: `memory_type='summary'`, `scope='conversation'`, `importance=0.6`.
   → `emit("agent.memory.summary_written", ...)` fans out to posthog + logger + activity_trail.

**Postcondition:**
- `engine_memory` has a row with `memory_type='summary'`, `source_session_id=<session_id>`.
- Row content contains the user's message text ("husk at jeg liker kaffe svart").
- `activity_trail` has an `agent.memory.summary_written` entry for audit.

**Error paths:**
- `profile_id` is null on session: `writeSessionSummary` returns early, no write, no emit.
- Summary is empty (all-assistant session): no write, no emit.
- `saveMemory` returns `{ ok: false }`: console.warn logged, no crash, session close proceeds.
- `emit` throws: caught by fire-and-forget `.catch`, logged, session close proceeds.

---

## Journey: Next Session — Memory Feeds Into Prompt

**Precondition:** Employee has at least one `engine_memory` row from a prior session.

1. Employee starts a new chat session.
   → `collectContext()` in `packages/ai/src/context/collector.ts` queries top-10 memories by `importance DESC`.
   → Memories are injected into the system prompt under `<memories>` block.
   → Botsson greets the employee already knowing "liker kaffe svart".

**Postcondition:** Botsson responds in a way that reflects prior conversation context without the user needing to repeat themselves.

---

## Journey: Ops — Manual Verification

**Precondition:** Stage engine and Supabase local are running.

1. Run `./scripts/verify-memory-writer.sh`
   → Script resolves workspace_id + profile_id from a workspace with memory authority.
   → POSTs a chat turn with "husk at jeg liker kaffe svart".
   → Abandons the session.
   → Queries `engine_memory` for a `summary` row.
   → Asserts content contains the user message text.

**Postcondition:** Script exits 0, prints "All assertions passed."

**Error paths:**
- No workspace with memory authority: script exits 1 with "Run the memory authority migration first."
- Stage engine not running: `curl` returns connection refused, script exits 1.
