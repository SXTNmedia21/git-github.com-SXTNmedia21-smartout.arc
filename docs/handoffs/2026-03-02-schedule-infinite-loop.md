---
title: "Handoff — Schedule Page Infinite Re-render Loop"
status: in_progress
updated: 2026-03-02
created: 2026-03-02
module: schedule-ui
tags: [bug, react, infinite-loop, dashboard-shell]
---

# Handoff — Schedule Page Infinite Re-render Loop

## Bug

`Maximum update depth exceeded` on the schedule page (`/dashboard/schedule`). Triggers when:

- Loading the schedule page
- Creating a shift

Stack trace always points to `<ShiftModal />` inside `SchedulePageContent`, but ShiftModal is just where React hits the depth limit — the loop originates earlier.

## Root Cause (Confirmed)

**Bidirectional state cycle** between `SchedulePageContent` and `DashboardShell` via `DashboardContext`:

```
SchedulePageContent useEffect
  → calls setScheduleDraftCount(N) / setOnPublishAll(fn)
  → changes DashboardShell state
  → dashboardContextValue useMemo recalculates
  → DashboardContext.Provider gives new value
  → SchedulePageContent re-renders (context consumer)
  → effect deps appear changed (unstable refs)
  → effect re-fires → LOOP
```

The specific instabilities:

1. `publishShifts` (useMutation result) — new object every render
2. `shiftsQuery.data ?? []` — new `[]` reference when data is undefined
3. `employeesQuery.data ?? []` — same pattern in ShiftModal
4. `onPublishAllRef` stored as `useState` — new arrow function triggers state change
5. `scheduleDraftCount` stored as `useState` — triggers context recalculation

## Changes Made (in development branch, unverified)

### Files changed:

**`apps/web/src/components/dashboard/DashboardShell.tsx`**

- `onPublishAllRef`: `useState` → `useRef` (no re-render when publish callback changes)
- `scheduleDraftCount`: `useState` → `useRef` + local tick counter
- `setScheduleDraftCount`: `useCallback` that writes to ref + increments tick
- Tick counter NOT in `dashboardContextValue` useMemo deps → no context propagation
- Button reads `scheduleDraftCountRef.current` and `onPublishAllRef.current` directly

**`apps/web/src/app/dashboard/schedule/page.tsx`**

- `shifts`: `shiftsQuery.data ?? []` → `useMemo(() => shiftsQuery.data ?? [], [shiftsQuery.data])`
- `draftIds`: memoized separately
- `publishMutate`: stored in `useRef` to avoid TanStack mutation stability issues
- Single `useEffect` with deps `[draftCount, setScheduleDraftCount, setOnPublishAll]`
- Added `useRef` to import

**`apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx`**

- `employees`: `employeesQuery.data ?? []` → `useMemo(...)`
- `shifts`: destructuring default `= []` → `useMemo(...)`
- `setShiftTasks([])` → `setShiftTasks((prev) => prev.length === 0 ? prev : [])` (avoids unnecessary state update)

## Problem: Changes Not Taking Effect

Despite editing the files and restarting the dev server, the **browser still shows old line numbers** (475 instead of 487 for ShiftModal). This suggests:

1. **Turbopack source map caching** — hard refresh (Ctrl+Shift+R) or clear browser cache
2. **Wrong dev server instance** — verify `lsof -i:3050` points to the right process
3. **WSL file system delay** — WSL2 sometimes has stale file system caching

## To Verify

1. Hard refresh browser (Ctrl+Shift+R) on the schedule page
2. Open browser DevTools → Sources → check if the schedule/page.tsx shows the new code (look for `publishMutateRef` or `draftIdsRef`)
3. If old code is still showing: kill ALL node processes (`pkill -f "next dev"`), clear `.next` cache (`rm -rf apps/web/.next`), restart

## If Changes ARE Active But Loop Persists

The approach of ref-based sync should work. If it doesn't, the loop source is NOT the publish-all/draft-count sync. Next steps:

1. **Add diagnostic logging** at the top of SchedulePageContent render:
   ```tsx
   const renderCount = useRef(0);
   renderCount.current++;
   console.log("SchedulePageContent render #", renderCount.current);
   ```
2. **Comment out ShiftModal** to confirm it's not ShiftModal's internal effects
3. **Comment out the useEffect** in page.tsx entirely to confirm it's the effect
4. **Check DashboardContext consumers** — any other consumer on the schedule page calling setters in effects?

## Alternative Fix (Nuclear Option)

If the ref-based approach doesn't work, remove the cross-component sync entirely:

- Move the "Publiser (N)" button from DashboardShell header INTO SchedulePageContent's own toolbar
- Remove `scheduleDraftCount` and `onPublishAll` from DashboardContext
- No bidirectional dependency = no loop possible

## Key Files

| File                                                                      | Role                                          |
| ------------------------------------------------------------------------- | --------------------------------------------- |
| `apps/web/src/components/dashboard/DashboardShell.tsx`                    | Shell with DashboardContext provider          |
| `apps/web/src/app/dashboard/schedule/page.tsx`                            | Schedule page — SchedulePageContent component |
| `apps/web/src/app/dashboard/schedule/_components/shift-modal.tsx`         | Shift create/edit modal                       |
| `apps/web/src/app/dashboard/schedule/_components/schedule-ui-context.tsx` | ScheduleUI context (ephemeral UI state)       |
| `apps/web/src/app/dashboard/schedule/_hooks/use-shifts.ts`                | TanStack Query hooks for shifts CRUD          |
