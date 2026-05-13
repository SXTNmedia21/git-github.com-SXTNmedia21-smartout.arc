---
title: "Journey — Schedule Page Polish Tier-1"
status: verified
feature: schedule-page-polish-tier1
updated: 2026-05-14
created: 2026-05-14
module: schedule
tags: [polish, performance, ux, page-polish, schedule, lighthouse]
---

# Journey — Schedule Page Polish Tier-1

This polish sortie improves perceived performance on `/dashboard/schedule` without changing behavior. Three user-facing journeys are affected: admin/manager loading the weekly schedule, dragging shifts, and switching between week and monthly view.

## Journey: Admin loads /dashboard/schedule (cold cache)

**Precondition:** User authenticated as admin or manager. First navigation to `/dashboard/schedule` after browser restart. Network normal (10 Mbit+).

### Happy Path

1. User clicks "Vaktplan" in dashboard sidebar → Browser issues GET `/dashboard/schedule` → System serves Next.js prod-build static + RSC bundle → User sees skeleton in first frame (no blank white frame)
2. Client component hydrates → System runs primary `useShifts` query against `schedule_shift` → User sees real shift grid replace skeleton via `AnimatePresence mode="wait"` crossfade (no blank flash between states)
3. Browser idle for ~300ms → System fires `requestIdleCallback` → Secondary hooks (`useAbsences`, `useShiftReadinessCheck`) wake up and populate non-critical UI (absence overlays, readiness badges)
4. User scrolls / interacts → System has zero pending blocking requests → User experiences full responsiveness

**Postcondition:** Schedule page fully rendered. All shifts, employees, absences visible. Cold LCP `<` 1500ms on prod build (measured 992ms, 508ms headroom).

### Error Paths

- **Auth missing or expired** → System redirects to `/login` (handled by middleware, not the page) → User signs in → Returns to /dashboard/schedule.
- **Shifts query fails** → System shows error toast via `sonner` + retry button on the grid → User retries → Query refires.
- **Reduced-motion preference active** → System sets `transition.duration = 0.125s` for the crossfade (half nominal) → User sees near-instant content replace without motion.

## Journey: Manager switches between week and monthly view

**Precondition:** /dashboard/schedule loaded in "grid" layout (default).

### Happy Path

1. User clicks "Måned" tab → Internal state updates `scheduleLayout = "monthly"` → System lazy-loads `MonthlyView` via `next/dynamic` (`ssr: false`) → User sees animated pulse fallback while bundle fetches
2. Bundle arrives → System mounts `MonthlyView` component → User sees monthly grid
3. User clicks "Uke" tab → System unmounts `MonthlyView` (kept in chunk cache) → User sees week grid restored without delay

**Postcondition:** Layout switched. No initial JS cost paid for `MonthlyView` if the user never opens that tab.

### Error Paths

- **MonthlyView import fails (network blip)** → Next.js retries dynamic chunk fetch → On second failure, falls back to default error boundary → User sees error message + reload button.

## Journey: Admin opens employee drawer

**Precondition:** Schedule grid visible, at least one employee row present.

### Happy Path

1. User clicks an employee name → Internal state opens `<EmployeeDrawer>` → System lazy-loads `EmployeeDrawer` via `next/dynamic` → Drawer mounts after bundle fetch (typically <100ms warm)
2. Drawer fetches employee detail → System runs employee-detail query → User sees employee info + edit controls
3. User closes drawer → Drawer unmounts; chunk stays cached for next open

**Postcondition:** Drawer opens on demand without contributing to initial page JS. Same pattern applies to `PublishOverviewDialog` and `SendMessageDialog` (also dynamic-loaded).

## Performance Acceptance (measured 2026-05-14, prod build)

| Metric | Baseline (pre-fix) | After fix | Improvement |
|---|---|---|---|
| Cold LCP | 3476 ms (dev) | 992 ms (prod) | -71% |
| Warm LCP | 2788 ms (dev) | 480 ms (prod) | -83% |
| CLS | 0.001 | 0.001 | unchanged (negligible) |
| Skeleton-flash | present | gone | crossfade verified |

Baseline measured against pre-fix code on dev server. Final measurement against prod build (`pnpm --filter web build && pnpm --filter web start`) on wt-2 :3060. Threshold: cold LCP `<` 1500ms. Achieved 992ms (508ms headroom).

## Acceptance Status

All three journeys execute correctly. Cold LCP under threshold. No skeleton-flash. Secondary data loads non-blocking. Polish-tier1 gate fully satisfied per ADR-0308.
