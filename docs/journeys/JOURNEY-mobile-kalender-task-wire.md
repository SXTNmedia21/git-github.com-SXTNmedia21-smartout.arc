---
title: "User Journeys — mobile-kalender-task-wire"
status: done
created: 2026-05-13
updated: 2026-05-13
tags: [sortie-4, journeys, mobile, kalender, fab]
---

# User Journeys — mobile-kalender-task-wire (Sortie 4)

> Branch: `feat/mobile-kalender-task-wire` | ADR: ADR-0302 | Closes: ADR-0298 row 4

## Overview

Five journeys cover the full gesture surface shipped in Sortie 4:

| Journey | Actor | Entry | Outcome |
|---|---|---|---|
| A | Employee | FAB tap from any tab | Returns to Kalender start anchor |
| B | Employee | FAB swipe ~100 px | AddSheet opens → task created → Kalender refreshes |
| C | Employee | FAB swipe ~200 px | AddSheet + BotssonSheet stacked |
| D | Employee | Calendar item tap | DetailSheet opens → task completed via "Marker som ferdig" |
| E | Manager | operations.tsx home screen | Finds legacy create button gone; uses Kalender FAB |

---

## Journey A: Employee Taps FAB — Returns to Kalender Start Anchor

**Precondition:** Employee is authenticated. Mobile app is open on any tab (Vakter, Chat, or Meg).
FAB (orange circle) is visible in all tabs.

1. Employee taps the FAB (movement < 5 px, duration < 250 ms).
   → System detects tap via PanResponder `onPanResponderRelease` (`|dy| < 5 && |dx| < 5`).
   → `handleFabTap()` fires → `router.replace('/(app)/(calendar)')`.
   → Employee sees: Kalender tab becomes active. No sheet opens.
   → The Kalender WeekView is visible with today's date highlighted.
2. If employee was already on Kalender tab, `router.replace` is a no-op navigation (same route).
   → Employee sees: nothing changes visually.

**Postcondition:** Employee is on the Kalender tab. No AddSheet or BotssonSheet open.
The Kalender start anchor is the consistent "reset" gesture for the app.

**Error paths:**

- If `router.replace` throws (edge case: not in `(app)` group) → falls through to `router.push`.
  Employee still reaches Kalender, no crash.
- If tap fires with movement > 5 px but < 80 px (tiny swipe) → treated as cancelled gesture,
  no action taken (silent no-op by design).

---

## Journey B: Employee FAB-Swipes Up ~100 px — Creates Personal Task via AddSheet

**Precondition:** Employee is authenticated. Mobile app is open. Employee wants to add a personal
task (reminder, errand, work note) that is not tied to a session or shift.

1. Employee places finger on FAB and swipes upward ~100 px (80–160 px threshold).
   → PanResponder tracks `gestureState.dy` during move.
   → On release, `|dy|` is between 80 and 160 px → `handleFabSwipeLayer1()` fires.
   → `addSheetRef.current?.open()` called.
   → Employee sees: AddSheet slides up from bottom of screen (snap point: 70% height).
   → AddSheet shows 5 chips: Oppgave, Vakt, Bestilling, Avvik, Notat.

2. Employee taps "Oppgave" chip.
   → AddSheet renders task creation form: title input, due_at date picker, priority selector.

3. Employee types task title (e.g. "Sjekk lagerstatus kjølerom").
   → Title field accepts free text.

4. Employee optionally sets due_at date (tomorrow) and priority (medium).
   → Date picker shows calendar widget. Priority: low / medium / high.

5. Employee taps "Lagre" / submit button.
   → AddSheet validates: Zod schema checks title (required), due_at (optional ISO string), priority.
   → POST `/api/mobile/tasks/personal` with body `{ title, due_at, priority }`.
   → BFF calls `task.create_personal` (ADR-0301 Sortie 3 tool) → inserts `personal_task` row.
   → On 201 success: AddSheet auto-closes.
   → Employee sees: AddSheet dismisses. Kalender WeekView refreshes (TanStack invalidation).
   → New task appears in WeekView on the due_at date (or today if no due_at set).

6. Telemetry: `task created` event emitted (canonical family per ADR-0301).

**Postcondition:** `personal_task` row exists in DB. Kalender displays the new task. AddSheet is closed.

**Error paths:**

- Title empty → Zod validation fires client-side → "Tittel er påkrevd" inline error shown below
  field. Submit button stays disabled. No BFF call made.
- Network error (POST fails with 5xx) → AddSheet shows toast "Kunne ikke lagre oppgave. Prøv igjen."
  Form stays open. Employee can retry.
- BFF returns 422 (Zod mismatch, should not happen post Sortie 4 `due_date → due_at` fix) →
  "Lagring feilet (422). Kontakt support." Toast. Form stays open.
- Employee swipes AddSheet down to dismiss before submitting → sheet closes, no task created.
  Normal dismiss path.

---

## Journey C: Employee FAB-Swipes Up ~200 px — AddSheet + BotssonSheet Stacked

**Precondition:** Employee is authenticated. Employee wants to create a task while asking Botsson
for context (e.g. "Hva skal jeg gjøre i dag?") without losing the AddSheet form.

1. Employee places finger on FAB and swipes upward ~200 px (> 160 px threshold).
   → PanResponder detects `|dy| > 160` on release → `handleFabSwipeLayer2()` fires.
   → `addSheetRef.current?.open()` AND `botssonSheetRef.current?.expand()` called.
   → Employee sees: AddSheet rises (snap 70%, z-index 100), then BotssonSheet appears on top
   (snap 90%, z-index 110). Both sheets are visible simultaneously, stacked.

2. Employee can interact with BotssonSheet (top layer) while AddSheet waits below.
   → Employee asks Botsson: "Hvilke oppgaver har jeg i dag?"
   → Botsson responds using `task.list_mine` tool — shows active tasks without closing AddSheet.

3a. Employee swipes BotssonSheet down to dismiss it.
   → BotssonSheet closes (own backdrop + independent ref). AddSheet remains open at 70% snap.
   → Employee continues filling AddSheet task form.

3b. Employee taps BotssonSheet backdrop (outside sheet area).
   → BotssonSheet closes. AddSheet remains.

4. Employee submits task in AddSheet (same flow as Journey B step 5).
   → Task created, both sheets dismissed (AddSheet auto-closes on success).
   → Kalender refreshes.

**Postcondition:** If task submitted: `personal_task` row exists, Kalender refreshed, both sheets closed.
If only BotssonSheet dismissed and AddSheet abandoned: no task created, AddSheet manually dismissed.

**Error paths:**

- z-index conflict (AddSheet appears above BotssonSheet) → each sheet has its own
  `BottomSheetBackdrop` ref per @gorhom/bottom-sheet stacking pattern. If visual glitch occurs,
  the sheet with higher z-index value (BotssonSheet at 110) wins. File bug report.
- BotssonSheet expand fails (e.g. ref not ready) → AddSheet still opens (layer 1 success).
  Swipe-layer 2 degrades gracefully to layer 1 behavior.

---

## Journey D: Employee Taps Calendar Item — Completes Task via DetailSheet

**Precondition:** Employee is authenticated. Kalender WeekView shows one or more task items
(session tasks from the shift, personal tasks, day_ad_hoc tasks). Task status is not 'done' / 'completed'.

1. Employee taps a task item card in WeekView (or DayView list).
   → `detailSheetRef.current?.open(item)` called with full `CalendarItemExtended` object.
   → DetailSheet slides up from bottom.
   → Employee sees: task title, description (if set), due_at date, compliance flag (if applicable).

2. For `item.type === 'task'` AND `item.status !== 'done' | 'completed'`:
   → DetailSheet renders "Marker som ferdig" Pressable button above the close-button row.

3. Employee taps "Marker som ferdig".
   → Button enters disabled+spinner state (prevents double-tap).
   → `onComplete(item)` fires → `useCompleteCalendarTask()` mutation runs.
   → POST `/api/mobile/tasks/{id}/complete` with body `{ source: item.source ?? 'session' }`.
   → BFF calls `task.complete` (ADR-0301 Sortie 3 tool) → updates task row status to `completed`,
   sets `completed_by = auth.uid()`, sets `completed_at = now()`.
   → On success: DetailSheet auto-closes via `ref.close()`.
   → Employee sees: DetailSheet slides down. Kalender WeekView refreshes (TanStack invalidates
   `useMyTasks` + `useCalendarItems` + `useOperationsFeed` query keys).
   → Task item disappears from WeekView (or shows as crossed-out, depending on WeekView filter).

4. Telemetry: `task completed` event emitted.

**Postcondition:** Task row has `status='completed'`, `completed_by=employee_id`, `completed_at=now()`.
DetailSheet is closed. Kalender reflects updated state.

**Error paths:**

- Network down when "Marker som ferdig" tapped → button stays in disabled+spinner state.
  After timeout (default TanStack `retry: 3`), toast: "Kunne ikke fullføre oppgave. Sjekk nettverk."
  Button re-enables. Employee can retry or close sheet.
- Task already completed (race condition — another actor completed it) → BFF returns 409 or 200
  with `already_completed: true` → DetailSheet closes, Kalender refreshes. No duplicate completion.
- Employee taps non-task item (shift, absence) → DetailSheet opens but without "Marker som ferdig"
  button (only task type renders it). Read-only view for other item types.
- Employee swipes DetailSheet down before completing → sheet closes, task remains incomplete.
  Normal dismiss path.

---

## Journey E: Manager Looks for Task Create on operations.tsx — Redirected to Kalender FAB

**Precondition:** Manager is authenticated. Manager has been using the `(home)/operations.tsx` screen
as a daily operations hub. In a prior version, a task-create Pressable block existed at lines 193-195
with a "Sortie 4 TODO" comment.

1. Manager navigates to operations.tsx home screen (accessible from (home) tab group).
   → Manager sees: operation cards for shifts, sessions, absences. No task-create entry button.
   → The block at lines 193-195 is removed (Sortie 4 cleanup).

2. Manager wants to create a task for a team member.
   → Manager taps FAB (if on Kalender tab) or swipes FAB upward to open AddSheet.
   → AddSheet "Oppgave" chip is the canonical task-create entry point across all surfaces.

3. Manager fills AddSheet task form, optionally sets `assignee_profile_id` (cross-assign feature
   per ADR-0298, available for manager+ role via `task.create_session` tool).
   → Task created, list refreshes.

**Postcondition:** Manager successfully created task via FAB/AddSheet. operations.tsx is clean
of the TODO block and the redundant Pressable.

**Error paths:**

- Manager expects task-create button on operations.tsx and doesn't find it → UX discoverability gap.
  Mitigation: onboarding tooltip or empty-state hint on operations.tsx pointing to FAB swipe.
  Deferred to Sortie 5 UX pass.
- Manager doesn't know swipe gesture → taps FAB → goes to Kalender → sees no task-create UI there
  without a swipe. Gap: no visual swipe hint on Kalender. Deferred: chevron indicator in AIFab (spec
  §4.4 optional item, cut from Sortie 4 scope).
