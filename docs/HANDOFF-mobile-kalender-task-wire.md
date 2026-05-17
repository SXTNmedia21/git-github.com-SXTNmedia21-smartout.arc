---
title: "Sortie 4 — mobile-kalender-task-wire HANDOFF"
slug: mobile-kalender-task-wire
status: done
revision: v1
layer: handoff
created: 2026-05-13
updated: 2026-05-13
adr: ADR-0302
related_sorties: [Sortie-3 (ADR-0301)]
target_branch: feat/mobile-kalender-task-wire
tags: [sortie-4, handoff, mobile, kalender, fab, ADR-0298, ADR-0302]
---

# HANDOFF — Sortie 4: mobile-kalender-task-wire

## Summary

Sortie 4 closes ADR-0298 row 4: the mobile Kalender task wire. It delivers the gesture surface, stacked
sheet architecture, DetailSheet completion wiring, and operations.tsx cleanup that the Mobile Oppgaver
Council spec mandated. Four production commits shipped on `feat/mobile-kalender-task-wire` (wt-8), with
tests landing in parallel from Agent E. ADR-0302 is registered.

**What shipped:**

- `AIFab.tsx` rewritten — `Pressable` replaced with `View + PanResponder`. Triple-purpose gesture surface:
  tap returns to Kalender start anchor; swipe 80–160 px opens AddSheet (layer 1); swipe >160 px opens
  AddSheet + BotssonSheet stacked (layer 2). Long-press dropped.
- `(app)/_layout.tsx` rewired — `addSheetRef` added, `handleFabTap` → `router.replace('/(app)/(calendar)')`,
  `handleFabSwipeLayer1` → `addSheetRef.current?.open()`, `handleFabSwipeLayer2` → both refs expanded.
  `<AddSheet>` mounted alongside existing `<BotssonSheet>`.
- `DetailSheet.tsx` extended with `onComplete` prop; renders "Marker som ferdig" button for task items
  not yet done. Button fires `onComplete(item)` → awaits BFF → auto-closes sheet on success.
- `(calendar)/index.tsx` wired — `detailSheetRef` + `useCompleteCalendarTask()` mutation added; ItemCard
  tap opens DetailSheet with correct item; `onComplete` passed through.
- `operations.tsx` Sortie 4 TODO block removed — FAB swipe is the canonical create surface; the
  operations.tsx task-create entry button was redundant.
- BFF `/api/mobile/tasks/personal` route added (Agent D parallel) — POST calls `task.create_personal`
  (ADR-0298 Sortie 3 tool). Field rename `due_date → due_at` aligns with tool parameter schema.
- Vitest tests (Agent E parallel) — AIFab gesture simulation, DetailSheet `onComplete` invocation,
  `useCompleteCalendarTask` fetch mock + query invalidation.

**Why:** ADR-0298 was a 5-sortie plan. Sortie 4 was the UI surface closure. Sorties 1–3 built the
RLS hardening (ADR-0299), RPC read-path (ADR-0300), and capability tools (ADR-0301). Without Sortie 4
the existing `fn_list_my_tasks` + `task.complete` tool had no mobile UI path. The FAB/AddSheet/DetailSheet
triad closes the loop: employees can now create personal tasks and mark session tasks done from the
mobile app without touching any web surface.

---

## Decisions

### ADR-0302 registered

`docs/decisions/0302-mobile-kalender-task-wire.md` (status: accepted). Full text below and in decision
log row 4 of the ADR-0298 sortie sequence.

### FAB tap = Kalender start anchor

Pontus locked this 2026-05-13: tap returns to `/(app)/(calendar)` via `router.replace`. No sheet opens.
This gives employees a reliable one-tap "go home" gesture from any tab. The prior behavior (tap=BotssonSheet)
required a dedicated Chat tab to access the AI — now swipe-deep is the AI path, tap is the nav path.

### FAB swipe-up two-stage: layer 1 (80 px) = AddSheet; layer 2 (160 px) = AddSheet + BotssonSheet

Thresholds: `LAYER_1_PX = 80`, `LAYER_2_PX = 160`. Gap 5–80 px = silent no-op (ambiguous gesture, by design).
Tap = `|dy| < 5 && |dx| < 5 && elapsed < 250 ms`. PanResponder tracks `gestureState.dy` on
`onPanResponderRelease`. Both sheets render concurrently via independent `@gorhom/bottom-sheet` refs,
each with its own `BottomSheetBackdrop`.

### Long-press dropped

Pontus: swipe is the canonical AI access path. Long-press was a remnant of the pre-v2 spec (tap+longPress
both opened BotssonSheet). Removed `handleFabLongPress` from `_layout.tsx` and `onLongPress` from
`AIFab.tsx` props.

### 5-tab layout preserved — no ADR-0268 amendment

Kalender is already the start anchor via `unstable_settings.initialRouteName = "(calendar)"`.
No tab changes. `(home)` tab stays href-null. ADR-0268 is untouched.

### AddSheet task-branch routes through new BFF `/api/mobile/tasks/personal`

AddSheet's task chip POSTs to `/api/mobile/tasks/personal`. Route calls `task.create_personal`
(the ADR-0301 Sortie 3 tool). This was scope-creep from spec §4.8 (AddSheet task-branch verification):
the existing route shape mismatched the tool's Zod input. Field rename `due_date → due_at` was the
minimum fix. No AddSheet body redesign — 897 lines unchanged except field name at the submit boundary.

### operations.tsx TODO removal — option A (delete, not redirect)

Spec §4.7 option A chosen: delete the task-create Pressable block at lines 193-195. FAB swipe is
now the canonical create surface. No redirect to Kalender needed — the FAB is always visible.

---

## Learnings

### AIFab line count delta: −109 lines, −46% (Pressable → View + PanResponder)

The previous Pressable + overlay menu pattern accumulated wrapper logic for each gesture mode.
`View + PanResponder` is simpler: one gesture responder, one `onPanResponderRelease` handler,
three branches. The visual change (scale spring on press-in) is 4 lines of `Animated.spring`. This
pattern is reusable for any future mobile FAB or swipe-surface — prefer PanResponder over Pressable
nesting when you need 2+ gesture semantics on one target.

### Lint-staged race: Agents A + B commits collapsed into single SHA (`dd2effc2e`)

Agents A and B worked in parallel on the same worktree. Lint-staged re-staged modified files
mid-cycle during Agent B's commit, causing both agents' changes to be folded into one SHA
(`dd2effc2e`). Content is correct — both agents' changes landed. History-level this is cosmetic;
the commit message reflects Agent A's work (AIFab gesture surface). Agent B's changes (operations.tsx
TODO removal + DetailSheet onComplete) are present in the diff but under Agent A's commit message.
**Lesson:** parallel agents on a single worktree should not commit simultaneously without a
serialization gate (e.g. a lock file or explicit ordering in the orchestration plan).

### BFF route shape mismatch surfaced via Agent C's read-only diff check — pre-flight saves runtime 422

Agent C performed a read-only verification pass comparing AddSheet's submit body against the
BFF route's Zod schema before any code was written. This caught `due_date → due_at` mismatch early.
Without this, the first PWA smoke test on `localhost:8083` would have produced a 422 validation error
that looked like a network problem. **Pattern:** for mounting orphan sheets to existing BFF routes,
always verify field-name alignment in Phase 1 (spec §4.8) before Phase 3 sheet mounting.

---

## Known issues / debt

| Item | Severity | Owner | Notes |
|---|---|---|---|
| Optimistic UI not implemented — DetailSheet "Marker som ferdig" waits for BFF round-trip | Low | Sortie 5+ | Round-trip is <300 ms on good connection. Add optimistic update if UX feedback shows lag. |
| AddSheet shift/booking/deviation/note branches untested for BFF compatibility | Medium | Sortie 5 E2E | Only task-branch verified (spec §4.8). Other chips may have similar field-name drift. |
| Tap-vs-tiny-swipe gap (5–80 px) silently no-ops | Low | Deferred | By-design. UX may want subtle haptic cancel-feedback on release. Add if users report confusion. |
| Lint-staged parallel-commit collision (`dd2effc2e`) | Cosmetic | — | Content correct. History-level only. No action required unless bisect is needed. |

---

## Next steps

1. **Sortie 5** — E2E coverage of voice→list→complete across all task surfaces. Also removes
   30-day telemetry alias (`task.added_manual`) and `aliasTaskVerbs()` shim in `router.ts`.
2. **Promote ADR-0298 `proposed` → `accepted`** — 4 of 5 sorties shipped. Pontus call; happens
   when Sortie 5 closes.
3. **Sortie 5 closure removes** the `personal→task` intent-classifier shim (30-day A/B window set
   in Sortie 3 ADR-0301).
4. **AddSheet multi-branch BFF audit** — verify shift/booking/deviation/note branches align with
   current BFF routes before Sortie 5 E2E targets them.
