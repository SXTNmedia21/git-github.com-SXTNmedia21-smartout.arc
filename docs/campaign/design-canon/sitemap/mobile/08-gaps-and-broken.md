---
title: Mobile Gaps and Broken Routes
status: draft
updated: 2026-05-15
created: 2026-05-15
module: mobile
tags: [mobile, gaps, broken, orphans, sitemap]
---

# Gaps and Broken Routes

## 1. Dead Stack Registrations (registered but name mismatch)

### `payroll-supplements` vs `supplements`

- Registered in `apps/mobile/app/(app)/(me)/payroll/_layout.tsx:116`: `<Stack.Screen name="payroll-supplements" />`
- File on disk: `apps/mobile/app/(app)/(me)/payroll/supplements.tsx`
- Expo Router maps file name → route segment: `supplements`, not `payroll-supplements`
- Navigation from `payroll/index.tsx` uses `router.push("./supplements")` — this works because it uses the file-based route
- The registered `payroll-supplements` screen name is a phantom — no screen options applied, but navigation still functions via file path
- **Risk:** any screen options set on `payroll-supplements` (animation, header) will never apply

## 2. Orphan Components (complete implementations not connected to any route)

### `ShiftClockView` — full punch-clock implementation

- File: `apps/mobile/src/components/shift-clock/ShiftClockView.tsx`
- Complete with sub-components: `BreakToggle`, `PunchAnimation`, `ShiftClockActions`, `ShiftClockHeader`, `ShiftClockSummary`, `SupplementSheet`
- No route or screen imports `ShiftClockView`
- `(home)/punch-clock.tsx` is a parallel inline implementation using `useShiftClock` hook directly
- **Gap:** two complete punch-clock implementations exist; `ShiftClockView` is dead code; `punch-clock.tsx` is missing the full feature set that `ShiftClockView` provides (break toggle, supplements sheet, GPS guard)

## 3. Unregistered Dynamic Route

### `team/[id]` not in `(home)/_layout.tsx`

- File: `apps/mobile/app/(app)/(home)/team/[id].tsx`
- Not registered in `apps/mobile/app/(app)/(home)/_layout.tsx`
- `apps/mobile/app/(app)/(home)/team.tsx:102` navigates to `/(app)/(home)/team/${profileId}`
- Expo Router will auto-resolve the file, but no Stack.Screen options (title, animation, header) are applied
- No back navigation issue — hardware back works; but screen enters without animation spec

## 4. Stub / Placeholder Screens

### Training — data not wired

- `apps/mobile/app/(app)/(home)/training.tsx:11`: "Data is placeholder until training hooks are wired to protocol_assignment and knowledge_test tables."
- `useTrainingData` hook exists but likely returns empty/stub data
- Layout is production-ready; backend wiring is missing

### Calendar — Phase 3f stub

- `apps/mobile/app/(app)/(calendar)/_layout.tsx:4`: "Stub for Phase 3f. Full calendar screens (WeekView, MonthView, DayView) are built in Phase 3c."
- Calendar tab is hidden (`href: null`). Files exist and WeekView/MonthView work; but tab is not exposed in tab bar

### Shift detail — Tasks and Emma tabs empty

- `apps/mobile/app/(app)/(shifts)/[id].tsx:361-376`: Tasks tab renders "Ingen oppgaver for denne vakten ennå." (stub)
- Emma tab renders a Sparkles icon + "Spør Emma om denne vakten." (stub)
- No hook or BFF call behind either tab

## 5. "Vakter Laster Ikke" — Shifts Tab Loading Issue

User-reported: Vakter tab shows loading state.

Diagnosis from code (not reproduced):
- `useTeamShifts` queries `schedule_shift` with `.eq("is_published", true)`
- If seed data has no shifts with `is_published = true`, query returns 0 rows
- Loading state resolves to `!isLoading && !error && shifts.length === 0`
- In this state, 7 `DayCrewCluster` boxes render with "Ingen vakter." — NOT a loading spinner
- If the tab is stuck on "Laster vakter…" text, the query is still in `isLoading: true` state
- Likely cause: `selectedProfileId` in `useWorkspaceStore` is null → `fetchTeamShifts` falls back to resolving profile from auth, which may fail or return null workspace
- Secondary: `useTeamShifts` has `staleTime: 5 * 60 * 1000` and `retry: 1` — if first attempt fails, retry happens once then error state shows

**Not a UI-only bug.** Root cause is either missing `selectedProfileId` in store or Supabase RLS returning 0 rows for the resolved workspace.

## 6. Navigation Dead-Ends (no in-app entry point)

| Route | Has back path | Entry point |
|-------|-------------|------------|
| `(shifts)/proposed-plan` | yes (back) | No in-app navigation leads here; entry expected via push notification |
| `(app)/journey/[id]/guided` | yes (back) | No in-app navigation leads here; entry expected via push notification or server redirect |
| `(home)/clockout` | yes (back) | Deep-link `smartout://clockout?sessionId=...&source=push`; no in-app navigation entry |
| `(me)/design-preview` | yes (back) | Dev-only; no in-app link; direct push only |

## 7. Duplicate Implementations

| Feature | Implementation A | Implementation B | Status |
|---------|-----------------|-----------------|--------|
| Punch clock | `(home)/punch-clock.tsx` (inline) | `ShiftClockView.tsx` (full component) | A is live; B is orphan |
| During-shift view | `DuringShiftView.tsx` (V1) | `DuringShiftView.v2.tsx` (gradient hero) | V1 default; V2 behind feature flag `EXPO_PUBLIC_DURING_SHIFT_V2` |
| Komm / queue | `(komm)/index.tsx` | `(queue)/index.tsx` | Komm supersedes Queue per ADR-0165; both exist, queue hidden |

## 8. ADR-0268 Drift

- ADR-0268 specifies tab order: **Kalender · Vakter · FAB · Chat · Min Tid**
- Reality: **Hjem · Vakter · FAB · Chat · Min Tid** (Calendar replaced by Home)
- Calendar is hidden (`href: null`) — accessible programmatically but not in tab bar
- `(app)/_layout.tsx:32-34`: comment acknowledges the override: "Supersedes the ADR-0268 anchor decision (was (calendar))."
- ADR-0268 has not been amended to reflect the new tab order

## 9. ADR-0133 Drift Hotspots

ADR-0133 bans authoring screens on mobile. Review flags:

| Screen | Verb | Compliant? |
|--------|------|-----------|
| `(shifts)/create.tsx` | Author (create shift) | **Borderline** — "Ny vakt" for managers only; ADR-0133 allows Approve verbs; create is an Author verb. Note: file says "ADR-0270 BFF refactor" but does not cite ADR-0133 compliance |
| `(shifts)/roster.tsx` | Read-only view | Yes |
| `(home)/clockout.tsx` | Approve/Lock (duty leader) | Yes (C4 gate per comment) |
| `(shifts)/proposed-plan.tsx` | Approve/Reject | Yes — explicitly cited ADR-0133 |

## 10. Contract Screens — Direct Supabase Calls

`(me)/contract/index.tsx` and `(me)/contract/[id].tsx` call `supabase` directly in `useEffect` — not wrapped in TanStack Query. This bypasses the offline queue, loses cache, and has no `emit()` call on mutation (ADR-0134 non-compliant for any future writes).
