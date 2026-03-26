---
title: "User Journeys — Mobile Wiring Fixes"
status: done
updated: 2026-03-26
created: 2026-03-26
module: mobile
tags: [mobile, navigation, wiring, tabbar, punchbutton, taskfeed]
---

# User Journeys — Mobile Wiring Fixes

All 7 wiring fixes resolve orphaned features. No new functionality was introduced — every journey below was previously blocked by a missing wire.

---

## Journey: Employee — Access Chat via Tab Bar

**Precondition:** Employee is logged in. Chat tab was previously hidden by a hardcoded filter in TabBar.

1. Employee opens the app → Tab bar renders all tabs based on layout `href` config
2. Chat tab is now visible → Employee taps it → Chat screen opens
3. Badge count appears on Chat tab when there are unread messages

**Postcondition:** Employee can reach Chat from any bottom-tab context.
**Error paths:** N/A — tab visibility is driven by layout config; if `href` is `null`, tab is hidden (correct).

---

## Journey: Employee — Punch In Without a Scheduled Shift

**Precondition:** Employee has no shift scheduled today (ad-hoc or early arrival). PunchButton previously returned `null` in this state.

1. Employee opens Home screen → PunchButton is visible, styled in muted colours
2. Employee taps "Punch inn" → punch clock flow initiates
3. Employee confirms → clock-in recorded

**Postcondition:** Employee is clocked in; shift clock view activates.
**Error paths:** If the backend rejects the punch (no active session), an error toast is shown. The button remains visible.

---

## Journey: Employee — View Real Tasks in ShiftClockView

**Precondition:** Employee is clocked in. ShiftClockView previously showed 3 hardcoded demo cards.

1. Employee is in active shift → ShiftClockView renders `TaskFeed` with tasks from `useMyTasks()`
2. Tasks from the workspace are displayed in real-time
3. Employee taps a task → task detail opens (handled by TaskFeed)

**Postcondition:** Employee sees their actual assigned tasks, not demo data.
**Error paths:** If `tasks` is empty or query fails, TaskFeed renders its own empty/error state.

---

## Journey: Employee — Edit Profile from Me Screen

**Precondition:** Employee is on the Me tab. Edit Profile and Team screens existed as routes but had no navigation entry point.

1. Employee taps Me tab → Me screen shows "Rediger profil" and "Mitt team" action buttons
2. Employee taps "Rediger profil" → haptic feedback → navigates to `/(app)/(home)/edit-profile`
3. Employee updates profile fields → saves → returns to Me screen

**Postcondition:** Profile updated. Me screen shows updated avatar/name.
**Error paths:** If navigation fails (route not found), Expo Router shows 404. No silent failure.

---

## Journey: Employee — Navigate to Team Screen from Me

**Precondition:** Employee is on the Me tab.

1. Employee taps "Mitt team" button → haptic feedback → navigates to `/(app)/(home)/team`
2. Team screen loads showing team members and leader

**Postcondition:** Employee can see their team composition.
**Error paths:** If workspace has no team configured, team screen shows empty state.

---

## Journey: Employee — Log HACCP Temperature with Real Units

**Precondition:** Employee opens HACCP screen. Screen previously used a hardcoded `UNITS` array.

1. Employee taps HACCP in the home menu → screen queries `asset` table for cooling units
2. If real cooling units exist → employee selects the unit from the list
3. Employee enters the temperature reading → submits
4. If no real units found → demo units are shown as fallback so the workflow still functions

**Postcondition:** HACCP log entry created via `useLogHaccp` mutation.
**Error paths:** If query errors, demo fallback units are displayed. Employee can still log. Error is logged to console.

---

## Journey: Employee — Report a Deviation (Offline-Safe)

**Precondition:** Employee is on the Deviation screen. Submit previously used local state only.

1. Employee fills in description and selects severity
2. Employee taps "Send" → haptic success feedback fires
3. `useReportDeviation` mutation enqueues the submission to the offline sync queue
4. `step` transitions to `"done"` → confirmation UI shown
5. If offline, the deviation is queued and synced when connectivity resumes

**Postcondition:** Deviation is recorded (or queued for sync). Employee sees confirmation screen.
**Error paths:** If mutation fails synchronously, the `done` state is still shown to the employee (optimistic UX). The queue handles retry.

---

## Journey: Employee — Call Leader from ShiftClockView

**Precondition:** Employee is in an active shift and needs to contact their leader. "Ring leder" button previously had a TODO comment.

1. Employee taps "Ring leder" in ShiftClockView → `useLeaderPhone` resolves the leader's phone number
2. If phone number found → `Linking.openURL("tel:…")` opens the native phone dialer
3. If no phone number found → Alert dialog: "Ingen leder tilgjengelig. Bruk chat."

**Postcondition:** Employee either initiates a call or is directed to chat.
**Error paths:** If `Linking.openURL` fails (device has no phone), the OS handles the error. App does not crash.

---

## Journey: Employee — Navigate to Notes (Chat) from ShiftClockView

**Precondition:** Employee taps the "Notater" tab inside ShiftClockView. Navigation previously had a TODO.

1. Employee taps "Notater" → app navigates to `/(app)/(chat)`
2. Shift chat serves as the notes context for the active shift

**Postcondition:** Employee is on the Chat screen, where shift notes live.
**Error paths:** If chat route is unavailable, Expo Router shows its default error screen.
