---
title: "User Journeys — Mobile Shifts Overview"
status: done
updated: 2026-04-06
created: 2026-04-06
module: mobile
tags: [mobile, shifts, vakter, schedule, confirm, punch, journey]
---

# User Journeys — Mobile Shifts Overview

> Employee shift flow on mobile: Shifts tab → Mine vakter → Shift detail → Bekreft → Stemple inn.
> Covers viewing, confirming, and acting on shifts.

---

## Journey: Employee — View My Shifts

**Precondition:** Employee is authenticated, has an active profile, app is open.

1. Employee taps "Mine vakter" tab (calendar icon) in bottom tab bar → System navigates to `/(app)/(shifts)/`
2. System fetches shifts via `useMyShifts()` — queries `schedule_shift` WHERE `employee_id` = current profile, next 7 days, ordered by date + start_time
3. Screen renders:
   - **Top bar:** Burger menu | "Mine vakter" (italic serif) | Notification bell
   - **Summary widget:** Next shift label ("I dag", "I morgen", or day name) + time/zone, weekly hours total
   - **Week sections:** Shifts grouped by ISO week number, each with week header ("Uke 15") and date range
4. Each shift card shows: date block (day name + number), role, zone, time range, hours
5. Weekend shifts have orange left-border accent
6. Bottom of list: "Ingen flere vakter planlagt" empty footer

**Postcondition:** Employee sees their upcoming shifts at a glance.

**Error paths:**

- No shifts scheduled → Summary shows "Ingen planlagt", no week sections rendered, empty footer visible
- Network error → TanStack Query shows stale MMKV cached data (if available), retries once
- Dev mode with no data → Shows 5 placeholder shifts for development testing

---

## Journey: Employee — View Shift Detail

**Precondition:** Employee is on "Mine vakter" screen, sees shift cards.

1. Employee taps a shift card → Haptic feedback fires → System navigates to `/(app)/(shifts)/[id]` with shift ID
2. System finds shift in cached `useMyShifts()` data (no additional fetch needed)
3. Screen renders modal-style detail view:
   - **Handle row:** Back chevron + drag handle
   - **Header:** Calendar icon + "Vaktdetaljer" + reference ID (e.g. #ST-A1B2)
   - **Tab bar:** Detaljer | Oppgaver | Emma (sparkle icon)
4. Details tab shows:
   - **Status badge:** PENDING (gray) or CONFIRMED (orange) with dot indicator
   - **Tid:** Start — End time, full date (e.g. "Fredag, 11. April")
   - **Posisjon:** Role name (e.g. "Servitør")
   - **Din vakt:** Employee avatar + name + role label
   - **Kolleger:** List of colleagues working same day (avatar, name, role, times) — via `useShiftColleagues()`
5. Bottom action bar shows contextual CTAs (see Confirm and Punch journeys below)

**Postcondition:** Employee sees all details about their shift including who else is working.

**Error paths:**

- Shift not found (deleted/reassigned) → "Vakt ikke funnet" with back navigation
- No colleagues data → Colleagues section not rendered (graceful)

---

## Journey: Employee — Confirm Shift

**Precondition:** Employee is viewing a shift detail, shift is not yet confirmed (`confirmed_at` is null).

1. Bottom action bar shows two buttons:
   - "Bekreft vakt" (outlined, orange border) — left
   - "Stemple inn" (solid orange CTA) — right
2. Employee taps "Bekreft vakt" → System calls `enqueue("confirm_shift", { schedule_shift_id, confirmed_at, confirmed_by })`
3. Optimistic update: TanStack Query cache updated immediately — status badge changes to CONFIRMED, check mark appears on avatar
4. Haptic success notification fires
5. Sync queue processes the write:
   - **Native (iOS/Android):** Queued in SQLite, SyncWorker picks up → Supabase call
   - **Web:** Direct Supabase call (no offline queue)
6. "Bekreft vakt" button disappears — only "Stemple inn" remains

**Postcondition:** `schedule_shift.confirmed_at` and `confirmed_by` set. Employee sees confirmed status.

**Error paths:**

- Offline → Write queued in SQLite, synced when connectivity returns. UI shows confirmed optimistically.
- Sync failure → SyncWorker retries with exponential backoff (configurable max retries)
- Profile not loaded → `handleConfirm` returns early (button still visible)

---

## Journey: Employee — Navigate to Punch Clock

**Precondition:** Employee is viewing a shift detail (confirmed or not).

1. Employee taps "Stemple inn" (solid orange CTA) → Medium impact haptic fires
2. System navigates to `/(app)/(home)/punch-clock`
3. Punch clock screen loads with shift context (see JOURNEY-shift-clock.md for full punch flow)

**Postcondition:** Employee is on the punch clock screen, ready to clock in.

**Note:** The "Stemple inn" button is always visible regardless of confirmation status — an employee can punch in without confirming first (confirmation is advisory, not a gate).

---

## Journey: Employee — Browse Shift Tabs

**Precondition:** Employee is on shift detail screen.

### Tasks Tab

1. Employee taps "Oppgaver" tab → Tab indicator moves to Oppgaver
2. Currently shows: "Ingen oppgaver for denne vakten ennå." empty state
3. **Future:** Will show assigned tasks for this specific shift via `useMyTasks()` filtered by shift

### Emma Tab (AI)

1. Employee taps "Emma" tab (sparkle icon) → Tab indicator moves to Emma
2. Currently shows: Sparkle icon + "Spør Emma om denne vakten." empty state
3. **Future:** Will open contextual AI chat about this specific shift (schedule questions, task help, policy lookup)

---

## Journey: Employee — Shift Notifications → Deep Link

**Precondition:** Employee has push notifications enabled.

1. Employee receives shift-related push notification:
   - `shift_reminder` → "Ditt skift starter om 45 min"
   - `hours_confirmation` → "Bekreft timene dine for i dag"
2. Employee taps notification → System resolves deep link via `resolveDeepLink(type, data)`
3. App opens directly to shift detail screen → Employee can confirm or punch in

**Postcondition:** Employee is on the relevant shift, ready to act.

**Error paths:**

- App not running (cold start) → Auth restores session from secure store → Deep link resolves after auth
- Unknown notification type → Falls back to notification list screen

---

## Data Flow Summary

```
schedule_shift (Supabase)
    ↓ useMyShifts() — TanStack Query, 5min stale, MMKV cache
    ↓
Mine vakter (list) → tap card → Shift detail (from cache, no refetch)
    ↓                                ↓
    ↓                     useShiftColleagues() — colleagues for same date
    ↓                                ↓
    ↓                     enqueue("confirm_shift") → SQLite queue → Supabase
    ↓                                ↓
    ↓                     router.push("punch-clock") → ShiftClock flow
    ↓
7-day window, grouped by ISO week, sorted by date + start_time
```

---

## Offline Behavior

| Action | Offline support | Mechanism |
|--------|----------------|-----------|
| View shifts | Yes | MMKV cached data as placeholder |
| View shift detail | Yes | Data from useMyShifts cache |
| Confirm shift | Yes | SQLite sync queue (native only) |
| View colleagues | No | Requires network, section hidden on error |
| Navigate to punch | Yes | Local navigation only |

---

## Known Bugs & Limitations (2026-04-07 audit)

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| B14 | LOW | DEV_SHIFTS fallback shown on query error in dev mode (masks real errors) | Pre-existing, dev-only |
