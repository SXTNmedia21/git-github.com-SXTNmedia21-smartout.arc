---
title: "User Journeys — Dashboard Redesign"
status: done
updated: 2026-03-02
created: 2026-03-02
module: dashboard
tags: [journeys, dashboard, tactical, strategic, reconciliation, activity, employee, action-strip]
---

# User Journeys -- Dashboard Redesign

This document covers all user journeys for the 5 persona-driven dashboard views and the shared Action Strip component.

---

## Journey: Manager (Ingrid) Reviews Daily Staffing and Training -- Tactical View

**Precondition:** Ingrid is logged in as a user with role `manager` or higher. She has an active workspace with scheduled shifts and protocol assignments. The DashboardShell is set to `isAdminMode = true` and `adminView = "tactical"`.

### Happy Path

1. Ingrid navigates to `/dashboard` --> System loads AdminDashboard, which renders TacticalView by default --> Ingrid sees 4 signal cards at the top: Staffing Coverage, Training Readiness, Cost of Sales (placeholder), and Absence MTD (placeholder).
2. System calls `useStaffingCoverage(weekStart)` and `useTrainingReadiness()` --> TanStack Query fetches shift fill data for the current week and protocol assignment stats --> Signal cards display computed values with color-coded status (green >= 90%, orange >= 70%, red < 70%).
3. Ingrid views the 7-day staffing coverage chart below the signal cards --> System renders horizontal bar chart with one row per day showing fill percentage --> Bars are color-coded (emerald >= 100%, orange >= 80%, red < 80%) with "X Open" labels for unfilled shifts.
4. Ingrid clicks the right chevron arrow to view next week --> System increments `weekOffset` by 1, re-fetches coverage data for the new week --> Chart updates with new week number in the header and fresh bar data.
5. Ingrid clicks "Today" button to return to current week --> System resets `weekOffset` to 0 --> Chart returns to current week view.
6. Ingrid reviews the Training & Compliance sidebar widget --> System shows pending protocol count, completion ratio (e.g., "8 of 12 protocol assignments completed (67%)"), and overall Readiness Score percentage.
7. Ingrid notes the Upcoming Events widget shows "Event integration coming soon" --> This is a placeholder for future calendar integration.

### Error Paths

- **No shifts scheduled this week:** If `coverage` is empty, the chart area displays "No shifts scheduled this week" centered message instead of bars.
- **Coverage data loading:** While `coverageLoading` is true, 7 skeleton placeholder rows with pulse animation are shown.
- **Training data unavailable:** If `useTrainingReadiness()` returns no data, signal cards show "--" and the compliance widget shows "All protocols up to date" (defaults to healthy state).
- **Network failure on query:** TanStack Query retries automatically. If persistent, signal cards remain at "--" and bars show loading state.

**Postcondition:** Ingrid has a clear picture of this week's staffing gaps and team readiness. She can identify days needing coverage and protocol assignments that are pending.

---

## Journey: Owner (Erik) Monitors Workforce KPIs -- Strategic View

**Precondition:** Erik is logged in with role `owner` or `admin`. DashboardShell has `adminView = "strategic"`. Workspace has location data, workforce pipeline data, and training assignments.

### Happy Path

1. Erik navigates to the Strategic view via the admin view selector --> System renders StrategicView with "Strategic Insights" header, location pill selector (All Locations, plus individual locations), and KPI grid.
2. Erik sees 6 KPI cards in a responsive grid: Cost of Sales %, 90-Day Turnover, Absence Rate, Time to Job-Ready, Task Completion, Training Readiness --> Each card shows current value, target threshold, and a good/bad status badge. Hovering a card flips it to show "How is this calculated?" explanation text.
3. Erik clicks a specific location pill (e.g., "Trondheim City") --> System animates pill selection with framer-motion layoutId transition --> KPI values update to location-specific metrics (from `defaultMetrics` data). AnimatePresence triggers a smooth fade/slide transition on the KPI grid.
4. Erik scrolls down to the Turnover Trend & Forecast chart --> System renders a 6-month bar chart (Sep-Feb) with bars colored blue (below target) or red (above target). A dashed target line is positioned at the configured turnover target percentage. Hovering a bar shows exact percentage tooltip.
5. Erik clicks "Configure Goals" button (gear icon) --> System opens a Dialog modal with 4 numeric input fields: Cost of Sales Target, Turnover Target, Absence Threshold, Time to Job-Ready Target --> Erik adjusts the Turnover Target from 15% to 12%.
6. Erik closes the modal --> System updates all KPI cards and the chart target line to reflect new thresholds --> Previously "good" KPIs may now show "Action" status if they exceed the stricter target.
7. Erik reviews the Workforce Pipeline sidebar --> System calls `useWorkforcePipeline()` and displays: Active Staff count, New Hires (30d) with green highlight, Departures (30d) with red alert if > 2, and Onboarding count. Values switch between live query data (for "All Locations") and location-specific mock data.

### Error Paths

- **No location selected:** Defaults to "All Locations" (`selectedLocId = "all"`), which shows aggregated data.
- **Pipeline query fails:** Workforce Pipeline rows fall back to location-specific mock data values instead of live data.
- **Training query fails:** Training Readiness KPI falls back to location-specific `compliance` value from mock data.
- **Invalid target values:** No validation on numeric inputs -- user can set unreasonable targets (e.g., 0% or 999%). All KPIs would show "Action" or "OK" based on comparison. Targets are local state only (not persisted to database).
- **KPI card hover on mobile:** Touch devices cannot hover; the explanation flip is not accessible. Card shows front face only.

**Postcondition:** Erik has reviewed cross-location workforce health, adjusted KPI targets to match business goals, and identified locations needing attention (e.g., Trondheim with high turnover and absence).

---

## Journey: Manager (Maria) Reconciles Daily Shifts -- Reconciliation View

**Precondition:** Maria is logged in with role `manager` or higher. DashboardShell has `adminView = "reconciliation"`. Workspace has departments with scheduled shifts in `schedule_shift` table.

### Happy Path

1. Maria navigates to the Reconciliation view --> System renders "Daily Reconciliation" header with date navigation (left/right arrows, current date display, "Today" button) and calls `useDepartmentShifts(selectedDate)`.
2. System groups shifts by department and renders a card grid --> Each department card shows: department name with color dot, staff count, total shifts, total hours, and an "X open" badge if any shifts lack an assigned employee.
3. Maria clicks on a department card (e.g., "Kjokken") --> System toggles `expandedDept` state --> Card expands with framer-motion animation to reveal a detailed shift list showing each shift's time range (e.g., "07:00 - 15:00"), role, and work hours.
4. Maria clicks the same card again --> System collapses the expanded section back to summary view.
5. Maria navigates to yesterday using the left chevron --> System decrements `dateOffset`, re-fetches department data for the previous date --> Cards update with yesterday's shift data and date display updates.
6. Maria clicks "Today" button --> System resets `dateOffset` to 0 --> View returns to today's data.

### Error Paths

- **No shifts for selected date:** If `departments` array is empty, system shows a centered empty state with Building icon and message "No shifts scheduled for [date]".
- **Data loading:** While `isLoading` is true, 3 skeleton card placeholders with pulse animation are shown in the grid.
- **Department with all shifts unassigned:** The orange "X open" badge appears on the card. Individual shifts in the expanded view do not show employee names (shifts only show time, role, and hours).
- **Query error:** TanStack Query handles retry. Cards remain in loading state until data arrives or error boundary catches.
- **Far past/future navigation:** No date range limits -- Maria can navigate to any date. Empty dates show the "no shifts" empty state.

**Postcondition:** Maria has reviewed all departments' shift coverage for the selected date, expanded specific departments to check individual shift details, and identified any open shifts needing attention.

---

## Journey: HR Admin (Thomas) Analyzes Activity Patterns -- Activity View

**Precondition:** Thomas is logged in with role `admin` or higher. DashboardShell has `adminView = "activity"`. Workspace has workforce and training data.

### Happy Path

1. Thomas navigates to the Activity view --> System renders "Activity & Heatmap Dashboard" header with Filter and timeframe buttons (currently non-functional placeholders), and calls `useWorkforcePipeline()` and `useTrainingReadiness()`.
2. Thomas sees 4 quick stat cards: Active Staff (from live query), Training Readiness (from live query), Highest Intensity ("Fridays" -- mock), Lowest Intensity ("Sunday AM" -- mock) --> Each card shows trend indicator (green up or red down arrow with detail text).
3. Thomas views the Training Progress bar --> System renders a segmented progress bar showing completed (emerald), pending (amber), and remaining (gray) protocol assignments with legend counts. Bar only appears if `training.totalAssignments > 0`.
4. Thomas sees the heatmap with "Locations" tab active by default --> System renders a 30-day activity heatmap with 5 location rows. Each cell is color-coded from quiet (zinc) through increasing indigo intensity. Hovering a cell shows tooltip with "Location - Day N: Score X".
5. Thomas clicks the "Departments" tab --> System switches `activeTab` to "departments" --> AnimatePresence transitions the heatmap rows, now showing 6 department rows (Kjokken, Servering, Oppvask, etc.) with new mock data.
6. Thomas clicks "Teams" tab --> Heatmap shows 5 team rows (Morgenfuglene, Kveldsgjengen, etc.).
7. Thomas clicks "Users" tab --> Heatmap shows 10 individual employee rows (Anna Olsen, Ola Nordmann, etc.).
8. Thomas scrolls horizontally on the heatmap if viewport is narrow --> The heatmap has `min-w-[800px]` with `overflow-auto` to support horizontal scrolling on smaller screens.

### Error Paths

- **Pipeline query returns no data:** Active Staff stat card shows "--" and trend text is empty.
- **Training query returns no data:** Training Readiness stat card shows "--". Training Progress bar is hidden entirely (conditional render on `training.totalAssignments > 0`).
- **All heatmap data is mock:** Current implementation uses `generateHeatmapData()` with random values. Real data integration is pending. Labels are static strings, not from database.
- **Filter/timeframe buttons non-functional:** Clicking "Filter" or the timeframe dropdown does nothing -- these are UI placeholders for future implementation.
- **Narrow viewport:** Heatmap requires horizontal scroll below 800px width. Tab labels and stat cards reflow to single column on mobile.

**Postcondition:** Thomas has identified activity patterns across locations, departments, teams, and individuals over the past 30 days, and reviewed training progress across the workforce.

---

## Journey: Employee Views Their Workspace -- Employee Dashboard

**Precondition:** Employee is logged in with role `employee`. DashboardShell has `isAdminMode = false`, which causes the main dashboard page to render `EmployeeDashboard` instead of `AdminDashboard`. Employee has a `profileId` available via `DashboardContext`.

### Happy Path

1. Employee opens `/dashboard` --> System detects non-admin mode and renders EmployeeDashboard --> System calls `useMyShifts(profileId)`, `useMyReadiness(profileId)`, and queries open shifts from `schedule_shift` table.
2. Employee sees "Today's Shift" hero card at the top --> If a shift exists for today, the card shows: date badge (day + month), role name (e.g., "Servering"), time range with hours (e.g., "10:00 - 18:00 (8h)"), and a "Punch In" button with gradient glow effect.
3. Employee views the "My Readiness" progress widget --> System shows a progress bar with percentage (emerald at 100%, blue >= 70%, orange < 70%) and text like "2 protocols remaining" or "All protocols completed!".
4. Employee scrolls to "Upcoming Schedule" --> System renders next 5 shifts as a list, each showing weekday, day number, role, and time range. Clicking a shift row shows a hover chevron (future: navigation to shift details).
5. Employee reviews the right sidebar quick actions --> Three buttons available: "Set Availability" (full-width, indigo themed), "Time Off" (half-width, orange icon), "Swap Shift" (half-width, blue icon). All are placeholder buttons (no navigation wired yet).
6. Employee checks "Open Shifts" section --> System queries `schedule_shift` for unassigned, published shifts from today onward (limit 3) --> Each open shift shows date, time range, role, and a "Take Shift" button.
7. Employee views "My Active Tasks" section at bottom --> Currently shows placeholder: "No active task lists. Punch in to get your tasks."

### Error Paths

- **No shift today:** Hero card shows calendar icon with "No shift today" message and suggestion to check upcoming shifts or pick up an open one. "Punch In" button is not shown.
- **Shifts loading:** Hero card area shows a pulse-animated skeleton placeholder.
- **No upcoming shifts:** The upcoming schedule section shows a dashed-border empty state with "No upcoming shifts scheduled."
- **No open shifts available:** Open Shifts section shows "No open shifts available right now."
- **Readiness data unavailable or zero assignments:** If `readiness` is null or `readiness.total === 0`, the entire readiness widget is hidden (conditional render).
- **Profile ID missing:** If `profileId` is not in DashboardContext, shift and readiness queries will fail silently (no data returned).
- **Quick action buttons:** All 3 action buttons are non-functional placeholders -- clicking them does nothing. Future implementation needed.

**Postcondition:** Employee has a clear view of their current shift, upcoming schedule, training progress, and available open shifts. They can identify what to do today and plan for the coming days.

---

## Journey: Admin/Manager Reviews Action Items -- Action Strip

**Precondition:** User is logged in with role `manager`, `admin`, or `owner`. DashboardShell renders in admin mode. ActionStrip is rendered at the top of the dashboard area, above the active admin view.

### Happy Path

1. Admin loads the dashboard --> System renders ActionStrip component which calls `useActionItems()` hook --> TanStack Query fetches counts for 5 action categories.
2. System computes total action count --> If `counts.total > 0`, the strip renders as a horizontal row of colored chips inside a rounded container.
3. Admin sees active chips for non-zero categories:
   - **Shift Gaps** (red chip, CalendarX icon) -- number of unassigned shifts in the coming period
   - **Contracts** (orange chip, FileSignature icon) -- pending employment contracts awaiting signature
   - **Onboarding** (orange chip, UserX icon) -- employees stuck in onboarding process
   - **Protocols** (blue chip, BookOpen icon) -- unassigned or overdue protocol assignments
   - **Invitations** (gray chip, MailWarning icon) -- stale workspace invitations not yet accepted
4. Chips with zero count are hidden (`if (count === 0) return null`).
5. Admin clicks a chip --> Button has hover scale effect (`hover:scale-105`) but no navigation is wired yet (placeholder interaction).
6. On narrow screens, the chip row scrolls horizontally (`overflow-x-auto`), and chip labels collapse to icon + count only (labels hidden below `sm` breakpoint via `hidden sm:inline`).

### Error Paths

- **All action items are zero:** If `counts.total === 0`, the strip renders a green success state: emerald-themed bar with CheckCircle2 icon and "All clear -- no action items pending" message.
- **Data loading:** While `isLoading` is true, 5 skeleton chip placeholders with pulse animation are shown.
- **Query returns null/undefined:** If `counts` is falsy, the green "all clear" state is shown (same as zero total).
- **Chip click has no effect:** Clicking a chip currently does nothing beyond the visual hover effect. Future implementation should navigate to the relevant section (e.g., clicking "Shift Gaps" navigates to schedule page filtered to unassigned shifts).

**Postcondition:** Admin has an at-a-glance summary of all pending action items across the workspace. Zero-count categories are hidden to reduce noise. An all-clear state provides positive reinforcement when no actions are needed.

---

## View Routing Summary

| Role                  | Mode                         | View               | Component            |
| --------------------- | ---------------------------- | ------------------ | -------------------- |
| owner, admin, manager | `isAdminMode = true`         | Tactical (default) | `TacticalView`       |
| owner, admin, manager | `isAdminMode = true`         | Strategic          | `StrategicView`      |
| owner, admin, manager | `isAdminMode = true`         | Reconciliation     | `ReconciliationView` |
| owner, admin, manager | `isAdminMode = true`         | Activity           | `ActivityView`       |
| employee              | `isAdminMode = false`        | Employee workspace | `EmployeeDashboard`  |
| all admin roles       | Always visible in admin mode | Action Strip       | `ActionStrip`        |

The `AdminDashboard` component is a thin view router (~30 lines) that reads `adminView` from `DashboardContext` and renders the corresponding view component. View switching is managed by the DashboardShell sidebar/header controls.
