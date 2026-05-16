---
title: Mobile Cross-Feature Deep Links
status: draft
updated: 2026-05-15
created: 2026-05-15
module: mobile
tags: [mobile, deep-links, cross-feature, navigation, sitemap]
---

# Cross-Feature Deep Links

Navigation that crosses tab or feature boundaries.

## Schedule → Punch-Clock

`/(app)/(shifts)/[id].tsx:421` — "Stemple inn" CTA in shift detail bottom bar:
```
router.push("/(app)/(home)/punch-clock")
```
Context: shift detail is in the Vakter tab; punch-clock lives in the Hjem stack. This is the primary cross-tab action.

## Schedule → Swap

`/(app)/(shifts)/[id].tsx:403`:
```
router.push({ pathname: "/(app)/(shifts)/swap", params: { shiftId: shift.schedule_shift_id } })
```
Within the same Vakter tab stack.

## Home → Operations (from ActionBar)

ActionBar at `apps/mobile/src/components/navigation/ActionBar.tsx` renders on both `(home)/index.tsx` and `(me)/index.tsx`:
```
Oppgaver  → /(app)/(home)/operations
Opplæring → /(app)/(home)/training
Sikkerhet → /(app)/(home)/hms
Lønn      → /(app)/(me)/payroll
```

"Lønn" from ActionBar on the Home tab navigates to `/(me)/payroll` — crossing to the Min Tid tab stack.

## Home → Vakter (from Operations + Calendar)

`(home)/operations.tsx:162`: filter chip "Vakter" navigates to `/(app)/(shifts)`.
`(calendar)/index.tsx:305`: filter chip "Vakter" navigates to `/(app)/(shifts)`.
Both cross from their tab group into the Vakter tab.

## Home → Settings (from multiple tabs)

Settings (logout + edit-profile) is accessed via the Menu icon from:
- `(home)/index.tsx`
- `(home)/punch-clock.tsx`
- `(chat)/index.tsx`
- `(me)/index.tsx`

All navigate to `/(app)/(home)/settings` — the settings route lives in the Hjem stack regardless of originating tab.

## Me → Home/Settings

`(me)/index.tsx:229`: "Personvern og sikkerhet" quick link → `/(app)/(home)/settings`.
Crosses from Min Tid to Hjem stack.

## Komm (hidden) → Chat (visible)

`(komm)/index.tsx:95`: channel row tap → `/(app)/(chat)/${conversation.id}`.
Helpdesk ticket thread routes to the Chat tab's conversation detail. The `(komm)` surface is hidden from the tab bar; tickets effectively resolve in the Chat surface.

## Notification Deep Links

`NotificationBell` component at `apps/mobile/src/components/notifications/NotificationBell.tsx` opens `NotificationSheet` (bottom sheet, no route change). Specific notification tap targets are not yet mapped to deep links in the code surveyed.

## Journey Deep Link

`/(app)/journey/[id]/guided` is suppressed (`href: null`) but reachable via `router.push`. It is a thin client for guided journeys via BFF (`/api/journey/guided/*`). No in-app link currently navigates here — entry point is expected to be a push notification or explicit programmatic navigation.

## Clockout Deep Link

`(home)/clockout.tsx` comment: "Deep-link source: `smartout://clockout?sessionId=...&source=push`." Push notification deep-link handler expected. No in-app nav link surveyed.

## Proposed Plan (bundle approval)

`(shifts)/proposed-plan.tsx` — no `router.push` from any surveyed screen leads here. Entry expected via push notification or server-triggered redirect. Navigation dead-end: route exists but no path into it from within the app.
