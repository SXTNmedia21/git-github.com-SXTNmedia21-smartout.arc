---
id: L_0232
title: "Ghost-table dead-flush pattern — code writes to table with 0 rows + zero readers"
status: active
created: 2026-05-11
updated: 2026-05-11
module: MODULE_BOTSSON
tags: [learning, anti-pattern, persistence, drift, l-0176-class]
related: [L-0176, L-0177, L-0229]
---

# L-0232 — Ghost-table dead-flush pattern

## Pattern

Code writes data to a table that:
1. Has 0 rows in production
2. Has zero readers (no SELECT consumer in any service)
3. Was created by a migration but never integrated into the runtime flow

The writer code appears correct (table exists, INSERT succeeds, no errors logged). The data is structurally persisted. **But nothing ever reads it**, so the data is effectively discarded. UX surface that depends on this data appears broken even though no error path is hit.

## Concrete example (2026-05-11, F-CHAT-LIST G1 council)

`emma_conversation` + `emma_transcript` tables created by migration `20260318130100_emma_conversation.sql`. Sole writer: `BotssonProvider.tsx:778-855` (`startConversation`, `appendTranscript`, `endConversation`) POSTs transcript buffer to `/api/emma/history` route. Route INSERTs into the tables.

But:
- `services/stage-engine/` never reads `emma_conversation` — it reads `engine_sessions.collected_data.conversation` instead
- `apps/web/src/app/api/emma/history/route.ts` GET handler reads `emma_conversation` and always returns empty (0 rows)
- `apps/web/src/app/Botsson/_components/BotssonArena.tsx:2434` HistoryView reads `agent.transcript` in-memory ref, never DB

Result: chat history appears to "persist" (no errors) but vanishes on refresh. Three independent conversation-states with no synchronisation — `agent.transcript` (in-memory), `emma_conversation` (ghost), `engine_sessions.collected_data.conversation` (truth).

## Why this slips through

- **Per-file review misses it.** The writer file looks correct. The route file looks correct. The migration file looks correct. Only end-to-end tracing of BOTH write AND read paths catches the drift.
- **Compile-time checks pass.** Table exists in `database.types.ts`. Function signatures match. TypeScript happy.
- **No runtime error.** INSERT succeeds. Route returns 200. UI renders the in-memory transcript and looks alive until refresh.
- **Tests are local-scoped.** If tests cover "POST /api/emma/history returns 200", they pass. They don't cover "transcript I just POSTed appears when I GET /api/emma/history" — and even that wouldn't catch the deeper issue (data persists, just nothing consumes it).

## Detection (preflight rule)

When reviewing any persistence surface, trace BOTH directions:

1. **Find every writer** — `grep .insert("table_name"` + `INSERT INTO table_name` + `.from("table_name").insert`
2. **Find every reader** — `grep .select("` + `.from("table_name").select` + `FROM table_name` (excluding migrations)
3. **Verify row count in production** — `SELECT count(*) FROM table_name` against representative DB
4. **If writers exist but readers don't OR row count is 0 after months of writes:** ghost-table risk. Either delete the writer + table OR wire a reader.

## Promotion criteria

Promote to mandatory preflight rule (in `superpowers:writing-plans` or `botsson-harness-builder` agent description) if pattern reappears 3 times across different surfaces. First occurrence today: `emma_conversation`/`emma_transcript`. Watch for repeat.

## Related learnings

- **L-0176** — docstring vs body drift. Same class: claim diverges from reality. Ghost-table is "writer claims persistence, persistence is real but consumer is missing." L-0176 is "docstring claims X, body does Y." Both are gap-between-claim-and-reality patterns.
- **L-0177** — silent body-supplied row fallback. Same class: silent failure mode, no error logged.
- **L-0229** — capability-count source-of-truth drift. Same class: parallel registries / parallel surfaces diverge.

## How to fix when detected

Two options:
1. **Delete ghost** — drop table, remove writer code AND docstring AND any caller. Document via ADR (as ADR-0296 does for `emma_conversation`).
2. **Wire consumer** — if the data is needed somewhere, add the missing reader and update consumers. Don't leave it half-wired.

Never leave ghost-table dead-flush in place "for now." Each release that ships the pattern increases the cost of unwinding it (more callers accumulate, more docstrings drift).

## References

- F-CHAT-LIST G1 Council 2026-05-11
- T1 pre-flight by botsson-harness-builder 2026-05-11
- ADR-0296 emma_conversation deprecation

---

> After writing: register in `docs/learnings/0000-learning-log.md`.
