---
title: "User Journeys — Dashboard Polish"
status: done
updated: 2026-03-03
created: 2026-03-03
module: dashboard
tags: [dashboard, heatmap, day-control, strategic, polish, journeys]
---

# User Journeys -- Dashboard Polish

This document covers all user journeys for the dashboard polish feature: day-click interactions, event creation, heatmap overhaul, DayControlSheet budget/staffing tabs, and StrategicView layout fixes.

---

## Journey: Admin Clicks Day in Tactical View -- DayControlSheet Opens

**Precondition:** Admin is logged in with role `manager` or higher. DashboardShell is in admin mode with `adminView = "tactical"`. The TacticalView coverage chart is visible with at least one week of shift data loaded.

### Happy Path

1. Admin views the 7-day staffing coverage chart in TacticalView --> System renders horizontal coverage bars, one per day, with fill percentages and color coding.
2. Admin clicks on a specific day's coverage bar (e.g., Wednesday) --> System captures the clicked date and opens the DayControlSheet drawer as a slide-over panel instead of navigating to the schedule page.
3. DayControlSheet renders with the selected date as context --> System displays the DayControlSheet with 6 perspective tabs: Oversikt, Meldinger, Bookings, Oppgaver, Budsjett, Bemanning. The Oversikt (Overview) tab is active by default.
4. Admin reviews day details in the drawer --> System shows relevant shift data, staffing summary, and operational information for the selected date without leaving the dashboard context.
5. Admin closes the DayControlSheet by clicking outside it or pressing the close button --> System dismisses the drawer --> Admin is back on the TacticalView with all state preserved (week offset, scroll position).

### Error Paths

- **No shift data for clicked day:** DayControlSheet opens but shows an empty state for the selected date. Tabs are still navigable.
- **Coverage data still loading:** Coverage bars show skeleton placeholders. Clicking a skeleton bar has no effect (no click handler during loading state).
- **DayControlSheet fails to load:** If the sheet component errors, the dashboard remains functional. Error boundary catches the failure without crashing the parent TacticalView.

**Postcondition:** Admin has inspected a specific day's operational details directly from the dashboard without navigating away. The TacticalView remains fully intact when the drawer is closed.

---

## Journey: Admin Creates Event from Dashboard

**Precondition:** Admin is logged in with role `manager` or higher. DashboardShell is in admin mode with TacticalView active. The Upcoming Events widget is visible in the sidebar area.

### Happy Path

1. Admin views the Upcoming Events widget in TacticalView --> System renders the widget with any existing upcoming events listed.
2. Admin clicks the Plus (+) button in the Upcoming Events widget header --> System opens the DayInfoDialog modal.
3. DayInfoDialog renders with a form for creating a new event --> Admin fills in event details (title, date, time, description, or other relevant fields).
4. Admin submits the event creation form --> System validates input and creates the event --> DayInfoDialog closes.
5. The Upcoming Events widget updates to include the newly created event in the list.

### Error Paths

- **Validation failure:** If required fields are missing or invalid, the DayInfoDialog shows inline validation errors and does not submit.
- **Network failure on submit:** If the creation request fails, a toast notification (sonner) displays the error. The dialog remains open with form data preserved so the admin can retry.
- **No permission:** If the user lacks write permissions, the Plus button may be hidden or the submit returns a permission error.

**Postcondition:** Admin has created a new event directly from the dashboard without navigating to a separate events page. The Upcoming Events widget reflects the new entry.

---

## Journey: Admin Explores Heatmap -- Cell Click Opens Activity Detail Panel

**Precondition:** Admin is logged in with role `admin` or higher. DashboardShell has `adminView = "activity"`. The ActivityView heatmap is visible with data rendered across location/department/team/user rows.

### Happy Path

1. Admin views the Activity & Heatmap Dashboard --> System renders the heatmap with flex-based cell layout where cells fill all available horizontal space (no fixed widths, no horizontal scroll needed at standard viewport sizes).
2. Admin sees 4 quick stat cards displayed above the heatmap --> Stats are visible by default without any expand/collapse interaction needed.
3. Admin hovers over a heatmap cell --> Tooltip shows the row label, day identifier, and intensity score for that cell.
4. Admin clicks a heatmap cell (e.g., "Kjokken" row, Day 15) --> System expands an activity detail panel below the heatmap (or inline) showing hourly breakdown data for the selected cell.
5. The activity detail panel displays hourly intensity distribution across the day (e.g., 06:00-07:00: low, 11:00-13:00: peak, 17:00-19:00: high) --> Admin can see which hours drive the most activity for the selected row and day.
6. Admin clicks a different heatmap cell --> System updates the detail panel to show the new cell's hourly breakdown, replacing the previous selection.
7. Admin clicks the same cell again or a close control --> System collapses the activity detail panel.

### Error Paths

- **Heatmap data loading:** Cells show skeleton placeholders. Clicking a skeleton cell has no effect.
- **No hourly data for selected cell:** Detail panel opens but shows "No hourly data available" message.
- **Viewport too narrow for all cells:** Flex layout compresses cells. At very narrow widths, cell labels may truncate. The layout remains usable without horizontal scrolling at standard dashboard widths.
- **Tab switch while detail panel is open:** Switching between Locations/Departments/Teams/Users tabs closes any open detail panel and resets the selection.

**Postcondition:** Admin has drilled into a specific heatmap cell to understand the hourly activity distribution for a given row and day. The flex-based layout ensures all cells are visible without scrolling on standard viewports.

---

## Journey: Admin Uses Budget Tab in DayControlSheet

**Precondition:** Admin is logged in with role `manager` or higher. DayControlSheet is open (from clicking a day in TacticalView or other entry point). The Budsjett (Budget) tab is available among the 6 perspective tabs.

### Happy Path

1. Admin opens DayControlSheet for a specific date --> System renders with 6 tabs: Oversikt, Meldinger, Bookings, Oppgaver, Budsjett, Bemanning. Oversikt is active by default.
2. Admin clicks the "Budsjett" tab --> System switches to the budget perspective view.
3. System displays budget KPIs for the selected date: revenue target, labor cost (NOK and % of revenue), food cost (NOK and % of revenue), and any other configured cost categories.
4. Admin reviews actual vs. target comparisons --> System shows each metric with its target value, current/projected value, and a visual indicator (green if within target, orange if approaching threshold, red if over budget).
5. Admin can see at a glance whether the day is on track financially --> Revenue target, labor cost percentage, and food cost percentage give a complete picture of daily profitability.

### Error Paths

- **No budget targets configured:** Tab shows a message indicating that budget targets have not been set for this date or location. May suggest navigating to settings to configure targets.
- **Partial data:** If some cost categories have data but others do not, the available data is shown and missing categories display "--" or a placeholder.
- **Budget data loading:** Budget metrics show skeleton loaders while data is being fetched.

**Postcondition:** Admin has reviewed the financial health of a specific day, comparing actual/projected costs against targets for revenue, labor, and food cost without leaving the dashboard.

---

## Journey: Admin Uses Staffing Tab in DayControlSheet

**Precondition:** Admin is logged in with role `manager` or higher. DayControlSheet is open for a specific date. The Bemanning (Staffing) tab is available among the 6 perspective tabs.

### Happy Path

1. Admin opens DayControlSheet and clicks the "Bemanning" tab --> System switches to the staffing perspective view.
2. System displays total scheduled hours for the selected date --> Admin sees the aggregate hour count across all departments for the day.
3. System breaks down hours by department --> Each department is listed with its scheduled hours, number of shifts, and number of assigned vs. open positions. Departments are ordered by hour count or alphabetically.
4. Admin reviews the department split --> Visual breakdown (e.g., bar segments or a list with proportional indicators) shows how staffing is distributed. For example: Kjokken 32h (4 shifts), Servering 24h (3 shifts), Bar 16h (2 shifts).
5. Admin identifies departments that are under- or over-staffed --> Open shifts or understaffed departments are highlighted with warning indicators.

### Error Paths

- **No shifts scheduled for this date:** Staffing tab shows an empty state: "No shifts scheduled for [date]."
- **Department data incomplete:** If some departments have no shifts, they are omitted from the breakdown rather than showing zero rows.
- **Staffing data loading:** Department list shows skeleton placeholders while shift data is aggregated.
- **All shifts unassigned:** Total hours are still shown (based on shift definitions), but assigned count is 0 for affected departments with a prominent "unassigned" warning.

**Postcondition:** Admin has a clear picture of how scheduled work hours are distributed across departments for the selected day, including identification of staffing gaps at the department level.

---

## Journey: Admin Views Strategic View Without Overflow

**Precondition:** Admin is logged in with role `owner` or `admin`. DashboardShell has `adminView = "strategic"`. The StrategicView is rendered.

### Happy Path

1. Admin navigates to the Strategic view --> System renders StrategicView with location pill selector, KPI grid, trend chart, and workforce pipeline sidebar.
2. System uses flex-based layout instead of hard-coded min-height values --> Content fits within the available viewport without causing vertical overflow or unnecessary scrollbar on the dashboard shell.
3. KPI cards render in a responsive grid that adapts to content --> Cards do not push content below the fold unnecessarily. The layout is compact and readable.
4. Admin scrolls down if content exceeds viewport height naturally (e.g., on smaller screens) --> Scrolling is smooth and contained within the dashboard content area, not the outer shell.
5. Turnover Trend chart and Workforce Pipeline sidebar fit alongside the KPI grid without horizontal overflow --> Flex layout distributes space proportionally.

### Error Paths

- **Very small viewport (mobile):** Content reflows to single column. All sections remain accessible via vertical scroll. No horizontal overflow.
- **Many locations in pill selector:** If the workspace has many locations, the pill selector wraps to a new line rather than overflowing horizontally.
- **Long KPI explanation text:** Flipped card text is contained within the card bounds and does not push other elements.

**Postcondition:** Admin sees a clean, compact Strategic view with no layout overflow issues. All content is accessible without unexpected scrollbars or clipped elements. The removal of hard min-height values and adoption of flex layout ensures the view adapts properly to different viewport sizes.

---

## Summary of Changes

| Area                      | Before                                           | After                                                          |
| ------------------------- | ------------------------------------------------ | -------------------------------------------------------------- |
| Day click in TacticalView | Navigated to schedule page                       | Opens DayControlSheet drawer in-place                          |
| Event creation            | Not available from dashboard                     | Plus button in Upcoming Events opens DayInfoDialog             |
| Heatmap cells             | Fixed width, horizontal scroll                   | Flex-based, fill available space                               |
| Heatmap interaction       | Hover tooltip only                               | Click cell to open activity detail panel with hourly breakdown |
| Activity stats            | Required expand action                           | Visible by default                                             |
| DayControlSheet tabs      | 4 tabs (Oversikt, Meldinger, Bookings, Oppgaver) | 6 tabs (+Budsjett, +Bemanning)                                 |
| StrategicView layout      | Hard min-height, potential overflow              | Flex layout, no overflow                                       |
