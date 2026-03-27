---
title: "Journey — Cascade Task Surface"
status: done
updated: 2026-03-27
created: 2026-03-27
module: dashboard
tags: [journey, cascade, task-surface, todo]
---

# Journey — Cascade Task Surface

This document describes the user journeys for the cascade-driven task surface ("A gjore" tab) that replaced the Guardian/Vakt dashboard tab. The task surface shows admins what needs doing across all cascade dimensions, grouped by domain, with completion tracking and urgency-sorted cards.

---

## Journey: Admin — Dashboard Task Overview

**Precondition:** Admin is logged in, has an active workspace, and is on the dashboard page.

1. Admin opens the dashboard (or clicks "A gjore" in sidebar/tab switcher)
   -> System sets `adminView` to `"todo"` (default on load)
   -> User sees the DailyStatusBar at the top, then the TodoTaskView below

2. System calls `resolve_cascade_tasks` RPC with the workspace ID
   -> RPC scans 8 domain groups across cascade dimensions (D1 Departments, D2 Staff, D3 Framework, D4 Budget, C4 Governance, D6 Schedule, D2 Contracts, C2 Messages)
   -> While loading, user sees a skeleton placeholder (3 group skeletons with card placeholders)

3. Data arrives. System sorts groups by highest urgency (critical first, then should, then can_wait, completed groups last)
   -> User sees collapsible group sections, each with:
   - Domain icon (Building2, Users, Scale, TrendingUp, ShieldCheck, CalendarDays, FileText, MessageSquare)
   - Group label (e.g. "dashboard.todo.group.departments")
   - Fraction display ("3 av 5") in Geist Mono
   - Animated progress bar (orange for incomplete, green for complete, spring physics)
   - Chevron toggle for collapse/expand

4. Within each group, tasks are sorted by urgency (critical -> should -> can_wait)
   -> Each task card shows:
   - Left border color by urgency (destructive = critical, warning = should, border = can_wait)
   - Urgency icon (AlertCircle / Clock / Info)
   - Title with interpolated params (e.g. "{name} mangler apningstider")
   - Description text
   - Orange chevron-right indicating navigation

5. System emits `task_surface viewed` telemetry event with total_tasks and critical_count

**Postcondition:** Admin sees a complete overview of all pending workspace tasks, grouped and prioritized. Completed groups appear collapsed at the bottom.

**Error paths:**

- RPC fails -> User sees error state with AlertCircle icon, "Kunne ikke laste oppgaver" message, and "Prov igjen" button that triggers refetch
- No workspace context -> Hook is disabled (`enabled: false`), no RPC call made
- Empty data (null/undefined) -> Shows TodoEmptyState (see "All tasks complete" journey)

---

## Journey: Admin — Navigate to Fix a Task

**Precondition:** Admin is viewing the task surface with at least one pending task.

1. Admin sees a task card (e.g. "Restaurant mangler apningstider" under Departments group)
   -> Card has `role="button"`, `tabIndex={0}`, cursor-pointer styling

2. Admin clicks the task card (or presses Enter/Space when focused)
   -> System emits `task_surface clicked` telemetry with group, dimension, urgency, and entity info
   -> System navigates via `router.push(task.href)` to the relevant dashboard section

3. Navigation targets by group:
   - departments -> `/dashboard/organization`
   - staff -> `/dashboard/people`
   - framework -> `/dashboard/settings`
   - budget -> `/dashboard/season`
   - governance -> `/dashboard/governance`
   - schedule -> `/dashboard/schedule`
   - contracts -> `/dashboard/people`
   - messages -> `/dashboard/notifications`

4. Admin resolves the issue in the target page (e.g. adds operating hours to a department)

5. Admin returns to dashboard (via sidebar or browser back)
   -> `useCascadeTasks` hook has `staleTime: 30_000` (30s) and `refetchInterval: 5 * 60_000` (5 min)
   -> If data is stale, system refetches automatically
   -> Resolved task no longer appears in the list
   -> Group progress bar animates to reflect new done/total ratio
   -> Task card exits with slide-left animation (x: -20, 250ms)

**Postcondition:** The resolved task is removed from the surface. Group progress updates. If all tasks in a group are resolved, the group shows a green CheckCircle2 icon and auto-collapses.

**Error paths:**

- Navigation target page doesn't exist -> Standard Next.js 404 handling
- Task resolved but cache not yet invalidated -> Task still shows for up to 30s, then disappears on next refetch

---

## Journey: Admin — Onboarding Guide (New Workspace)

**Precondition:** Admin has a new workspace with critical cascade tasks (critical_count > 0). The onboarding guide has not been dismissed.

1. System loads cascade tasks via `useCascadeTasks` RPC
   -> `useOnboardingGuide` hook consumes `cascadeData.critical_count`
   -> If `critical_count > 0` and guide is not marked complete, `shouldShow` is `true`

2. OnboardingGuide component renders as a multi-step wizard overlay
   -> Steps: Welcome, Document Drop, Governance, Payroll, Employment, Team, Shift Templates, Season, Handbook
   -> Each step guides the admin through setting up a specific domain area

3. Admin progresses through wizard steps
   -> Each completed step is persisted to `workspace.onboarding_guide_progress` (JSONB column)
   -> System emits `onboarding_guide updated` telemetry on each save

4. As admin completes setup tasks, cascade critical_count decreases
   -> When `critical_count` reaches 0, `needsSetup` becomes `false`
   -> On next query, `useOnboardingGuide` returns `isComplete: true`
   -> Guide no longer shows (`shouldShow` becomes `false`)

**Postcondition:** Workspace has all critical dimensions configured. Onboarding guide is dismissed. Task surface shows remaining non-critical tasks (should/can_wait).

**Error paths:**

- Admin dismisses guide before completing all critical tasks -> Guide can be re-shown as long as critical_count > 0
- Workspace data fails to save -> Mutation error, guide state reverts to previous on next query

---

## Journey: Admin — All Tasks Complete

**Precondition:** Admin has resolved all cascade tasks across all dimensions.

1. System calls `resolve_cascade_tasks` RPC
   -> RPC returns `total_tasks: 0` (all groups have empty task arrays)

2. TodoTaskView checks `data.total_tasks === 0`
   -> Renders TodoEmptyState component instead of group sections

3. User sees:
   - Ambient orb glow (success color, blur 80px, 8% opacity) behind a large circle
   - Green CircleCheck icon (h-12, w-12) inside a success-tinted circle (h-20, w-20)
   - Heading: "Alt er i orden" (Instrument Serif via font-heading)
   - Subtext: "Ingen oppgaver krever oppmerksomhet" (muted-foreground)

4. Tab badge in the dashboard tab switcher shows no count (badge hidden when pendingCount is 0)

**Postcondition:** Admin sees a clean celebration state. No action required. System continues to poll every 5 minutes for new tasks.

**Error paths:**

- New tasks appear (e.g. contract expires within 30 days) -> Next refetch cycle surfaces them, empty state is replaced by task groups
- Data returns null/undefined -> Same empty state shown (defensive fallback)

---

## Technical Notes

### Task Groups and Dimensions

| Group       | Dimension | Checks                                                         | Urgency Range              |
| ----------- | --------- | -------------------------------------------------------------- | -------------------------- |
| departments | D1        | No departments, missing hours, missing positions, no locations | critical, should, can_wait |
| staff       | D2        | Missing contract, missing payroll, incomplete profile, no team | critical, should, can_wait |
| framework   | D3        | No framework binding, no tariffs, no holidays                  | critical, should           |
| budget      | D4        | No active season, no budget, no day factors, no hour factors   | critical, should, can_wait |
| governance  | C4        | Few policies (<3), unassigned profiles, incomplete training    | critical, should           |
| schedule    | D6        | No shifts, unmanned shifts (7d), no templates                  | critical, should, can_wait |
| contracts   | D2        | Unsigned contracts, expiring contracts (30d)                   | should                     |
| messages    | C2        | Pending change proposals                                       | should                     |

### Data Flow

```
resolve_cascade_tasks (RPC, SECURITY INVOKER)
  -> useCascadeTasks (TanStack Query, 30s stale, 5min refetch)
    -> TodoTaskView (sorts groups, renders)
      -> TodoGroupSection (per group, collapsible, progress bar)
        -> TodoTaskCard (per task, clickable, telemetry on click)
  -> useCascadeTaskCount (same query key, select: critical + should counts)
    -> TodoTabButton badge (in DashboardShell tab switcher)
  -> useOnboardingGuide (consumes critical_count for shouldShow flag)
```

### Telemetry Events

- `task_surface viewed` — emitted when TodoTaskView mounts with data (total_tasks, critical_count)
- `task_surface clicked` — emitted when admin clicks a task card (group, dimension, urgency)
- `onboarding_guide updated` — emitted when wizard step progress is saved
