---
title: "Plan — Sortie 4 mobile-kalender-task-wire"
slug: sortie-4-mobile-kalender-task-wire
status: done
revision: v2
layer: plan
created: 2026-05-13
updated: 2026-05-13
spec: docs/superpowers/specs/2026-05-13-sortie-4-mobile-kalender-task-wire-design.md
adr: ADR-0298
sortie_adr_reserved: ADR-0302
target_branch: feat/mobile-kalender-task-wire
target_worktree: ~/dev/smartout.ai-wt-8
tags: [sortie-4, plan, mobile, kalender, fab, ADR-0298, ADR-0302]
---

# Plan — Sortie 4 mobile-kalender-task-wire (v2)

> Branch: `feat/mobile-kalender-task-wire` | Worktree: `~/dev/smartout.ai-wt-8` | Base: `development`

## Goal

ADR-0298 row 4 closure. FAB tap=home, swipe-up=stacked AddSheet+BotssonSheet, DetailSheet onComplete wired to task.complete BFF, operations.tsx TODO killed.

## Pre-flight

- [ ] P.1 — Main repo `development` clean
- [ ] P.2 — Spec + plan committed on development
- [ ] P.3 — ADR-0302 slot free
- [ ] P.4 — `new-feature.sh mobile-kalender-task-wire 8 cascade` spawns wt-8
- [ ] P.5 — Pre-warm install + dist build

## Phase 1 — Pre-flight greps + warm

- [ ] T1.1 — `pnpm install --frozen-lockfile`
- [ ] T1.2 — `pnpm turbo build --filter=@smartout/telemetry --filter=@smartout/types --filter=@smartout/supabase --filter=@smartout/ai`
- [ ] T1.3 — Re-grep canonical reality per spec §3
- [ ] T1.4 — Verify `/api/mobile/tasks` POST route shape (spec §4.8)
- [ ] T1.5 — `pnpm turbo typecheck` baseline green

## Phase 2 — AIFab gesture surface

- [ ] T2.1 — Rewrite `apps/mobile/src/components/navigation/AIFab.tsx` per spec §4.4: View + PanResponder, props `{ onTap, onSwipeLayer1, onSwipeLayer2 }`. Thresholds 80/160px. Drop onLongPress.
- [ ] T2.2 — Tap/swipe disambiguation: tap = `|dy| < 5 && |dx| < 5 && elapsed < 250ms`.
- [ ] T2.3 — Visual: scale 0.96 on press-in, scale 1.0 release.
- [ ] T2.4 — Update TabBar.tsx if it directly imports old AIFab props.
- [ ] T2.5 — `pnpm --filter @smartout/mobile typecheck` green
- [ ] T2.6 — Commit: `feat(mobile): AIFab gesture surface — tap+two-stage-swipe (ADR-0298 Sortie 4)`

## Phase 3 — _layout.tsx FAB rewire + stacked sheets

- [ ] T3.1 — Update `apps/mobile/app/(app)/_layout.tsx` per spec §4.3: add `addSheetRef`, `handleFabTap`→router.replace Kalender, `handleFabSwipeLayer1`→AddSheet, `handleFabSwipeLayer2`→AddSheet + BotssonSheet stacked.
- [ ] T3.2 — Mount `<AddSheet ref={addSheetRef} selectedDate={new Date()} />` alongside `<BotssonSheet>`.
- [ ] T3.3 — Remove `handleFabLongPress` + long-press wiring.
- [ ] T3.4 — Update header doc-comment lines 1-11 to reflect new semantics.
- [ ] T3.5 — `pnpm --filter @smartout/mobile typecheck` green
- [ ] T3.6 — Commit: `feat(mobile): mount AddSheet + rewire FAB to tap-home + swipe-stacked-sheets`

## Phase 4 — DetailSheet onComplete + calendar wiring

- [ ] T4.1 — Update `apps/mobile/src/components/calendar/DetailSheet.tsx` per spec §4.5: extend props with `onComplete`, render "Marker som ferdig" button for task items.
- [ ] T4.2 — Create `apps/mobile/src/hooks/mutations/use-complete-calendar-task.ts` per spec §4.6 — TanStack mutation hitting `/api/mobile/tasks/{id}/complete`.
- [ ] T4.3 — Update `apps/mobile/app/(app)/(calendar)/index.tsx`: add `detailSheetRef`, wire ItemCard onTap → DetailSheet.open(item), mount `<DetailSheet ref={detailSheetRef} onComplete={...} />`.
- [ ] T4.4 — Remove the deferred-comments at lines 408 + 420 (now wired).
- [ ] T4.5 — `pnpm --filter @smartout/mobile typecheck` green
- [ ] T4.6 — Commit: `feat(mobile): DetailSheet onComplete + calendar wiring (task.complete BFF)`

## Phase 5 — operations.tsx TODO removal

- [ ] T5.1 — Delete task-create entry block at `apps/mobile/app/(app)/(home)/operations.tsx:193-195` per spec §4.7 option A.
- [ ] T5.2 — Verify no callers depend on the deleted Pressable's behavior (grep).
- [ ] T5.3 — `pnpm --filter @smartout/mobile typecheck` green
- [ ] T5.4 — Commit: `chore(mobile): remove operations.tsx Sortie 4 TODO — FAB swipe replaces it`

## Phase 6 — Tests

- [ ] T6.1 — `apps/mobile/src/components/navigation/__tests__/AIFab.test.tsx` — tap, swipe-100px, swipe-200px assertions.
- [ ] T6.2 — `apps/mobile/src/__tests__/calendar-detail-sheet.test.tsx` — onComplete invocation.
- [ ] T6.3 — `apps/mobile/src/hooks/mutations/__tests__/use-complete-calendar-task.test.ts` — fetch mock + invalidation.
- [ ] T6.4 — `pnpm --filter @smartout/mobile test` all green
- [ ] T6.5 — `pnpm turbo typecheck` final gate green
- [ ] T6.6 — Commit: `test(mobile): AIFab gesture + DetailSheet onComplete + completion mutation`

## Phase 7 — Closure

- [ ] T7.1 — `docs/HANDOFF-mobile-kalender-task-wire.md`
- [ ] T7.2 — `docs/journeys/JOURNEY-mobile-kalender-task-wire.md` covering: (a) FAB tap returns to Kalender; (b) FAB swipe 100px opens AddSheet, create task succeeds; (c) FAB swipe 200px opens AddSheet + BotssonSheet stacked; (d) Calendar item tap opens DetailSheet, task complete via "Marker som ferdig"; (e) operations.tsx clean of TODO.
- [ ] T7.3 — `docs/decisions/0302-mobile-kalender-task-wire.md` (status: accepted); register in `0000-decision-log.md`.
- [ ] T7.4 — `pnpm turbo typecheck` final.
- [ ] T7.5 — Closure commit: `docs(sortie-4): HANDOFF + JOURNEY + ADR-0302 closure`
- [ ] T7.6 — Tell Pontus: "Sortie 4 ready for closure. Run `close-feature.sh 8`."

## Acceptance criteria

- [ ] `pnpm turbo typecheck` green
- [ ] All vitest green
- [ ] Decision log + ADR-0302 registered
- [ ] HANDOFF + JOURNEY present
- [ ] FAB tap→Kalender / swipe layer 1→AddSheet / swipe layer 2→AddSheet+BotssonSheet
- [ ] Long-press dropped
- [ ] DetailSheet onComplete wired to task.complete BFF
- [ ] operations.tsx TODO removed
- [ ] Zero new BFF routes, zero new tables, zero capability changes
- [ ] 5-tab layout (ADR-0268) preserved

---

> **Sortie 4 closed 2026-05-13.**
> HANDOFF: `docs/HANDOFF-mobile-kalender-task-wire.md`
> ADR: `docs/decisions/0302-mobile-kalender-task-wire.md`
> JOURNEY: `docs/journeys/JOURNEY-mobile-kalender-task-wire.md`
