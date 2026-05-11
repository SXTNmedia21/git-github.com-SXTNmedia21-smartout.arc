---
id: ADR_0296
title: "emma_conversation deprecation — engine_sessions single-truth for chat persistence"
status: accepted
layer: decision
created: 2026-05-11
updated: 2026-05-11
module: MODULE_BOTSSON
tags: [decisions, adr, botsson, chat, persistence, deprecation]
---

# ADR-0296: emma_conversation deprecation — engine_sessions single-truth for chat persistence

## Context

Two parallel chat-persistence surfaces exist in the codebase, only one of which works:

1. **`emma_conversation` + `emma_transcript`** — created by migration `20260318130100_emma_conversation.sql`. Single consumer: `BotssonProvider.tsx:778-855` POSTs transcript buffer to `/api/emma/history` route. **Tables hold 0 rows** (verified 2026-05-11 on local DB). The route reads them and always returns empty. Effective state: dead-flush writes to ghost table, route returns nothing.

2. **`engine_sessions.collected_data.conversation`** — written by `services/stage-engine/src/routes/agent/chat.ts:332,395` via `append_conversation_turn` RPC. **5 rows locally for `mode='agent'` chat sessions.** This is where real conversation history lives. Loaded by `chat.ts:307` via `loadAgentSession()` on subsequent turns.

The dual-surface state was discovered during F-CHAT-LIST G1 council 2026-05-11 — T1 pre-flight by botsson-harness-builder confirmed three independent conversation-states with no synchronisation:
- `agent.transcript` in-memory ref (per-render only)
- `emma_conversation` ghost table (write-only target, never read by stage-engine)
- `engine_sessions.collected_data.conversation` (truth)

## Decision

**`engine_sessions` is the single source of truth for chat conversation persistence.** `emma_conversation` and `emma_transcript` are deprecated and removed.

Specifically:

1. **Drop tables** — `DROP TABLE emma_transcript CASCADE` + `DROP TABLE emma_conversation CASCADE` in the F-CHAT-LIST migration (T3). RLS policies + indexes drop with CASCADE.
2. **Delete route** — `apps/web/src/app/api/emma/history/route.ts` removed in the same commit as the migration. Same commit boundary prevents orphan route pointing at dropped table (production runtime would 500 otherwise).
3. **Remove dead-flush callers** — `BotssonProvider.tsx:778, 795, 818` functions `startConversation`, `appendTranscript`, `endConversation` deleted entirely (not stubbed). JSDoc deleted alongside function bodies (L-0176 5th-occurrence avoidance — docstring claiming "persists to emma_conversation" on a function that no longer exists is a phantom contract).
4. **New chat-list BFF** — `/api/botsson/sessions/*` family (GET list, GET :id, DELETE) reads `engine_sessions` directly. Predicate filter: `mode='agent' AND channel='chat' AND is_archived=false AND workspace_id = $resolved_ws AND profile_id = auth.uid()`.

## Consequences

**Positive:**
- Single canonical surface eliminates drift class. Future Claude reading the codebase finds one persistence path, not two.
- Cascade integrity preserved per ADR-0216 (three-table ontology — `engine_sessions` is the chat-thread surface; this decision reinforces ADR-0216 by removing a parallel registry).
- Session recorder coupling unchanged — `agent_session_recording` has no FK from `session_id` to `engine_sessions`; ADR-0184 retention contract preserved.
- ADR-0163 fail-closed `allowedChannels` mandate unchanged — F-CHAT-LIST is BFF + UI only, no capability tools added.

**Negative:**
- Destructive migration (DROP TABLE CASCADE). Recoverable via re-run of `20260318130100_emma_conversation.sql` if needed, but production audit before Cloud merge is the discipline gate.
- Any future "save Emma's chat history" feature that would have re-used `emma_conversation` must instead extend `engine_sessions.collected_data.conversation` or add a new column on `engine_sessions`. This is the right constraint, not a bug.

## Alternatives considered

- **Keep both tables, sync them** — rejected. Two write surfaces with no enforcement = guaranteed drift. The pattern that produced this ghost was exactly this.
- **Keep `emma_conversation`, remove `engine_sessions.collected_data.conversation`** — rejected. Stage-engine is the canonical conversation owner; web-only emma tables are the leaf, not the root.
- **Status enum `'archived'` value instead of `is_archived BOOLEAN`** — rejected. Archive is orthogonal to lifecycle (an `expired` session can be archived; a `complete` session can be archived). Two axes, not one. `is_archived BOOLEAN` is correct.

## References

- F-CHAT-LIST G1 Council 2026-05-11
- T1 pre-flight `botsson-harness-builder` 2026-05-11
- ADR-0216 engine_state vs engine_sessions ontology
- ADR-0184 Session Recorder
- ADR-0163 PII allowedChannels mandatory
- L-0232 Ghost-table dead-flush pattern

---

> After writing: register in `docs/decisions/0000-decision-log.md` and update the ADR table in `CLAUDE.md`.
