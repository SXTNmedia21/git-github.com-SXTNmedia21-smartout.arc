---
title: "Sortie 4 — Mobile Kalender Task Wire (Design Spec)"
slug: sortie-4-mobile-kalender-task-wire
status: ready
revision: v2
layer: spec
created: 2026-05-13
updated: 2026-05-13
adr: ADR-0298
sortie_adr_reserved: ADR-0302
related_sorties: [Sortie-3 (ADR-0301)]
tags: [sortie, spec, mobile, kalender, task, fab, ADR-0298, ADR-0302]
---

# Sortie 4 — Mobile Kalender Task Wire (Design Spec) — v2

> **v2 rewrite 2026-05-13:** Pontus revised FAB semantics. Tap = home/start anchor. Swipe-up = two-stage gesture revealing AddSheet (layer 1) and BotssonSheet (layer 2). 5-tab layout preserved.

## 1. Goal

Repurpose the mobile FAB as a tap=home + swipe=sheets gesture surface. Mount built-but-orphan AddSheet via two-stage swipe gesture. Wire DetailSheet onComplete → task.complete BFF. Kill operations.tsx Sortie 4 TODO. ADR-0298 row 4 closure.

## 2. Non-goals

- New BFF routes (Sortie 3 shipped `/api/mobile/tasks/[id]/complete`).
- New task tables or capability tools.
- Chat-tab header mic icon (redundant with swipe-deep BotssonSheet access).
- AddSheet body redesign (897 lines stay verbatim — only mount + wiring).
- Voice unlock on `create_*` tools (chat-only V1 per ADR-0298 R6).
- New tabs (5-tab layout per ADR-0268 stays).
- Long-press handler (dropped — swipe is canonical AI access).
- E2E (Sortie 5).
- (home) tab visible (stays href:null).

## 3. Canonical reality (locked 2026-05-13)

- `apps/mobile/app/(app)/_layout.tsx:32-34` — `unstable_settings.initialRouteName = "(calendar)"`. Kalender is start screen anchor.
- `apps/mobile/app/(app)/_layout.tsx:45-55` — FAB tap + long-press both open BotssonSheet via `botssonSheetRef.current?.expand()`.
- `apps/mobile/src/components/navigation/AIFab.tsx` — FAB component, props `{onTap, onLongPress}`. Need to extend with `onSwipeLayer1` + `onSwipeLayer2` or wrap with PanResponder.
- `apps/mobile/src/components/calendar/AddSheet.tsx` — 897 lines, forwarded ref handle `{ open, close }`, BFF routes per type. **No live caller.**
- `apps/mobile/src/components/ai/BotssonSheet.tsx` — 344 lines, forwarded ref, single live caller is `(app)/_layout.tsx:94`.
- `apps/mobile/src/components/calendar/DetailSheet.tsx:1-25` — "Read-only in Phase 3e — D6 execution actions are Phase 4 polish."
- `apps/mobile/app/(app)/(calendar)/index.tsx:408+420` — comments mark DetailSheet wiring as deferred.
- `apps/mobile/app/(app)/(home)/operations.tsx:193-195` — TODO ADR-0298 Sortie 4 marker.
- `apps/mobile/src/hooks/queries/use-operations-feed.ts:69` already uses `useMyTasks()` (Sortie B RPC).
- BFF route `/api/mobile/tasks/[id]/complete/route.ts` exists (Sortie 3).
- React Native `PanResponder` is the canonical gesture API. `react-native-gesture-handler` also available (used by @gorhom/bottom-sheet).

## 4. Architecture

### 4.1 FAB gesture surface

FAB becomes a triple-purpose surface:

| Gesture | Trigger threshold | Action |
|---|---|---|
| Tap | < 5px movement, < 250ms | `router.replace('/(app)/(calendar)')` — return to Kalender start anchor |
| Swipe up (layer 1) | 80–160px upward translation | `addSheetRef.current?.open()` |
| Swipe up (layer 2) | > 160px upward translation | `addSheetRef.current?.open()` + `botssonSheetRef.current?.expand()` (both visible, stacked) |
| Long-press | — | Dropped per Pontus 2026-05-13 |

Implementation:
- Replace `AIFab.tsx` `Pressable` with `View` wrapping `PanResponder` (react-native).
- Track `gestureState.dy` during PanResponder onPanResponderRelease.
- Distance thresholds: `LAYER_1_PX = 80`, `LAYER_2_PX = 160`.
- Tap detection: if `|dy| < 5 && Math.abs(dx) < 5 && elapsed < 250`, treat as tap.

### 4.2 Two-stage sheet stack

- AddSheet opens first (layer 1). Z-index: 100. Snap point: 70% screen.
- BotssonSheet opens above AddSheet (layer 2). Z-index: 110. Snap point: 90% screen.
- Both sheets render concurrently in (app)/_layout.tsx (already pattern for BotssonSheet).
- Independent dismiss: swipe-down on either sheet closes only that sheet.
- Backdrop tap on BotssonSheet → close BotssonSheet, AddSheet stays.
- Backdrop tap on AddSheet (when BotssonSheet closed) → close AddSheet.
- Per @gorhom/bottom-sheet docs: stacked sheets work natively when each has its own backdrop ref.

### 4.3 (app)/_layout.tsx changes

```tsx
const addSheetRef = useRef<AddSheetHandle>(null);
const botssonSheetRef = useRef<GorhomBottomSheet>(null);
const router = useRouter();

const handleFabTap = useCallback(() => {
  router.replace('/(app)/(calendar)');
}, [router]);

const handleFabSwipeLayer1 = useCallback(() => {
  addSheetRef.current?.open();
}, []);

const handleFabSwipeLayer2 = useCallback(() => {
  addSheetRef.current?.open();
  botssonSheetRef.current?.expand();
}, []);

// Drop handleFabLongPress.
```

Render:
```tsx
<AIFab
  onTap={handleFabTap}
  onSwipeLayer1={handleFabSwipeLayer1}
  onSwipeLayer2={handleFabSwipeLayer2}
/>
...
<AddSheet ref={addSheetRef} selectedDate={new Date()} />
<BotssonSheet ref={botssonSheetRef} onDismiss={handleBotssonDismiss} />
```

Update doc-comment lines 1-11 to reflect FAB tap=home / swipe=stacked sheets.

### 4.4 AIFab.tsx rewrite

- Replace Pressable with View + PanResponder.
- Visual: same orange circle, same icon.
- Add subtle animation: scale 0.96 on press-in, scale 1.0 on release.
- Optional: a vertical chevron `↑↑` indicator above icon hinting swipe gesture (cut if scope creeps).
- accessibilityRole stays `button`; accessibilityHint = "Swipe up to create or talk to Botsson".

### 4.5 DetailSheet onComplete (`DetailSheet.tsx`)

- Extend `DetailSheetProps` with `onComplete?: (item: CalendarItemExtended) => Promise<void>`.
- For `item.type === 'task'` AND `item.status !== 'done'/'completed'`, render "Marker som ferdig" Pressable above close-button row.
- Button onPress → `await props.onComplete?.(item)` → on success, sheet auto-closes via `ref.close()`.

### 4.6 Calendar wiring (`(calendar)/index.tsx`)

- Add `const detailSheetRef = useRef<DetailSheetHandle>(null)`.
- ItemCard onTap → `detailSheetRef.current?.open(item)`.
- Add `useCompleteCalendarTask()` TanStack mutation (new file `apps/mobile/src/hooks/mutations/use-complete-calendar-task.ts`):
  - Body: `{ source: 'session' | 'personal' | 'day_ad_hoc' | 'emma' }`. Default source `'session'` when `item.source` absent (operations-feed dominant).
  - POST `getWebApiUrl('/api/mobile/tasks/{id}/complete')` with Bearer JWT auth.
  - On success: invalidate query keys for `useMyTasks` + `useCalendarItems` + `useOperationsFeed`.
- Pass `onComplete={async (item) => mutate({ id: item.id, source: item.source ?? 'session' })}` to `<DetailSheet>`.
- Mount `<DetailSheet ref={detailSheetRef} onComplete={...} />`.

### 4.7 operations.tsx TODO removal

Replace `apps/mobile/app/(app)/(home)/operations.tsx:193-195`:

Option A (preferred): delete the task-create entry button. FAB swipe is now the canonical create surface. `operations.tsx` task-create button is redundant.

Option B (fallback if button has unique context): make button trigger `router.replace('/(app)/(calendar)')` — FAB on Kalender takes over.

Pick A. Remove 3-line warn block + the surrounding Pressable.

### 4.8 AddSheet task-branch verification

AddSheet line 11 doc-comment references `/api/mobile/tasks` (Sortie 3-era POST). Verify route works:
- Read `apps/web/src/app/api/mobile/tasks/route.ts` POST handler.
- AddSheet task-form submit body shape matches route's Zod input schema.
- If mismatch, fix AddSheet body to align with `task.create_session` parameter set (per ADR-0298). NOT scope-creep — this is mounting work, not redesign.

## 5. Test surface

### 5.1 Mobile vitest

- `apps/mobile/src/__tests__/calendar-detail-sheet.test.tsx`: render DetailSheet with task item, click "Marker som ferdig", assert `onComplete` called with item.
- `apps/mobile/src/hooks/mutations/__tests__/use-complete-calendar-task.test.ts`: mock fetch, assert POST body shape `{ source }`, invalidation triggered.
- `apps/mobile/src/components/navigation/__tests__/AIFab.test.tsx`: simulate PanResponder events; assert tap calls onTap, swipe 100px calls onSwipeLayer1, swipe 200px calls onSwipeLayer2.

### 5.2 Typecheck gate

- `pnpm turbo typecheck` clean (52 tasks).
- `pnpm --filter @smartout/mobile typecheck` green.

### 5.3 Manual smoke (PWA `localhost:8083` — Pontus runs)

- FAB tap → routes to Kalender (no sheet).
- FAB swipe up ~100px → AddSheet opens (5 chips visible).
- FAB swipe up ~200px → AddSheet + BotssonSheet both visible (stacked).
- Swipe down on BotssonSheet → closes only BotssonSheet, AddSheet remains.
- Swipe down on AddSheet → closes AddSheet.
- Calendar item-tap (task type) → DetailSheet opens.
- "Marker som ferdig" → task completes, list refreshes.

## 6. Risk + mitigation

| Risk | Mitigation |
|---|---|
| PanResponder swipe thresholds wrong for one-handed reach | Thresholds (80/160px) configurable as constants in AIFab.tsx for tuning. Manual smoke required. |
| Stacked sheets z-index conflict | @gorhom/bottom-sheet supports stacking when each has independent BottomSheetBackdrop. Documented pattern. |
| Tap vs short-swipe ambiguity | Tap = `|dy| < 5 && elapsed < 250ms`. Swipe = `|dy| > 80`. Gap (5-80px) treated as no-op (cancelled gesture). |
| `router.replace` while not in (app) group | Router check defensive — fallback to `router.push`. |
| AddSheet 897-line task branch incompatible with task.create_session BFF | Phase 1 grep verifies POST body shape; spec §4.8 covers fix path. |

## 7. Escalation protocol

Council escalation required only if:
- Gesture pattern conflicts with `@gorhom/bottom-sheet` internal pan handling (Phase 1 spike answers).
- AddSheet task-branch needs schema change beyond minor field rename.

Not council-grade:
- FAB-tap-to-home semantic (Pontus locked it 2026-05-13).
- Stacked-sheet pattern (Pontus locked it 2026-05-13).
- 5-tab layout preserved (ADR-0268 stays).

## 8. References

- ADR-0298 (5-source task ontology)
- ADR-0132/0133/0134 (mobile thin-client + telemetry)
- ADR-0151 (server-derived identity)
- ADR-0268 (5-tab canonical mobile layout — preserved)
- Sortie 3 HANDOFF (BFF complete route shipped)
- `docs/design/design_handoff_calendar/source/screens.jsx` (canonical UI source)
- Pontus design 2026-05-13: FAB tap=home, swipe-up=stacked sheets, no long-press
