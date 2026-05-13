---
title: "ADR-0302: Mobile Kalender Task Wire (Sortie 4)"
id: ADR_0302
status: accepted
layer: decision
created: 2026-05-13
updated: 2026-05-13
---

# ADR-0302: Mobile Kalender Task Wire (Sortie 4)

## Status

**accepted**

---

## Context

ADR-0298 ("Task Ontology — Five Sources, One Read Surface, One Capability") is a 5-sortie plan.
Sortie 4 was reserved for the mobile Kalender UI surface: mounting the orphaned `AddSheet`,
wiring `DetailSheet` completion, and redefining the FAB gesture surface to replace the `operations.tsx`
task-create TODO block.

Prior sorties:
- Sortie 1 (ADR-0299) — D6 RLS hardening + mobile direct-mutation handler removal.
- Sortie 2 / Sortie B (ADR-0300) — `fn_list_my_tasks` SECURITY DEFINER RPC + `useMyTasks` rewire.
- Sortie 3 (ADR-0301) — `task` capability (6 tools) registered; BFF `/api/mobile/tasks/[id]/complete`
  shipped; `addTaskAction` rewritten as thin wrapper; 30-day `aliasTaskVerbs()` A/B shim active.

The canonical UI source is `docs/design/design_handoff_calendar/source/screens.jsx`. The mobile
app has `AddSheet.tsx` (897 lines, forwarded ref) and `BotssonSheet.tsx` (344 lines) both built
but only BotssonSheet had a live caller. The FAB (`AIFab.tsx`) used `Pressable` with `onTap` +
`onLongPress` — both opening BotssonSheet. This was the pre-v2 spec.

On 2026-05-13 Pontus revised FAB semantics: tap = home/start anchor, swipe-up = stacked sheet
reveal, long-press dropped. The v2 spec locked this before implementation began.

---

## Decision Drivers

- **ADR-0298 mandate:** Sortie 4 must deliver the mobile Kalender UI surface. 4/5 sorties shipping
  is the gate for promoting ADR-0298 from `proposed` to `accepted`.
- **No new tables, no new capability tools:** Sortie 4 is mounting + wiring only. Zero schema changes.
- **5-tab layout preserved (ADR-0268):** No tab restructuring. Kalender is already start anchor via
  `unstable_settings.initialRouteName = "(calendar)"`.
- **Mobile thin-client principle (ADR-0132):** All mutations route through BFF. No direct Supabase
  client writes from mobile.
- **Mobile telemetry contract (ADR-0134):** Every mutation emits. `task.create_personal` and
  `task.complete` already emit via the capability tool layer (ADR-0301).
- **Server-derived identity (ADR-0151):** BFF resolves `workspace_id` + `actor_id` from JWT.
  Mobile sends Bearer token only.
- **Pontus design decision 2026-05-13:** tap=home, swipe-stack=create+ai, long-press dropped.

---

## Decision Outcome

### What shipped (4 core commits + tests)

1. **`feat(mobile): AIFab gesture surface — tap+two-stage-swipe (ADR-0298 Sortie 4)`** (commit `dd2effc2e` / `46643dc0`)
   - `AIFab.tsx` rewritten: `Pressable` → `View + PanResponder`.
   - Props: `{ onTap, onSwipeLayer1, onSwipeLayer2 }`. `onLongPress` removed.
   - Thresholds: `LAYER_1_PX = 80`, `LAYER_2_PX = 160`. Tap: `|dy| < 5 && |dx| < 5 && elapsed < 250 ms`.
   - Visual: `Animated.spring` scale 0.96 on press-in, 1.0 on release.
   - Note: commit history shows two SHAs for this change (`dd2effc2e` + `46643dc0`) due to lint-staged
     parallel-agent collision (cosmetic; content is correct).

2. **`feat(mobile): mount AddSheet + rewire FAB to tap-home + swipe-stacked-sheets`** (commit `a42cf968c`)
   - `(app)/_layout.tsx`: `addSheetRef` added. `handleFabTap` → `router.replace('/(app)/(calendar)')`.
     `handleFabSwipeLayer1` → `addSheetRef.current?.open()`. `handleFabSwipeLayer2` → both refs.
     `handleFabLongPress` removed. `<AddSheet ref={addSheetRef} selectedDate={new Date()} />` mounted.
   - `operations.tsx` Sortie 4 TODO block removed (also in this commit, landed via parallel agent).
   - `DetailSheet.tsx` `onComplete` prop wired (also in this commit, landed via parallel agent).
   - `(calendar)/index.tsx` `detailSheetRef` + `useCompleteCalendarTask` mutation added.

3. **BFF `/api/mobile/tasks/personal` route** (Agent D parallel)
   - POST handler calls `task.create_personal` (ADR-0301 Sortie 3 tool).
   - Field rename: AddSheet task-branch submit body `due_date → due_at` to match tool param schema.

4. **Vitest tests** (Agent E parallel)
   - `AIFab.test.tsx`: PanResponder simulation, tap / swipe-100px / swipe-200px assertions.
   - `calendar-detail-sheet.test.tsx`: `onComplete` invocation for task items.
   - `use-complete-calendar-task.test.ts`: fetch mock + `{ source }` body shape + invalidation.

---

## Architecture Summary

### FAB gesture surface

```
Gesture                 Threshold                 Action
───────────────────────────────────────────────────────
Tap                     |dy|<5, elapsed<250ms     router.replace('/(app)/(calendar)')
Swipe up (layer 1)      80–160 px                 addSheetRef.open()
Swipe up (layer 2)      >160 px                   addSheetRef.open() + botssonSheetRef.expand()
Long-press              —                          Dropped
Gap (5–80 px)           —                          Silent no-op
```

### Stacked sheet architecture

```
BotssonSheet  ┐  z-index 110  snap 90%  independent BottomSheetBackdrop ref
AddSheet      ┘  z-index 100  snap 70%  independent BottomSheetBackdrop ref
```

Both sheets mounted in `(app)/_layout.tsx`. Independent dismiss: swipe-down on either closes
only that sheet. Backdrop tap on BotssonSheet → BotssonSheet closes, AddSheet stays.

### DetailSheet onComplete

- New prop: `onComplete?: (item: CalendarItemExtended) => Promise<void>`
- Rendered for `item.type === 'task' && item.status !== 'done' && item.status !== 'completed'`
- On press: button disables, `onComplete(item)` awaits, sheet auto-closes on success.

### BFF personal task route

- `POST /api/mobile/tasks/personal` → `task.create_personal({ title, due_at, priority })`
- Auth: Bearer JWT. `workspace_id` + `actor_id` resolved server-side (ADR-0151).
- Field `due_at` (not `due_date`) — matches Sortie 3 tool parameter schema.

---

## Consequences

### Good

- Employees have a discoverable, gesture-based task create surface on mobile (no menu tapping).
- BotssonSheet is now reachable without a dedicated Chat tab interaction — swipe-deep from any tab.
- `AddSheet` (897 lines, built but orphaned) is now a live, tested, production-mounted component.
- `operations.tsx` is clean — the TODO block that would have confused future developers is gone.
- Telemetry continuity: all mutations flow through ADR-0301 capability tools, which already emit.
- Zero schema drift: no new tables, no new enums, no migration files.

### Bad / Trade-offs

- Tap-vs-tiny-swipe gap (5–80 px) is a silent no-op. Users who half-swipe get no feedback.
  A haptic cancel-pulse would improve UX. Deferred.
- Optimistic UI not implemented on DetailSheet completion. BFF round-trip visible as spinner.
  Acceptable for V1. Add in Sortie 5+ if latency feedback reported.
- AddSheet shift/booking/deviation/note branches not verified for BFF compatibility in Sortie 4.
  Only task-branch field alignment was verified (spec §4.8). Other branches may have similar
  `due_date → due_at` drift patterns.
- Lint-staged parallel-agent commit collision (`dd2effc2e` / `46643dc0`) means two SHAs carry
  the same message. Content correct; bisect may be slightly confusing. Cosmetic only.

### Agent-impact

- `task` capability tools (`create_personal`, `complete`) are the BFF's delegation targets.
  Agents should not call mobile BFF routes directly — they call capability tools which route through
  BFF per ADR-0132.
- Voice channel still chat-only on `create_*` tools (ADR-0298 R6 / ADR-0301). No voice unlock
  in Sortie 4 — server-side PII detector (V2) is a Sortie 5+ concern.

---

## Cross-References

| ADR | Relationship |
|---|---|
| ADR-0298 | Parent — 5-sortie task ontology plan. Sortie 4 row. |
| ADR-0299 | Sortie 1 — D6 RLS hardening (prerequisite) |
| ADR-0300 | Sortie 2 — `fn_list_my_tasks` RPC (read-path prerequisite) |
| ADR-0301 | Sortie 3 — `task` capability 6 tools (mutation delegation target) |
| ADR-0151 | Server-derived identity — BFF resolves workspace_id from JWT |
| ADR-0132 | Mobile thin-client — no direct Supabase writes from mobile |
| ADR-0133 | Mobile surface boundary — mobile executes, web authors |
| ADR-0134 | Mobile telemetry contract — workspace_id + actor_id non-null before emit |
| ADR-0268 | 5-tab canonical mobile layout — preserved, not amended |
