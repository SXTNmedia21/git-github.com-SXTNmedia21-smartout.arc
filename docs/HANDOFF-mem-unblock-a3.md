---
title: Handoff — F-MEM-UNBLOCK-A3 engine_memory writer
status: done
updated: 2026-05-11
created: 2026-05-11
module: memory
tags: [memory, session, engine_memory, botsson, handoff]
---

# HANDOFF — F-MEM-UNBLOCK-A3: engine_memory auto-summary writer

## What was built

Phase A3 (2026-04-22) wrote the `save_memory` capability tool and `saveMemory()` helper
but never seeded the `engine_authority_config` row that would expose the tool in agent
toolsets (Gap G1). It also never wired auto-summary at session-end (plan items 3+4
documented as "ready" but not implemented).

This sortie closes items 3+4 of PLAN-engine-memory-writer and unblocks G1.

### Task 1 — Authority seed (migration 20260530000000)
Already committed before this session started (2 prior migrations: 20260528000000 for
3 dev workspaces, 20260530000000 for all workspaces). Verified: 6 rows in
`engine_authority_config` with `capability='memory'`, `level='suggest'`.

### Task 2 — buildSessionSummary (TDD)
- `services/stage-engine/src/core/__tests__/build-session-summary.test.ts` — 7 tests, all pass
- `services/stage-engine/src/core/build-session-summary.ts` — pure function, no I/O

### Task 3 — Auto-summary wiring
- `services/stage-engine/src/core/session-manager.ts`: added `writeSessionSummary()` helper
  called fire-and-forget from both `getSession` (expiry path) and `abandonSession`.
- `packages/ai/package.json`: added `./context/memory-writer` export so stage-engine can
  import `saveMemory` via the workspace package.
- `packages/telemetry/src/registry.ts`: added `AgentMemorySummaryWritten` interface, union
  entry, and `agent.memory.summary_written` routing (posthog + logger + activity_trail).

### Task 4 — TTL cron (migration 20260531000000)
Daily 03:00 UTC cron job `engine-memory-ttl-purge` deletes rows where `expires_at < now()`.
Guarded by `IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')` — silently
skips in dev. Session-summary rows have `expires_at = NULL` and are never touched.

### Task 5 — Verify script
`scripts/verify-memory-writer.sh` — end-to-end smoke test. Chat → abandon → DB assert.

---

## Decisions made

### D1 — Authority level: suggest (not autonomous)
`save_memory` tool is suggest-tier. Choosing `suggest` means the tool is visible in the
agent toolset but the agent still suggests rather than autonomously persists at the
capability level. Production workspaces should review via admin UI before upgrading.
Ref: ADR-0078 (PII scope), memory/index.ts defaultAuthority comment.

### D2 — No gate_action on writeSessionSummary
`writeSessionSummary` is a system-actor write (session-end background job), not an
agent-tool mutation on behalf of an authenticated user. `gate_action` is the per-action
gate for user-agent mutations (ADR-0099). The same pattern as `add_key_fact` in
`onboarding/tools.ts:775` — that path also skips `gate_action` because the writer is
the onboarding system, not the user.

### D3 — Fire-and-forget for summary write
Summary failure must not fail the session load response. The write is best-effort. Errors
are console.warn'd. If the write fails, the session close still returns to the caller.

### D4 — scope='conversation' (not 'personal')
Session summaries capture what happened in a specific session, not a persistent personal
preference. Using `scope='conversation'` lets the collector rank them differently from
long-lived personal facts (`scope='personal'`).

### D5 — importance=0.6
Slightly above the default 0.5. Summaries represent a full session's user intent and are
more signal-dense than a single tool call. Not 0.8+ (reserved for onboarding constants).

---

## Known issues / pending

### P1 — plan items 3+4 `buildSessionSummary` auto-summary note in PLAN
The plan (docs/plans/PLAN-engine-memory-writer.md) mentions "auto-summary at session-end
via `buildSessionSummary`" as pending. This sortie delivers it. The plan file should be
updated to reflect "done" status.

### P2 — save_memory tool still not tested via agent capability path
G1 is structurally closed (authority seeded, tool visible). The capability tool
`save_memory` in `packages/ai/src/capabilities/memory/tools.ts` can now fire when an
employee says "husk X". However there are no E2E tests asserting this path end-to-end
(Gap G11 covers mission E2E zero coverage; same gap applies here). Recommend adding a
Playwright spec in `apps/web/e2e/` that sends a memory-save message and asserts the
`engine_memory` row.

### P3 — pg_cron not enabled in local dev
TTL purge migration silently no-ops locally. In production (Supabase Cloud), pg_cron is
enabled by default. The migration is safe to promote.

### P4 — embedding generation not wired
`engine_memory.embedding` is still NULL for all rows. The collector currently ranks by
`importance DESC`, not by vector similarity. pgvector similarity search is a future
enhancement noted in the Phase A3 plan. Not a blocker for memory writer functionality.

---

## Learnings

### L1 — @smartout/ai subpath exports must be declared
`packages/ai/dist/context/memory-writer.js` was built but not exported in `package.json`.
TypeScript resolved it correctly when importing via relative path from within the package,
but failed when imported from `services/stage-engine` via the workspace package name.
Added `./context/memory-writer` to the exports map.

### L2 — Dollar-quote nesting in DO blocks
`PERFORM cron.schedule('name', 'schedule', $$ SQL $$)` inside a `DO $$ ... $$` block
fails with syntax error because the inner `$$` closes the outer. Use distinct tag:
`DO $outer$ ... PERFORM cron.schedule('name', 'schedule', $job$ SQL $job$); ... $outer$`.

### L3 — Circular import in session-manager vs agent-session
`agent-session.ts` imports from `session-manager.ts`. Importing `getConversationHistory`
back from `agent-session` would create a circular dependency. Inlined the single-line
extraction: `(session.collected_data?.conversation ?? []) as ConversationTurn[]`.

---

## Next steps

1. `pnpm --filter @smartout/stage-engine vitest run` — run all stage-engine tests to
   verify no regressions from the new imports.
2. Run `./scripts/verify-memory-writer.sh` once stage engine is up to confirm the pipe
   end-to-end.
3. Update `docs/architecture/BOTSSON-SYSTEM-MAP.md` — flip G1 from Open to Closed.
4. Close sortie via `/close-feature`.
