---
title: "User Journeys — Dashboard Evolution"
status: done
updated: 2026-03-03
created: 2026-03-03
module: dashboard
tags: [dashboard, budget, settings, kpi, heatmap, reconciliation, journeys]
---

# User Journeys -- Dashboard Evolution

This document covers all user journeys for the 9-track dashboard evolution (tracks 1-8 implemented). Major enhancement of the admin dashboard across 4 views: Tactical, Strategic, Reconciliation, and Activity.

**Infrastructure built:** 4 new database tables (`workspace_budget`, `workspace_settings`, `kpi_target` / `workspace_kpi_target`, `kpi_actual`), settings page with opening hours, persistent KPI targets, multi-granularity budget system, reconciliation redesign with table + swipe views, and activity heatmap improvements.

---

## Journey 1: Admin Views Tactical Dashboard (KPI Signals, Coverage Bars, Upcoming Events)

**Precondition:** Admin is logged in with role `manager`, `admin`, or `owner`. DashboardShell has `isAdminMode = true` and `adminView = "tactical"`. Workspace has scheduled shifts and protocol assignments.

### Happy Path

1. Admin navigates to `/dashboard` --> System loads AdminDashboard, which renders TacticalView by default --> Admin sees 4 SignalCard components at the top: Staffing Coverage, Training Readiness, Cost of Sales (placeholder), and Absence MTD (placeholder).
2. System calls `useStaffingCoverage(weekStart)` and `useTrainingReadiness()` --> TanStack Query fetches shift fill data for the current week and protocol assignment stats --> Staffing Coverage card shows computed average fill percentage across all 7 days. Training Readiness card shows readiness percentage with trend showing completed/total (e.g., "8/12").
3. Signal cards display color-coded status: green (>= 90%), orange (>= 70%), red (< 70%). Cost of Sales and Absence cards show "--" with `isPlaceholder` flag.
4. Admin views the 7-day staffing coverage chart in the main panel --> System renders horizontal bar chart with one row per day. Each day row is a clickable button showing day label, fill bar, gap count, and status icon.
5. Bar colors: emerald (>= 100% fill), orange (>= 80%), red (< 80%). Days with open shifts show "X Open" label in orange. Days at 100%+ show a green CheckCircle2 icon. Days with 0 shifts show "No shifts" text.
6. Admin clicks a day bar (e.g., "Mon") --> System calls `onDateClick(date)` --> DayControlSheet opens showing the day's schedule detail (see Journey 8).
7. Admin clicks the right chevron to view next week --> System increments `weekOffset`, re-fetches coverage data via `useStaffingCoverage(newWeekStart)` --> Chart updates with new week number in the header. "Today" button appears when `weekOffset !== 0`.
8. Admin clicks "Today" button --> System resets `weekOffset` to 0 --> Chart returns to current week view.
9. Admin reviews the Training & Compliance sidebar widget --> If pending protocols exist, system shows an orange alert card with count and completion ratio (e.g., "8 of 12 protocol assignments completed (67%)"). If all protocols are up to date, system shows a green card with "All protocols up to date".
10. Admin sees Readiness Score metric in the sidebar showing percentage with "Target 100%" label.
11. Admin reviews the Upcoming Events widget --> Shows placeholder: "Coming soon -- connect events to see staffing impact". A "+" button opens a DayInfoDialog for adding events (future feature).

### Error Paths

- **No shifts scheduled this week:** Coverage chart shows centered "No shifts scheduled this week" message. SignalCard shows "--".
- **Coverage data loading:** 7 skeleton placeholder rows with pulse animation are shown.
- **Training data unavailable:** Training Readiness SignalCard shows "--". Compliance widget defaults to "All protocols up to date" (healthy state).
- **Network failure:** TanStack Query retries automatically. Cards remain at "--" and bars show loading state until resolved.

**Postcondition:** Admin has a clear view of the current week's staffing gaps, protocol compliance status, and readiness score. They can identify days needing coverage and navigate directly to day details.

---

## Journey 2: Admin Clicks Department Tag --> Navigates to Department Detail

**Precondition:** Admin is on the Reconciliation view (cards mode) or any view displaying department/team tags. Workspace has departments with shifts.

### Happy Path

1. Admin is viewing department cards in Reconciliation "Cards" mode --> System renders a grid of DepartmentCard components, each with a color dot, department name, and summary stats (staff count, shifts, total hours).
2. Admin clicks on a department card (e.g., "Kjokken") --> System toggles `expandedDept` state to the department's ID --> Card expands with framer-motion animation to reveal a detailed shift list.
3. Expanded section shows each shift's time range (e.g., "07:00 - 15:00"), role, and work hours. Shifts are listed vertically under a "Shifts & Hours" header.
4. Admin clicks the same department card again --> System sets `expandedDept` back to null --> Card collapses with exit animation.
5. Admin clicks a different department card --> System collapses the previously expanded card and expands the new one.

### Error Paths

- **Department with unassigned shifts:** An orange badge shows "X open" with AlertCircle icon on the card header.
- **Department has no shifts:** Card shows 0 for staff, shifts, and hours. Expanded section is empty.
- **Data loading:** 3 skeleton card placeholders with pulse animation.

**Postcondition:** Admin has reviewed individual department shift details. Departments with open shifts are clearly flagged.

---

## Journey 3: Admin Sets KPI Targets (Dialog, Save to DB, Persistent Across Sessions)

**Precondition:** Admin is on the Strategic view. Workspace has the `workspace_kpi_target` table available. `useKpiTargets()` hook is active.

### Happy Path

1. Admin navigates to Strategic view --> System renders 6 KPI cards in a responsive grid: Cost of Sales %, 90-Day Turnover, Absence Rate, Time to Job-Ready, Task Completion, Training Readiness. Each card shows current value, target threshold, and a "OK"/"Action" status badge.
2. System calls `useKpiTargets()` --> TanStack Query fetches existing targets from `workspace_kpi_target` table. If no rows exist, defaults are used: cost_of_sales=30, turnover_90d=15, absence_rate=4, time_to_job_ready=7, task_completion=90, training_readiness=100.
3. Admin hovers over a KPI card --> Card front fades out via AnimatePresence and flips to show "How is this calculated?" explanation text in emerald color. Moving the mouse away flips back.
4. Admin clicks a KPI card --> System opens a Popover anchored to the card with an "Edit Target" form showing the current value, a numeric input, and a "Save" button. Label shows the unit (%, days).
5. Admin changes the value (e.g., Turnover Target from 15 to 12) and presses Enter or clicks Save --> System calls `updateTarget.mutate({ metric: "turnover_90d", value: 12 })` --> Mutation upserts to `workspace_kpi_target` with `onConflict: "workspace_id,metric"` --> On success, query cache invalidates and KPI card refreshes with new target.
6. KPI cards re-evaluate status badges: cards where the current value exceeds the stricter target now show "Action" (red) instead of "OK" (green).
7. Admin clicks "Configure Goals" button (Settings icon) on the Turnover Trend chart --> System opens a Dialog with all 6 KPI target inputs in a 2-column grid. Each input shows label, benchmark hint (e.g., "Benchmark: < 30%"), and current value.
8. Admin adjusts values in the dialog, tabbing between fields --> Each input saves on blur via `onSave(local)` if the value changed --> System upserts each metric individually.
9. Admin closes the dialog --> All KPI cards and the turnover chart target line reflect the new thresholds.
10. Admin returns next session --> `useKpiTargets()` fetches persisted values from DB --> Targets are exactly as configured.

### Error Paths

- **No workspace context:** `useKpiTargets` query is disabled (`enabled: !!wsId`). Cards show default targets.
- **DB error on upsert:** Mutation throws, TanStack Query can retry. Card retains the old value until successful save.
- **Invalid values:** No client-side validation on numeric inputs. Admin can set unreasonable targets (e.g., 0% or 999%). All KPIs will show OK/Action based on comparison. Targets always persist regardless of value.
- **Hover on mobile:** Touch devices cannot hover the explanation flip. Card stays on front face.
- **Popover off-screen:** Popover is positioned `side="bottom" align="start"`, may clip on small viewports.

**Postcondition:** Admin has configured workspace-wide KPI targets that persist in the database. All strategic KPI cards and charts use the new thresholds. Targets survive page reload and session changes.

---

## Journey 4: Admin Configures Workspace Settings (Opening Hours, Configuration)

**Precondition:** Admin is logged in with role `admin` or `owner`. Workspace has the `workspace_settings` table available. Admin navigates to `/dashboard/settings`.

### Happy Path

1. Admin clicks "Settings" in the sidebar navigation --> System renders the Settings page with a heading "Settings" and subtitle "Configure your workspace settings and preferences."
2. System renders SettingsTabs component with a left sidebar navigation listing 6 tabs: General, Opening Hours, KPI Targets, Notifications, Teams & Departments, Security. Default active tab is "Opening Hours".
3. Admin sees the OpeningHoursSettings component --> System calls `useOperatingHours()` which fetches the 7-day schedule from the `workspace_settings` table --> Shows loading spinner while fetching.
4. System renders a card for each day of the week (Monday through Sunday). Each card shows: day name (e.g., "Monday"), an Open/Closed toggle switch, and time inputs for open and close times when the day is open.
5. Admin toggles Sunday from Open to Closed --> Switch changes, `is_closed` updates to true, time inputs disappear and "Closed" label appears. "You have unsaved changes" hint appears below the save button.
6. Admin changes Friday's closing time from 22:00 to 23:00 via the time input --> Local state updates, `hasChanges` becomes true.
7. Admin clicks "Save Changes" button --> System calls `upsertHours.mutate(localHours)` --> Button shows spinner with "Saving..." text while mutation is pending --> On success, query cache invalidates and local state syncs with server.
8. Admin clicks on other tabs (General, KPI Targets, Notifications, Teams & Departments, Security) --> Each shows a placeholder with the tab icon, tab name, and "Coming soon" text.

### Error Paths

- **Loading state:** Spinner shown while `useOperatingHours` fetches data.
- **No changes made:** Save button is disabled when `hasChanges` is false or mutation is pending.
- **Mutation error:** If the upsert fails, the mutation enters error state. Local hours remain changed but unsaved. Admin can retry.
- **No workspace context:** The operating hours hook will not fetch without a workspace ID. Settings page may show empty state.

**Postcondition:** Admin has configured the workspace's opening hours which persist in the database. Opening hours feed into scheduling and staffing calculations across the platform.

---

## Journey 5: Admin Sets Budget Targets (Monthly --> Weekly --> Daily --> Hourly Breakdown)

**Precondition:** Admin is on the Strategic view. Budget toggle is available. Workspace has the `workspace_budget` table. `useBudget()` hook is active.

### Happy Path

1. Admin is on the Strategic view and clicks the "Budget" toggle button (SlidersHorizontal icon) --> System shows `BudgetSettingsPanel` component, replacing the KPI grid. A "Back to KPIs" button appears at the top.
2. System shows a month selector with left/right chevrons and the current month name (e.g., "mars 2026"). Four granularity tabs: Monthly, Weekly, Daily, Hourly.
3. **Monthly tab (default):** System calls `useBudget({ periodType: "monthly", startDate, endDate })` --> Renders a form with 7 budget fields: Expected Revenue (NOK), Labor Cost Budget (NOK), Food Cost Budget (NOK), Cost of Sales Target (%), Turnover Target (%), Absence Threshold (%), Time to Job-Ready (days). Each input has a DollarSign icon where applicable.
4. Admin fills in Revenue = 850000, Labor Cost = 255000 --> Clicks "Save Monthly Budget" --> System calls `upsertBudget.mutate(entry)` with `onConflict: "workspace_id,period_type,period_date,hour_slot"` --> Button shows "Saving..." while pending --> On success, query invalidates.
5. **Weekly tab:** Admin clicks "Weekly" --> System renders a grid with one row per ISO week in the current month (e.g., "Uke 10", "Uke 11"...). Each row has 3 inline inputs: Revenue (NOK), Labor Cost (NOK), Food Cost (NOK). Values save on blur.
6. Admin enters weekly revenue targets per week, tabbing between fields --> Each blur triggers an upsert mutation for that week's budget entry.
7. **Daily tab:** Admin clicks "Daily" --> System renders a full calendar grid for the current month (Mon-Sun columns). Each day cell is clickable, showing the date number and any existing revenue target in green text.
8. Admin clicks multiple days to select them (ring-2 highlight with primary color) --> A bulk edit panel appears below: "Edit X selected days" with Revenue and Labor Cost inputs and an "Apply" button.
9. Admin enters Revenue = 30000 for the selected days and clicks "Apply" --> System calls `onSave()` for each selected day individually --> All selected cells update.
10. **Hourly tab:** Admin clicks "Hourly" --> If no days are selected in Daily tab, shows a placeholder: "Select days in the Daily view first. Switch to the Daily tab, select one or more days, then return here."
11. Admin switches to Daily tab, selects days, then returns to Hourly --> System shows a grid of 18 hour slots (06:00 to 23:00) with Revenue and Labor Cost inputs per hour. Values save on blur.
12. If multiple days are selected, a footer note says "Saving will apply to all X selected days." Saving one hour's values upserts for all selected days.
13. Admin navigates to a different month using chevrons --> Calendar, weeks, and monthly data update. Selected days are cleared.
14. Admin clicks "Back to KPIs" arrow --> BudgetSettingsPanel closes, KPI grid returns.

### Error Paths

- **No workspace context:** All `useBudget` queries disabled. No data loads.
- **DB error on upsert:** Mutation throws. Data remains at previous values. No toast notification on budget errors.
- **Empty inputs:** Saving with empty fields stores `null` values in the database. Existing values can be cleared by saving empty.
- **Hourly without daily selection:** Clear message directing admin to select days first.
- **Month navigation:** Changing month clears selected days to prevent cross-month confusion.

**Postcondition:** Admin has set budget targets at monthly, weekly, daily, and hourly granularity. All values are persisted in `workspace_budget` with composite unique constraint. Budget data feeds into future cost-of-sales and staffing calculations.

---

## Journey 6: Admin Uses Reconciliation View (Table Mode, Approve/Reject Entries)

**Precondition:** Admin is logged in with role `manager` or higher. DashboardShell has `adminView = "reconciliation"`. Workspace has departments with scheduled shifts.

### Happy Path

1. Admin navigates to the Reconciliation view --> System renders "Daily Reconciliation" header with subtitle "Review shifts and hours by department for sign-off." A view toggle (Table | Swipe | Cards) and date navigation are shown.
2. System defaults to Table view mode. Calls `useDepartmentShifts(selectedDate)` for today's date.
3. **Table view:** System renders a full-width table with columns: Employee (avatar + name), Department (color dot + name), Role, Shift (clock icon + time range), Hours (right-aligned, bold), Action (approve/flag buttons).
4. Each row shows a shift with an avatar circle colored by department color, initials derived from employee name, formatted time range (e.g., "07:00 - 15:00"), and hours (e.g., "8.0h").
5. Summary footer shows: "X shifts across Y departments" on the left, "Z.0h total" on the right.
6. Admin clicks the green check button on a shift --> System calls `toast.success("Shift XXXXXXXX approved")` with the first 8 characters of the shift ID.
7. Admin clicks the red X button on a shift --> System calls `toast.error("Shift XXXXXXXX flagged")`.
8. **Swipe view:** Admin clicks "Swipe" toggle --> System renders SwipeReconciliation component. Shifts are flattened into ShiftForReview objects. A card stack shows the current shift with employee name, department, role, time range, and work hours.
9. Admin swipes the card right (or clicks the green circle button) --> "APPROVE" overlay fades in during drag, card exits right with animation --> Progress bar advances ("1 / N reviewed") --> Next card appears from the stack.
10. Admin swipes the card left (or clicks the red circle button) --> "FLAG" overlay fades in, card exits left --> Shift is flagged via `onReject`.
11. After reviewing all shifts --> Completion screen shows: green checkmark animation, "All shifts reviewed", "X approved, Y flagged", and a "Review again" button that resets the index.
12. **Cards view:** Admin clicks "Cards" toggle --> Original department card grid renders (same as the previous ReconciliationView design). See Journey 2 for card interaction.
13. Admin navigates dates with left/right chevrons --> `dateOffset` changes, data re-fetches for the new date. "Today" button appears when offset is non-zero.

### Error Paths

- **No shifts for selected date:** Empty state with Building2 icon and "No shifts scheduled for [date]" message. Appears in all three view modes.
- **Data loading:** 3 skeleton card placeholders shown while `isLoading` is true.
- **Swipe with no shifts:** SwipeReconciliation shows empty state: "No shifts to review".
- **Unassigned shifts in table:** Employee column shows "Unassigned" text. Department card shows "X open" badge.
- **Far past/future dates:** No date range limits. Empty dates show the empty state.

**Postcondition:** Admin has reviewed all shifts for the selected date across all departments. Approved and flagged shifts are toasted but not yet persisted to a reconciliation table (current implementation is UI-only with toast notifications).

---

## Journey 7: Admin Explores Activity Heatmap (Date Range, Hover Details, Cell Click)

**Precondition:** Admin is logged in with role `admin` or higher. DashboardShell has `adminView = "activity"`. Workspace has workforce and training data.

### Happy Path

1. Admin navigates to Activity view --> System renders "Activity & Heatmap Dashboard" with Activity icon, title, and subtitle. Header also shows a Filter button and a time range selector with 5 options: Today, 7d, 14d, 30d, 90d. Default is 30d.
2. Admin sees 4 stat cards (visible when no heatmap cell is selected): Active Staff (from live query), Training Readiness (from live query), Highest Intensity ("Fridays" -- mock), Lowest Intensity ("Sunday AM" -- mock). Each card shows trend badge (green arrow up or red arrow down).
3. Admin sees Training Progress bar (visible when `training.totalAssignments > 0`) --> Segmented progress bar: completed (emerald), pending (amber), remaining (gray). Legend shows counts for each segment.
4. Admin sees category tabs: Locations (MapPin), Departments (Building2), Teams (Network), Users. Default is "Locations".
5. **Heatmap rendering:** System generates mock data via `generateHeatmapData()` based on the active tab's labels and the selected time range's day count. Each row represents a location/department/team/user. Each cell represents a day.
6. Cells are color-coded using indigo intensity scale: 0 = muted (quiet), <20 = indigo/10, <40 = indigo/30, <60 = indigo/50, <80 = indigo/80, >=80 = solid indigo-500 with glow shadow.
7. Admin hovers over a cell --> Cell scales up (1.3x) with transition. Tooltip shows "Location - Day N: Score X" via the `title` attribute.
8. Admin changes time range to "7d" --> System recalculates data with 7 columns instead of 30. Day column headers update. Data regenerates with `useMemo`.
9. Admin clicks "Departments" tab --> AnimatePresence transitions rows out/in. Heatmap now shows 6 department rows (Kjokken, Servering, Oppvask, Renhold, Lager, Sikkerhet) with fresh random data.
10. Admin clicks "Teams" tab --> 5 team rows appear (Morgenfuglene, Kveldsgjengen, Helgeteamet, etc.).
11. Admin clicks "Users" tab --> 10 individual employee rows (Anna Olsen, Ola Nordmann, etc.).
12. **Cell click expansion:** Admin clicks a heatmap cell --> `selectedCell` state updates with `{ row, dayIndex }` --> Stat cards and training progress bar hide. Tabs and time range selector move into a compact toolbar at the top of the heatmap card. Heatmap expands to fill available space (`flex-1`). The clicked cell gets a ring-2 highlight.
13. Activity detail panel appears at the bottom (max 40% height, scrollable). For multi-day ranges, shows 5 mock activity entries with time, event description ("Shift start", "Training session", etc.), and color-coded score badge (emerald >= 80, amber >= 50, red < 50). For "Today" range, shows an hourly breakdown (06:00-23:00) with bar chart per hour.
14. Admin clicks the X button in the toolbar or the detail panel --> `selectedCell` resets to null --> View returns to normal with stat cards and tabs visible.
15. Admin changes tabs or time range while expanded --> Data updates in place, detail panel refreshes.

### Error Paths

- **Pipeline query returns no data:** Active Staff stat card shows "--" and trend text is empty.
- **Training query returns no data:** Training Readiness stat card shows "--". Training Progress bar hidden entirely.
- **All heatmap data is mock:** Current implementation uses `generateHeatmapData()` with random values. Labels are static strings, not from database. Data regenerates on tab/range change (random values change).
- **Filter button non-functional:** Clicking "Filter" does nothing. UI placeholder for future implementation.
- **Narrow viewport:** Heatmap container has `overflow-x-auto`. Cells remain functional with horizontal scroll.

**Postcondition:** Admin has explored activity patterns across locations, departments, teams, and individuals over a configurable time range. Cell click reveals detailed activity breakdown. The heatmap layout is optimized to fill viewport when expanded.

---

## Journey 8: Admin Clicks Day --> Opens DayControlSheet (Schedule Drawer)

**Precondition:** Admin is on the Tactical view with a staffing coverage chart showing. Workspace has scheduled shifts.

### Happy Path

1. Admin views the staffing coverage chart in Tactical view --> Each day row is rendered as a `<button>` with an `onClick` handler calling `onDateClick(d.date)`.
2. Admin clicks a day bar (e.g., "Wed" showing 85% fill) --> TacticalView calls `onDateClick?.(d.date)` --> Parent DashboardShell receives the date and opens the DayControlSheet for that date.
3. DayControlSheet opens as a bottom sheet / drawer from the bottom of the viewport --> Shows the selected date's detailed schedule information: KPI summary cards, shift timeline, employee list.
4. Admin reviews the day's schedule: staffing count, estimated cost, budget comparison, opening hours, and a Gantt-style timeline of shifts by employee.
5. Admin can see which shifts are filled and which are open for that specific day.
6. Admin closes the drawer by clicking outside or pressing the close button --> Sheet dismisses, admin returns to the Tactical view.

### Error Paths

- **No shifts for that day:** DayControlSheet opens but shows empty timeline and "No shifts" messaging.
- **onDateClick not provided:** If `onDateClick` prop is undefined, button clicks do nothing (optional chaining `onDateClick?.()`).
- **Date out of range:** Any date from the coverage chart can be opened. System fetches data for the specific date regardless of range.

**Postcondition:** Admin has drilled into a specific day's schedule from the tactical overview, reviewed staffing details, and can take actions on individual shifts.

---

## View Routing Summary

| Role                  | Mode                       | View               | Component            |
| --------------------- | -------------------------- | ------------------ | -------------------- |
| owner, admin, manager | `adminView=tactical`       | Tactical (default) | `TacticalView`       |
| owner, admin, manager | `adminView=strategic`      | Strategic + Budget | `StrategicView`      |
| owner, admin, manager | `adminView=reconciliation` | Reconciliation     | `ReconciliationView` |
| owner, admin, manager | `adminView=activity`       | Activity & Heatmap | `ActivityView`       |
| admin, owner          | Settings page              | Workspace Settings | `SettingsTabs`       |

## Database Tables Added

| Table                  | Purpose                                                   | Unique Constraint                                     |
| ---------------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| `workspace_budget`     | Budget targets at monthly/weekly/daily/hourly granularity | `(workspace_id, period_type, period_date, hour_slot)` |
| `workspace_settings`   | Workspace configuration (opening hours, preferences)      | Per workspace                                         |
| `workspace_kpi_target` | Persistent KPI target thresholds per metric               | `(workspace_id, metric)`                              |
| `kpi_actual`           | Actual KPI values for comparison (future use)             | Per workspace + metric + period                       |

## Key Hooks

| Hook                     | Table                      | Purpose                                                   |
| ------------------------ | -------------------------- | --------------------------------------------------------- |
| `useKpiTargets()`        | `workspace_kpi_target`     | Fetch/update KPI thresholds with upsert                   |
| `useBudget()`            | `workspace_budget`         | Fetch/upsert budget entries by period type and date range |
| `useOperatingHours()`    | `workspace_settings`       | Fetch/update 7-day opening hour schedule                  |
| `useStaffingCoverage()`  | `schedule_shift`           | Compute daily fill percentages for a week                 |
| `useDepartmentShifts()`  | `schedule_shift`           | Group shifts by department for a given date               |
| `useTrainingReadiness()` | `protocol_assignment`      | Compute protocol completion stats                         |
| `useWorkforcePipeline()` | `user_identity`, `profile` | Active staff, hires, departures, onboarding counts        |
