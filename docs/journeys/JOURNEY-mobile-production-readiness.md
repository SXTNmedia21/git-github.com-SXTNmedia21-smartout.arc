---
title: "User Journeys — Mobile Production Readiness"
status: done
updated: 2026-03-26
created: 2026-03-26
module: mobile
tags: [mobile, walkAi, journeys, hub, deep-links]
---

# User Journeys — Mobile Production Readiness

## Journey: Employee — Voice AI Interaction (J7)

**Precondition:** Employee is authenticated, has an active workspace, mobile app open.

1. Employee taps Botsson FAB (center tab bar) → System opens WalkAiSheet (75% height bottom sheet) → Employee sees status orb + mic button
2. Employee taps mic button → System starts voice session via WalkAi provider → Status shows "Kobler til..." then "Lytter..."
3. Employee speaks question → Agent processes with shift/role/task context → Agent responds via voice, transcript scrolls
4. Employee taps mic again → System toggles mute → Status shows "Mikrofon av"
5. Employee swipes down or taps X → System ends session, sheet dismisses

**Postcondition:** Voice session ended, transcript discarded (no persistence in v1.0).

**Error paths:**

- No internet: voice unavailable, toast shown "Tale krever internettforbindelse"
- Mic permission denied: error message "Mikrofontilgang kreves for tale"
- Connection fails: status shows "Feil - prov igjen", mic button restarts session

## Journey: Employee — Text AI Interaction (J7 fallback)

**Precondition:** Employee is authenticated, mobile app open.

1. Employee long-presses Botsson FAB → System opens BotssonSheet (70% height, text chat)
2. Employee types message → System sends to Stage Engine with mobile context
3. Agent responds with text → Message appears in inverted FlatList
4. Employee can continue conversation or dismiss sheet

**Postcondition:** Text conversation persisted via existing chat_conversation system.

## Journey: Employee — Push Notification Deep Link (J2)

**Precondition:** Employee has push notifications enabled, receives a notification.

1. Employee receives push notification (shift reminder, chat message, task assigned, etc.)
2. Employee taps notification → System resolves deep link via `resolveDeepLink(type, data)`
3. App opens directly to the correct screen:
   - `shift_reminder` → Shift detail screen
   - `chat_message` → Chat conversation
   - `task_assigned` → Home hub (task visible in priority cards)
   - `deviation_reported` → Deviation view
   - `hours_confirmation` → Shift detail for confirmation
   - `absence_approved` → Absence balance screen
   - `komm_message` → Komm channel
4. Telemetry event `notification deep_link_followed` emitted

**Postcondition:** Employee is on the relevant screen, ready to act.

**Error paths:**

- Unknown notification type: falls back to notification list screen
- App not running: cold start → deep link resolves after auth

## Journey: Employee — Smart Home Hub (J3/J4)

**Precondition:** Employee is authenticated, opens app or navigates to home tab.

1. Employee opens app → System runs `prioritizeActions()` with current state
2. Home screen shows priority action cards above phase content:
   - During shift + no punch: "Punch inn na" (priority 1, red border)
   - Overdue tasks: "Temperaturkontroll er forfalt" (priority 3, red border)
   - Upcoming shift: "Ditt skift starter om 45 min" (priority 5, amber border)
   - Unread messages: "3 uleste meldinger" (priority 7, amber border)
3. Employee taps a card → System navigates to the relevant screen via `router.push(action.route)`
4. Below priority cards: existing phase view (BeforeShift/DuringShift/AfterShift/NoShift)

**Postcondition:** Employee sees what needs attention, can act immediately.

**Error paths:**

- No data yet (loading): cards don't render, phase view shows alone
- No actions needed: no cards shown, only phase content

## Journey: Employee — Ring Leader (J16)

**Precondition:** Employee is authenticated, has a team leader assigned.

1. Employee navigates to Me tab
2. Employee taps "Ring leder" button (visible during shift)
3. System looks up leader phone via `useLeaderPhone` hook (team_member → team → profile → user_identity.phone)
4. System opens native phone dialer with `tel:` URL
5. Phone dialer opens with leader's number

**Postcondition:** Phone call initiated to team leader.

**Error paths:**

- No leader assigned / no phone number: Alert "Ingen leder er tilgjengelig. Bruk chat."
- Device can't open tel: URL (web/simulator): Alert "Kan ikke apne telefon pa denne enheten."

## Journey: Admin — AI Capability Configuration (future v1.1)

**Precondition:** Not implemented in v1.0. All capabilities default to `read_only`.

The 3 new capabilities (schedule, operations, communication) are registered in the capability registry with authority levels:

- `readOnlyTools`: all query tools available at `read_only` authority
- `suggestTools`: mutation tools (create_deviation, complete_task, send_message) available at `suggest` authority

Per-role authority requires v1.1 ADR. In v1.0, all users get `read_only` default.
