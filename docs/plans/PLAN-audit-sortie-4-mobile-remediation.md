---
title: PLAN — Audit Sortie 4, Mobile Remediation
status: in_progress
created: 2026-05-06
updated: 2026-05-06
module: mobile
tags: [audit, mobile, adr-0132, adr-0134, sortie]
sortie: feat/audit-sortie-4-mobile-remediation
worktree: ~/dev/smartout.ai-wt-9
audit-source: docs/audits/2026-05-06-adr-contract-validation/00-SYNTHESIS.md
---

# Plan: Audit Sortie 4 — Mobile Remediation

## Context

Audit slice 05 (mobile-surface) found 1 CRITICAL + 3 HIGH violating ADR-0132 (web BFF for capability/AI traffic) and ADR-0134 (server-derived workspace_id + actor_id). Mobile-active campaign filter applied — these targets are STABLE files, not in flight.

Audit synthesis: `docs/audits/2026-05-06-adr-contract-validation/05-mobile-surface.md`

## Scope

| # | Surface | Severity | ADR | Fix |
|---|---|---|---|---|
| F1 | `apps/mobile/src/components/ContentCreator.tsx:133` | CRITICAL | ADR-0132 + ADR-0134 | Direct Supabase write → migrate to BFF route + `getProfileContext()` + `emit()` |
| F2 | `apps/mobile/src/hooks/mutations/use-checklist.ts` | HIGH | ADR-0134 / L-0083 | Caller-supplied workspace_id → `getProfileContext()` cross-check |
| F3 | `apps/mobile/src/hooks/mutations/use-create-task.ts` | HIGH | ADR-0134 / L-0083 | Same |
| F4 | `apps/mobile/src/hooks/mutations/use-create-day-info.ts` | HIGH | ADR-0134 / L-0083 | Same |
| F5 | `apps/mobile/src/hooks/mutations/use-log-haccp.ts` | HIGH | ADR-0134 / L-0083 | Same |
| F6 | `apps/mobile/src/hooks/mutations/use-submit-handoff.ts` | HIGH | ADR-0134 / L-0083 | Same |
| F7 | `apps/mobile/src/hooks/mutations/use-report-deviation.ts` | HIGH | ADR-0134 / L-0083 | Same |
| F8 | `apps/mobile/src/hooks/queries/use-botsson-chat.ts:393` | HIGH | ADR-0132 R5 | `chat_message` direct insert → BFF route |
| F9 | `apps/mobile/src/hooks/shift-clock/useShiftChat.ts:65,159` | HIGH | ADR-0132 R5 | Same — 2 sites |

## Out of scope

- Mobile UI sub-sorties currently active on `campaign/mobile` (4tab, calendar-redesign, addsheet, shift-system-polish) — different files, no conflict expected.
- Ultravox dead code in `botsson-provider.tsx` + `BotssonSheet.tsx` — separate cleanup sortie (S4 follow-up).
- ADR-0135 LiveKit voice migration — separate stream.

## Order

1. **F2-F7 first** (6 hooks) — homogeneous mechanical refactor, establish `getProfileContext()` pattern. One commit per hook OR batched by category.
2. **F8-F9 second** (chat_message → BFF) — needs BFF route to exist or be created. May require ADR or extension of existing `/api/emma/chat` BFF route.
3. **F1 last** (ContentCreator) — most complex (CRITICAL, 3 fixes in one site). Apply learnings from F2-F9 patterns.

## Acceptance criteria

For each hook (F2-F7):
- `getProfileContext()` resolves `workspace_id` + `actor_id` BEFORE any mutation or `emit()` call.
- Caller-supplied `workspaceId` payload field either removed (preferred) or cross-checked against `getProfileContext()` value with explicit error on mismatch.
- `emit()` uses resolved context, not payload.
- Typecheck passes per hook.

For F8-F9:
- `chat_message` direct insert removed.
- Send routed via BFF (existing `/api/emma/chat` if it accepts arbitrary messages, else new BFF endpoint with ADR justification).
- Stage-engine becomes single chat-message writer (per ADR-0132).

For F1:
- ContentCreator no longer calls `supabase.from(...)` directly.
- Mutation routes through BFF (or capability tool if appropriate per ADR-0133 — verify content-creation is mobile-execute, not mobile-author).
- `getProfileContext()` for actor_id, server-derived workspace_id.
- `emit()` on success.

## Dependencies / risk

- **`getProfileContext()` helper** lives at `apps/mobile/src/lib/profile-context.ts` per ADR-0134. Throws on missing/empty IDs — fail fast. Verify available + signature before refactor.
- **BFF route for chat_message** may not exist yet. If missing, F8-F9 needs ADR (extends ADR-0132 R5 or new endpoint). Flag if this blocks.
- **Mobile sub-sorties active** on `campaign/mobile` — touch tabs/calendar/addsheet, NOT these hook files per audit slice 05 active-campaign filter. Low conflict risk but verify.
- **ContentCreator may be authoring UI** — per ADR-0133 mobile owns Approve/Execute/Witness, NOT Author/Compose/Plan. If ContentCreator is creating content (authoring), it shouldn't exist on mobile. Verify intent before refactoring; may need to delete or move to web instead.

## Steps

### F2-F7 — 6 hooks getProfileContext sweep

For each hook:
1. Read current file. Find where `workspaceId` arrives from payload.
2. Replace with `const { workspace_id, profile_id } = getProfileContext()` or equivalent.
3. Use resolved values for DB write + emit().
4. If payload still includes workspaceId for caller convenience, add cross-check + throw on mismatch.
5. Verify typecheck.

Pattern reference: per audit slice 05 baseline closures (ShiftTimelineContainer, use-punch, use-swap, use-create-shift), the canonical migration is already shipped — copy pattern.

### F8-F9 — chat_message via BFF

1. Investigate current BFF chat route capabilities. Does `/api/emma/chat` accept generic chat_message inserts, or is it Botsson-specific? Per ADR-0132 it should be the single mobile chat-message conduit.
2. If BFF supports it: refactor `use-botsson-chat.ts:393` and `useShiftChat.ts:65,159` to call the BFF instead of direct Supabase insert.
3. If BFF does NOT support it: STOP + document the gap, propose ADR. Do not invent a new endpoint without architectural review.

### F1 — ContentCreator

1. Read file end-to-end. Understand intent — is it authoring (compose new content) or witnessing (record observation)?
2. If AUTHORING (likely violates ADR-0133): delete on mobile, redirect to web flow. Out of audit scope — flag for separate sortie.
3. If WITNESSING: refactor per F2-F7 pattern + use BFF for write if cross-workspace or AI-related.
4. Apply: getProfileContext + BFF + emit.

## Closure deliverables

- [x] Plan written
- [ ] Journey doc
- [ ] All 9 fixes shipped (or scope-narrowed if F1 is ADR-0133 violation)
- [ ] Typecheck passes
- [ ] HANDOFF written
- [ ] `close-feature.sh 9` run by Pontus

## Estimated wall time

~2-3 days. F2-F7 are mechanical (~30 min each for sonnet). F8-F9 requires BFF route inspection. F1 requires architectural decision (authoring vs witnessing).
