---
title: HANDOFF — Audit Sortie 4, Mobile Remediation
status: review
created: 2026-05-06
updated: 2026-05-06
module: mobile
tags: [audit, mobile, adr-0132, adr-0134, sortie, handoff]
sortie: feat/audit-sortie-4-mobile-remediation
worktree: ~/dev/smartout.ai-wt-9
audit-source: docs/audits/2026-05-06-adr-contract-validation/00-SYNTHESIS.md
---

# HANDOFF: Audit Sortie 4 — Mobile Remediation

## Summary

Closes audit slice 05 mobile findings: 6 caller-supplied-ID hooks migrated to `getProfileContext()`, ContentCreator triple-violation fixed (witnessing case, no BFF routing path needed). 1 finding (F8 `use-botsson-chat:393` chat_message direct insert) BLOCKED on ADR — no BFF route accepts chat_message writes. 1 finding (F9 `useShiftChat:65/:159`) AUDIT LABEL ERROR — those lines are reads, not writes; real write is on different table (`channel_message`).

## Fixes shipped

| # | Commit | What |
|---|---|---|
| F2 | `9666adf08` | `use-checklist.ts` + caller (`ChecklistView.tsx`) — getProfileContext + drop caller payload IDs |
| F3 | `8f7641e50` | `use-create-task.ts` + caller (`create-task.tsx`) |
| F4 | `aac707e88` | `use-create-day-info.ts` + caller (`CreateDayInfoSheet.tsx`) |
| F5 | `93aae1676` | `use-log-haccp.ts` + 2 callers (`haccp.tsx`, `HACCPForm.tsx`) |
| F6 | `44dad324c` | `use-submit-handoff.ts` + 2 callers (`ShiftClockView.tsx`, `HandoffForm.tsx`) |
| F7 | `779fd3ce2` | `use-report-deviation.ts` + 3 callers (`deviation.tsx`, `safety-round.tsx`, `DeviationForm.tsx`); also fixed direct `nonEmpty()` emit in safety-round.tsx |
| F1 | `3e1b361d8` | `ContentCreator.tsx` — getProfileContext + emit (witnessing case per ADR-0133) |
| F8 | `7ce5ac475` | Blocker doc only — `use-botsson-chat.ts:393` direct insert needs ADR for BFF route extension |

Branch: `feat/audit-sortie-4-mobile-remediation`. Worktree: `~/dev/smartout.ai-wt-9`. Base: plan + journeys at `57fab0482`.

## Architectural decisions

### F1 ContentCreator: WITNESSING, not authoring (ADR-0133 verified)

ContentCreator on mobile is a witnessing surface (employee submits spokesperson content per D6 task), NOT an authoring surface. Per ADR-0133 ("web composes, mobile executes"), witnessing is mobile-allowed. Refactored to:
- `getProfileContext()` for actor_id + workspace_id (ADR-0134)
- `emit({ event: "website spokesperson_content_submitted", ... })` (ADR-0004 — used existing registered event, no new entry needed)
- Direct Supabase write retained as Phase B placeholder — no BFF route exists for spokesperson content; extending BFF deferred (see F8 below for the same blocker class).

### F8 chat_message direct insert: BLOCKED on ADR

`use-botsson-chat.ts:393` inserts directly to `chat_message`. Per ADR-0132 R5, stage-engine should be the SOLE writer to chat_message. No BFF route currently accepts chat_message writes — the existing `/api/emma/chat` BFF only handles AI conversation flow (request → LLM → response), not arbitrary message persistence.

Two architectural options documented in `docs/sortie-4-blocker-f8-f9.md`:
- **Option A** (recommended): extend `/api/emma/chat` BFF to write conversation history server-side. Mobile sends user message; BFF writes user message + AI response.
- **Option B**: new `/api/mobile/chat-history` BFF for arbitrary message persistence. Less coupled to AI-specific concerns.

Both need ADR before implementation. Sortie 4 commits the blocker doc; future sortie picks up.

### F9 useShiftChat: audit label error

Audit slice 05 H2 listed `useShiftChat.ts:65,159` as `chat_message` direct inserts. Verification:
- Line 65 is a SELECT (read).
- Line 159 is a Realtime subscription (read).
- Neither is a write to chat_message.

Real write at `useShiftChat.ts:238` is `enqueue("send_message")` which writes to `channel_message` (not `chat_message`) with caller-supplied `sender_id`. This IS an H1-class forgeable-attribution finding, but its target table is different and the fix path runs through `mobile-channel-message` campaign (M4 sub-sortie active per audit slice 05 active-campaign filter). Out of S4 scope.

Audit synthesis should be updated post-merge to correct the H2 evidence pointer.

## Verification

```bash
cd ~/dev/smartout.ai-wt-9
pnpm turbo typecheck --filter=@smartout/mobile
# → 5/5 successful, 0 errors
```

## Learnings

### L-NEW-1 — Caller-payload propagation pattern requires sweep, not point fix

Each `use-X.ts` hook removal of caller-supplied IDs (`workspace_id`, `profile_id`, `actor_id`, `created_by`, `reported_by`) cascades to 1-3 caller files passing those keys. TypeScript catches them via TS2353 "object literal may only specify known properties" — but the Stop hook treats this as a blocker, causing iterative cycles (1 hook fix → caller errors → caller fix → typecheck → next hook).

**Why:** Each hook has a `Payload` type. Removing a field from the type breaks all call sites. Mechanical follow-up but adds 1 iteration per caller.

**How to apply:** Future hook-refactor sorties should grep for caller usage BEFORE the hook edit:
```bash
grep -rn "useChecklist\|useCreateTask\|useLogHaccp" apps/mobile/src apps/mobile/app | grep -v "\.ts:"
```
Then refactor hook + all callers in one pass. Avoids per-iteration Stop hook noise. Promote pattern: build agents touching shared types should map call sites first.

### L-NEW-2 — Audit label errors do happen — verify on read

F9 listed lines 65+159 of `useShiftChat.ts` as direct `chat_message` writes. Both are reads. The real write is on a different table (`channel_message`) at a different line (238). Build agent caught this on file read; an automated fixer wouldn't have. Post-fix, audit synthesis at `docs/audits/2026-05-06-adr-contract-validation/05-mobile-surface.md` H2 evidence is partially incorrect.

**Why:** Slice agents identify findings by pattern-matching, not always by tracing into the function. Line numbers can drift between audit run and fix sortie if file changes intervene; in this case, the lines never matched the claim.

**How to apply:** Build agents must verify audit findings on the actual file content before refactoring. If the finding doesn't match, write a correction note in the HANDOFF (this practice). Don't blindly refactor based on synthesis alone.

### L-NEW-3 — Architectural fixes need ADR; build agent should STOP, not invent

F8 (chat_message → BFF) had no shipped BFF route to migrate to. Two options exist; both need architectural review (ADR). Build agent correctly STOPPED + wrote blocker doc rather than inventing a new endpoint. This is the right behavior — `learning_no_unilateral_pipeline_actions` from session memory plus ADR-0132's load-bearing nature mandate it.

**How to apply:** Any sortie touching architectural seams (BFF routes, capability boundaries, gate orchestrators, telemetry routing) should explicitly tell the build agent: "If the migration target doesn't exist, STOP + write blocker doc. Do not invent." Already in S4 dispatch prompt — keep pattern.

## Known issues / debt

- **F8 chat_message direct insert OPEN.** Pontus picks Option A vs B in `docs/sortie-4-blocker-f8-f9.md`. Likely 1-2 day sortie post-decision.
- **F9 channel_message sender_id forgery** — separate from F8. Tracked in M4 mobile sub-sortie. Not S4's scope but flagged for visibility.
- **ContentCreator BFF Phase B** — F1 closed via getProfileContext + emit, but the underlying ADR-0132 R5 violation (direct supabase write bypassing BFF) is partially deferred. Same blocker class as F8 — needs spokesperson-content BFF route. Document in M-content-pipeline if/when BFF route designed.
- **6 hooks now have stricter Payload contracts** — caller-supplied workspace_id/profile_id rejected at type level. Any future caller passing those keys gets TS2353. Worth adding to mobile dev README.

## Next steps

### Pre-merge (Pontus)
1. Review 9 commits on `feat/audit-sortie-4-mobile-remediation`.
2. Read `docs/sortie-4-blocker-f8-f9.md` — pick Option A or B for chat_message BFF, or queue ADR drafting.
3. `pnpm turbo typecheck --filter=@smartout/mobile` — already passing.
4. `close-feature.sh 9` to merge to development.

### Post-merge
- F8 follow-up sortie (pick Option A or B; ~1-2 days). Closes the chat_message direct-insert finding.
- F1 Phase B (spokesperson BFF) — same architectural pattern, can bundle with F8 if Option A chosen.
- Update audit synthesis 00-SYNTHESIS.md + 05-mobile-surface.md to correct F9 H2 line numbers (post-merge documentation cleanup).

## Closure deliverable status

- [x] Plan: `docs/plans/PLAN-audit-sortie-4-mobile-remediation.md`
- [x] Journeys: `docs/journeys/JOURNEY-audit-sortie-4-mobile-remediation.md`
- [x] F2-F7 (6 hooks) shipped + verified
- [x] F1 (ContentCreator) shipped (witnessing)
- [x] F8 blocker documented
- [x] F9 audit label correction documented (no code change needed)
- [x] Typecheck 5/5 pass
- [x] HANDOFF (this file)
- [ ] No new ADRs needed in this sortie; F8 ADR queued for follow-up
- [ ] `close-feature.sh 9` — Pontus runs after pre-merge checks above
