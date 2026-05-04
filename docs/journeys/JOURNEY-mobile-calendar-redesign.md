---
title: "User Journeys — Mobile Calendar Redesign"
status: done
updated: 2026-05-04
created: 2026-05-04
module: mobile
tags: [mobile, calendar, kalender, vakter, booking, pii, rbac, adr-0266, adr-0267, adr-0268, journey]
---

# User Journeys — Mobile Calendar Redesign

> Unified calendar + vaktliste experience on mobile. Covers week-strip navigation, filter chips, detail sheet, PII gate (ADR-0267), scope RBAC (ADR-0266), and the AddSheet entry point. TabBar layout per ADR-0268.

---

## Journey: Employee — View Today's Calendar

**Precondition:** Employee is authenticated. Profile row has `role = 'employee'`. App is open on the Calendar tab.

1. Employee taps the "Kalender" tab in the bottom tab bar → System navigates to `/(app)/(calendar)/`
2. System renders WeekStrip at top — 7-day strip centered on today, today highlighted with brand dot
3. System fetches items via `useCalendarItems({ date: today, filter: 'alt', scope: { kind: 'me' } })`
   - Day boundaries computed in workspace timezone (not device tz) per ADR-0134 / Lovsen F-09
   - Fallback tz: `Europe/Oslo` (workspace table DEFAULT)
4. Filter chips render below WeekStrip: Alt | Oppgaver | Vakter | Bookinger | Avvik — badge counts from `useCalendarItems().counts`
5. Calendar list renders `CalendarItem[]` — each card shows type icon, title, time, dept badge, status dot
6. Employee taps a day in WeekStrip → selected date updates → list reloads for that day → haptic feedback

**Postcondition:** Employee sees their items for the selected day in workspace timezone.

**Error paths:**

- No items for selected day → Empty state illustration + "Ingen aktiviteter denne dagen"
- Network error → TanStack Query shows stale MMKV cached data, retries silently; spinner on first load
- Profile not loaded yet → `isLoading = true`, skeleton cards shown

---

## Journey: Employee — Filter Calendar Items

**Precondition:** Employee is on Calendar screen, items are loaded.

1. Employee taps a filter chip (e.g. "Vakter") → Filter state updates
2. `useCalendarItems` re-filters in-memory — no additional network request
3. List updates immediately to show only shifts; badge on chip shows count for that filter
4. Employee taps "Alt" → all items restored

**Postcondition:** Employee sees only the item type they selected.

**Error paths:**

- Filter returns 0 items → Empty state specific to filter: "Ingen vakter" / "Ingen oppgaver" etc.

---

## Journey: Employee — View Vaktliste (Scope=me)

**Precondition:** Employee is on Calendar tab. Vakter sub-tab or dedicated Vaktliste view is accessible.

1. Employee switches to Vaktliste view (CalendarTabSwitched emit — deferred to Phase 3c implementation)
2. System fetches shifts scoped to `me` — only current user's shifts
3. Scope chips render: Meg | Alle | Avdeling | Person — "Alle", "Avdeling", "Person" are visible but gated by `profile.role` per ADR-0266
   - `employee`: only "Meg" is active; others show locked state
   - `manager | admin | owner`: all four scopes active
4. Employee taps "Meg" → list filtered to own shifts (no-op if already me)
5. Shift card renders: date, role, time, zone, status badge

**Postcondition:** Employee sees their own upcoming shifts.

**Error paths:**

- Employee attempts to use "Alle" scope → locked state shown, no data leakage (client-filter enforced per ADR-0266)

---

## Journey: Manager / Admin — View Team Vaktliste

**Precondition:** User is authenticated with `role = 'manager'` or higher. On Vaktliste screen.

1. Manager taps scope chip "Alle" → scope updates to `{ kind: 'all' }`
2. `useCalendarItems` passes through scope (Phase 3d server-gate pending; Phase 3c pass-through)
3. List shows all team shifts for the selected day
4. Manager taps "Avdeling" → scope selector sheet opens → Manager selects department (Kjøkken / Sal / Bar / Event)
5. List filters to shifts for that department only

**Postcondition:** Manager sees team schedule filtered by scope.

**Error paths:**

- No shifts for selected scope+day → empty state per scope
- `useOperationsFeed` returns error → error boundary catches, retry CTA shown

---

## Journey: Employee — View Booking Item (PII Gate — ADR-0267)

**Precondition:** Employee taps a booking-type CalendarItem. `profile.role === 'employee'`.

1. Employee taps booking card → DetailSheet opens via bottom sheet gesture
2. `useCalendarItems` has already set `item.contactRedacted = true`, `item.contact = undefined`
3. DetailSheet renders booking info: title, time, dept
4. Contact section: "Kontakt resepsjonen" passive stub replaces "Ring"-button
5. No guest name or phone number is visible

**Postcondition:** Employee sees booking metadata without guest PII.

**Error paths:**

- If `contactRedacted` is undefined (unexpected) → DetailSheet treats as redacted (safe default)

---

## Journey: Manager — View Booking Item with Contact (ADR-0267)

**Precondition:** Manager taps a booking-type CalendarItem. `profile.role === 'manager'` or higher.

1. Manager taps booking card → DetailSheet opens
2. `useCalendarItems` set `item.contactRedacted = false`, `item.contact = "<guest name + phone>"`
3. DetailSheet renders: booking info + Contact section with guest name + "Ring"-button (tel: link)
4. Manager taps "Ring" → device dialer opens with guest phone number
   - NOTE: `emit("calendar.booking_contact_called", ...)` is deferred to BFF-wrap (Phase 3e)

**Postcondition:** Manager can call the guest directly.

**Error paths:**

- `contact` field missing from FeedItem → "Ring"-button not rendered; passive stub shown (no crash)
- Role unknown / null → default deny: `contactRedacted = true` (safe default per ADR-0267)

---

## Journey: Employee — Add Item via AddSheet

**Precondition:** Employee is on Calendar screen. FAB (+ button) is visible.

1. Employee taps FAB → AddSheet opens from bottom
2. AddSheet renders quick-add options: Oppgave | Avvik | Note (booking requires manager role)
3. Employee taps "Oppgave" → task form reveals: title input, date picker (defaults to selected calendar day)
4. Date label derived dynamically from `selectedDate` via `toLocaleDateString("nb-NO", ...)` — not hardcoded
5. Employee fills title + taps "Lagre" → POST to BFF (Phase 3e, currently mocked)
6. Sheet closes → calendar list refreshes

**Postcondition:** New task is created and appears in the day's list.

**Error paths:**

- Title empty → inline validation: "Legg til en tittel" shown, save blocked
- BFF error (Phase 3e) → toast error, sheet stays open for retry

---

## Journey: Admin — TabBar Navigation (ADR-0268)

**Precondition:** Admin is authenticated. App displays 5-tab bottom bar per ADR-0268.

1. Admin sees tabs: Kalender | Vakter | ⊕ (FAB center) | Chat | Min Tid
2. Admin taps "Kalender" → calendar view (this feature)
3. Admin taps "Vakter" → shift overview (existing `/(shifts)/` screens)
4. Admin taps ⊕ FAB → quick-add sheet opens
5. Admin taps "Chat" → Botsson chat surface
6. Admin taps "Min Tid" → time/attendance/profile view (relabeled from "(me)")

**Postcondition:** Admin can navigate between all five domains without dead-ends.

**Error paths:**

- wt-1 (4-tab plan) conflicts with ADR-0268 — ADR-0268 takes precedence; wt-1 must be cancelled or rebased before Phase 3f TabBar merge

---
