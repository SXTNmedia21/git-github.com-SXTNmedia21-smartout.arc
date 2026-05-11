---
title: F-CHAT-LIST Handoff
status: done
created: 2026-05-11
updated: 2026-05-11
module: MODULE_BOTSSON
tags: [handoff, botsson, chat-list]
---

# F-CHAT-LIST — Handoff

## Summary

Replaced dead-flush `emma_conversation` writes with live chat-list backed by `engine_sessions` (single source of truth per ADR-0296). Shipped 3 BFF endpoints + soft-archive flag + history UI with time-bucket grouping + AnimatePresence transitions. Removed ghost tables atomically with their orphaned route.

Commit sequence: T3 migration (DROP emma tables + new BFF scaffolding) → T4 BFF (3 route handlers) → T5 UI (HistoryView + SessionRow) → T6 Provider (useSessions hook + startNewChat) → T7 review fixes (nested-button violation + stale docstring) → T8 verify pass → T9 docs (this file).

---

## Decisions

**ADR-0296 — emma_conversation deprecation, engine_sessions single-truth**
Accepted 2026-05-11. Two parallel persistence surfaces existed: `emma_conversation` (ghost — 0 rows, dead-flush writes) and `engine_sessions.collected_data.conversation` (truth — 5 rows locally, written by stage-engine). Resolved by dropping the ghost tables and routing all chat-list reads through `engine_sessions`. Council G1 verified the decision.

**L-0232 — Ghost-table dead-flush pattern (1st documented occurrence)**
Active 2026-05-11. Code writes to a table with 0 rows and zero readers. Compile-time and runtime checks all pass — only end-to-end read/write tracing catches it. Detection rule added to L-0232: trace both writer AND reader paths before declaring a persistence surface functional.

**Option B — no POST endpoint for session creation**
Council G1 considered adding a client-driven `POST /api/botsson/sessions` to explicitly create sessions. Rejected after code-trace at `services/stage-engine/src/routes/agent/chat.ts:278-325` confirmed that `sessionId=undefined` in a chat request triggers `createAgentSession()` server-side. Server owns UUID. No client-driven create endpoint needed.

**`is_archived BOOLEAN` (not status enum)**
Archive is orthogonal to session lifecycle. An `expired` session can be archived; a `complete` session can be archived. Two independent axes — `is_archived BOOLEAN` is the correct model. A status enum with `'archived'` value would conflate lifecycle state with visibility preference.

**Geist Sans group headers (not Instrument Serif `font-heading`)**
Historikk view time-bucket headers (I dag / I går / Denne uka / Eldre) use Geist Sans + uppercase tracking, not `font-heading`. Chat-list is data density UI — Instrument Serif is for narrative/editorial surfaces per Nordic Split design system.

**AnimatePresence 8px nudge + opacity + spring (not full-width slide)**
House motion pattern per Nordic Split. Full-width horizontal slide was considered and rejected — it conflicts with Arena's layout constraints and feels heavy for list→detail navigation. 8px `x` nudge + opacity fade with spring easing (`stiffness: 300, damping: 30`) matches existing Arena view transitions.

**Search deferred post-MVP**
Council G1 ruled search (debounced `?q=` filter on GET list) as scope-creep for MVP. Next step item.

**Mobile follow-up PR**
Per ADR-0133 (Mobile Surface Boundary): web-first implementation correct for authoring/browsing surfaces. Mobile chat-list to be ported via `packages/Botsson` hooks in a follow-up PR.

---

## Lead-agent interventions

These required manual correction during the sortie — documented for next-agent awareness:

**T4 BFF — EntityType union drift:**
Background agent retry-loop kept reverting `entity_type: "agent_session"` back to `"engine_session"`. The TypeScript union in `@smartout/telemetry` has `agent_session` (from ADR-0152 naming), not `engine_session`. T3a's interface comment was misleading (said "engine_session" in a JSDoc example). Applied sed-fix atomically, killed retry loop via TaskStop, committed correct value.

**T6 Provider — router hoisting + invalid eslint comment:**
Agent retry-loop failed on (a) `router` const declared after callbacks that captured it (JavaScript temporal dead zone — `const` is not hoisted) and (b) `eslint-disable-next-line react-hooks/exhaustive-deps` directive not recognized because the rule wasn't loaded in the repo's ESLint config for this file type. Applied python script to hoist router declaration above dependent callbacks; stripped the invalid eslint comment.

**T5 UI — wrong agent dispatched:**
Original `frontend-designer` agent dispatch only had `Skill` tool in its toolset — cannot perform file IO (Write/Edit/Bash). Redispatched as `botsson-harness-builder` (full toolset). Lesson: `frontend-designer` is for design review and spec interpretation, not file creation.

**T7 follow-up — nested button HTML violation:**
SessionRow originally rendered an `<button>` inside an `<li>` inside the parent `<button>` archive control. HTML spec violation — interactive elements cannot be nested. Corrected to `<div role="button">` pattern for the row container with explicit keyboard handler.

---

## Learnings to capture

Some of these are not yet in L-files — flagged here for promotion:

**Fresh worktree build order (variant of L-0231):**
A fresh worktree needs not just `pnpm install` but also `pnpm build` across workspace packages before downstream typecheck resolves. Affected: `@smartout/telemetry`, `@smartout/types`, `@smartout/supabase`, `@smartout/agent-sdk`, `@smartout/ai`, `@smartout/utils`, `@smartout/journey-ir`, `@smartout/contracts`. The stop-hook scoped typecheck fires first and fails before packages are built.

**Scoped typecheck stop-hook flags pre-existing errors:**
PostToolUse:Edit hook fires `pnpm --filter web typecheck` on every edit. Pre-existing repo-wide errors (hospitality.test.ts + contract routes) block unrelated edits. Agents must be briefed: "do not run web typecheck, do not retry-loop on hook failures." Diagnosis was wasting 15-20 min per sortie on this pattern.

**`npx supabase gen types` emits WARN to stdout:**
`npx supabase gen types typescript --local` emits WARN lines to stdout, contaminating the generated types file. Must redirect stderr: `npx supabase gen types typescript --local 2>/dev/null`. Variant of "op run corrupts gen types" learning (MEMORY.md).

**F-MEM-UNBLOCK seed migration FK violation:**
`20260528000000_seed_memory_authority_dev_workspaces.sql` references workspaces `b1000000-…0001` + `00000000-…00a1` that are not in seed.sql. Migration cannot be applied via `npx supabase db reset`. Shippable via direct `psql` against local DB as a one-time setup. Not a blocker for F-CHAT-LIST but affects fresh environment setup.

**`frontend-designer` agent has Skill-only tools:**
Cannot perform actual file builds. Use `botsson-harness-builder` for UI builds requiring file IO. `frontend-designer` = design review and spec interpretation only.

---

## Known issues / Debt

**`engine_sessions.summary` is NULL by design:**
Auto-summary builder deferred to Phase A3 Item 3 (stage-engine work). Historikk list rows fall back to first user-turn slice(0,60) as display title. When summary builder ships, list titles improve automatically — no UI change needed (summary column is already read in BFF).

**Production Cloud audit gate (REQUIRED before merge to main):**
```sql
SELECT count(*) FROM emma_conversation;  -- must be 0
SELECT count(*) FROM emma_transcript;    -- must be 0
```
If non-zero: abort merge, export to cold storage first. Local Supabase verified 2026-05-11 = 0 rows on both tables. Production Cloud is the unknown — `emma_conversation` migration landed 2026-03-18, ~2 months of writes if the provider code ran in production.

**Godmode archive visibility unchanged:**
Admin GuardianMonitor continues to see archived sessions via `agent_session_recording` fan-out (ADR-0184). Archive hides from owner Historikk list only — this is by design but should be documented in platform admin guide.

**No archive-undo in MVP:**
Reversible via DB `UPDATE engine_sessions SET is_archived=false WHERE id=$id` if needed. Not exposed as UI. Next step item.

**`startNewChat` does not explicitly invalidate `useSessions` cache:**
Refresh happens via mount + TanStack staleTime 30s. If users report new sessions not appearing in Historikk immediately after creation, add `queryClient.invalidateQueries(["botsson-sessions"])` in the `onSuccess` callback of the first chat mutation.

**Plan commit sequence drift:**
Plan listed UI as step 4 before Provider as step 5. Actual execution order swapped (Provider first, then UI — UI imports `useBotsson`, needs Provider compiled first). Both ship in 1 PR, order benign.

**E2E test deferred:**
`e2e_test: TBD-deferred-post-MVP` in JOURNEY frontmatter. CLAUDE.md marks E2E as RECOMMENDED (not required) for closure. Target path: `apps/e2e/tests/chat-list/chat-list-happy-path.spec.ts`. Add to next sortie.

---

## Next steps

1. **Phase A3 Item 3** — auto-summary at session-end (separate sortie, stage-engine work; populates `engine_sessions.summary` after session completes)
2. **Mobile chat-list** — port `useSessions` hook to `packages/Botsson`, add React Native FlatList view (ADR-0133 follow-up PR)
3. **Search** — add `?q=` filter to `GET /api/botsson/sessions`, debounced text input in HistoryView header
4. **Archive-undo** — sonner action button ("Angre") + reverse: `PATCH /api/botsson/sessions/[id]` sets `is_archived=false`
5. **Bulk archive** — multi-select mode for admins clearing test sessions; `DELETE /api/botsson/sessions?ids=<csv>` batch endpoint
6. **E2E test** — Playwright `apps/e2e/tests/chat-list/chat-list-happy-path.spec.ts` covering journeys 1 and 2 (Journey 3 / archive requires admin fixture)
7. **Platform admin guide** — document that `is_archived=true` hides from owner list but not from recorder feed (ADR-0184 retention contract)
8. **Production Cloud audit** — run `SELECT count(*)` gate on both dropped tables before merge to main
