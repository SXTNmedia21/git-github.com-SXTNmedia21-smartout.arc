---
title: "User Journeys — Operations UI Redesign"
status: done
updated: 2026-03-03
created: 2026-03-03
module: operations
tags: [operations, department-session, ui, journeys]
---

# User Journeys -- Operations UI Redesign

This document covers all user journeys for the Operations page dual-view system: Analytical (KPI dashboard) and Action (department session management). All data is currently mock, typed for future migration to real database tables.

---

## Journey: Admin Views Analytical Dashboard

**Precondition:** Admin is logged in with role `manager`, `admin`, or `owner`. They navigate to `/dashboard/operations`. The ActionBar view toggle is set to "Analytisk" (default).

### Happy Path

1. Admin navigates to `/dashboard/operations` --> System renders the Operations page with the ActionBar at the top showing two toggle options: "Analytisk" and "Aksjon" --> "Analytisk" is selected by default, and the AnalyticalView component renders.
2. System displays KPI signal cards at the top of the view --> Three primary signals are shown: Staff Scheduled (number of employees on shift today), Open Shifts (unfilled shifts requiring attention), and Session Coverage (percentage of departments with active sessions) --> Each card is color-coded: green (good), orange (warning), red (critical).
3. Admin reviews the Staff Scheduled signal --> System shows the count of employees scheduled for today with a status indicator --> Green if coverage is >= 90%, orange if >= 70%, red if < 70%.
4. Admin reviews the Open Shifts signal --> System shows the number of shifts without assigned employees --> Zero open shifts shows green "All filled" state; any open shifts show orange/red with count.
5. Admin reviews Session Coverage signal --> System shows percentage of departments that have an active or completed session for today --> 100% is green, partial coverage is orange, low coverage is red.
6. Admin scrolls down to the mock chart area --> System renders placeholder charts showing operational trends (e.g., session completion rates over time, staffing patterns) --> Charts use mock data with realistic values and proper axes/labels.
7. Admin gets a high-level overview of today's operational health without needing to drill into individual departments.

### Error Paths

- **No data available:** Signal cards display "--" with neutral styling. Charts show empty state with "No data for this period" message.
- **Data loading:** Signal cards show skeleton placeholders with pulse animation. Chart areas show loading spinners.
- **All mock data:** Current implementation uses typed mock data throughout. No database queries are made. When real tables are created, the typed interfaces ensure a smooth migration.
- **Narrow viewport:** Signal cards stack vertically on mobile. Charts resize responsively with horizontal scroll if needed.

**Postcondition:** Admin has a quick, at-a-glance understanding of today's operational status -- staffing levels, open gaps, and session coverage -- without needing to inspect each department individually.

---

## Journey: Admin Switches to Action View

**Precondition:** Admin is on `/dashboard/operations` with the Analytical view active. They want to manage specific department sessions and tasks.

### Happy Path

1. Admin clicks "Aksjon" in the ActionBar view toggle --> System switches the active view from AnalyticalView to ActionView with a smooth transition --> The layout changes to a two-panel design: department sidebar on the left, session timeline on the right.
2. System renders the department sidebar listing all departments in the workspace --> Each department entry shows: department name, current session status badge (upcoming/active/pending_signoff/closed/missed), and a brief status summary.
3. Admin clicks on a department in the sidebar (e.g., "Kjokken") --> System highlights the selected department and loads its session timeline in the main panel --> The timeline displays the full session lifecycle with hook points.
4. System renders the session timeline with 5 hook stages arranged chronologically: pre_open, open, scheduled, pre_close, close --> Each hook shows its scheduled time and any associated tasks or procedures as cards beneath it.
5. Admin sees task cards under each hook point --> Each card shows: task name, assigned role/person, status (pending/in_progress/completed), and priority indicator --> Cards are interactive and can be expanded for details.
6. Admin toggles between "View" and "Edit" mode using the mode toggle in the ActionView header --> In View mode, task cards are read-only with status indicators. In Edit mode, task cards become interactive with action buttons (complete, reassign, skip).
7. Admin can click "Aksjon" toggle back to "Analytisk" at any time --> System smoothly transitions back to the AnalyticalView, preserving the previously viewed state.

### Error Paths

- **No departments in workspace:** Sidebar shows empty state with message "No departments configured. Add departments in Settings."
- **Department has no session today:** Timeline area shows "No session scheduled for today" with option to create one (future functionality).
- **Session data loading:** Timeline shows skeleton placeholders for hook points and task cards.
- **Sidebar overflow:** If many departments exist, the sidebar scrolls vertically independently of the main timeline panel.
- **Mode toggle unavailable:** Edit mode may be restricted to `admin`/`owner` roles. Managers see View mode only (role-based, future implementation).

**Postcondition:** Admin is now in the Action view with a specific department selected, viewing the session timeline with all hook-based tasks and their current status. They can toggle between view and edit modes.

---

## Journey: Admin Manages Department Session

**Precondition:** Admin is in the Action view with a department selected. The department has a session in `upcoming` status. Admin has `admin` or `owner` role.

### Happy Path

1. Admin sees the department session in "upcoming" status --> The timeline header shows session date, department name, and a prominent status badge reading "Upcoming" in a neutral color.
2. Session transitions to "active" (triggered by pre_open hook time or manual activation) --> System updates the status badge to "Active" in green --> The pre_open hook section highlights, showing tasks that should be completed before doors open (e.g., safety checks, station setup).
3. Admin reviews pre_open tasks --> Task cards show procedures and routines assigned to this hook --> Admin marks tasks as completed by clicking the checkmark on each card in Edit mode --> Completed tasks show green checkmark and strikethrough styling.
4. Session progresses to "open" hook --> System highlights the open hook section --> New tasks appear: opening procedures, register counts, initial staff check-in --> Admin works through these tasks sequentially.
5. During the session, "scheduled" hook tasks appear at their configured times --> These are mid-session procedures (temperature checks, stock counts, quality rounds) --> Admin or assigned staff complete them as they come due.
6. As closing time approaches, the "pre_close" hook activates --> System highlights pre-close tasks: last order announcements, cleaning prep, cash reconciliation --> Admin ensures all pre-close procedures are underway.
7. Admin initiates session close at the "close" hook --> System shows final tasks: closing checklists, lockup procedures, daily summary --> Once all close tasks are marked complete, admin clicks "Sign Off Session."
8. System prompts for signoff confirmation --> Admin confirms --> Session status changes to "pending_signoff" --> A summary card appears showing: total tasks completed, any skipped tasks, session duration, and staff who participated.
9. Session owner or designated manager reviews and approves the signoff --> Session status moves to "closed" --> The session is locked and no further edits are possible.

### Error Paths

- **Tasks incomplete at hook transition:** System shows warning "X tasks still pending from [hook_name]" but does not block progression. Incomplete tasks carry forward with a "missed" indicator.
- **Session not opened on time:** If the pre_open hook time passes without activation, session status changes to "missed" with red badge. Admin can still manually activate it (future: with a reason note).
- **Signoff rejected:** If the reviewer finds issues, they can reject the signoff --> Session returns to "active" status with a note explaining what needs correction.
- **Network interruption during signoff:** System retains local state. On reconnect, the signoff attempt can be retried without data loss.
- **All data is mock:** Current implementation simulates the lifecycle with typed mock data. Real session management requires `department_session` table and related hook/task tables.
- **Concurrent edits:** If two admins manage the same session simultaneously, last-write-wins (no real-time collaboration yet). Future: Supabase Realtime for live sync.

**Postcondition:** The department session has progressed through its full lifecycle (upcoming --> active --> pending_signoff --> closed). All hook-based tasks are accounted for, and a signoff record exists for audit purposes.

---

## Journey: Admin Broadcasts Reminder to Staff

**Precondition:** Admin is in the Action view with a department selected and an active session. Staff members are assigned to shifts in this department for today.

### Happy Path

1. Admin identifies that staff need a reminder (e.g., pre-shift briefing, uniform check, early arrival request) --> Admin locates the "Broadcast" or "Send Reminder" button in the session timeline header or staff section.
2. Admin clicks the broadcast button --> System opens a dialog/modal with: recipient list (all staff on today's shifts for this department), message text field, and optional "Include session info" checkbox.
3. Admin writes a message (e.g., "Husk briefing kl 09:45 i dag. Minstekrav: svart bukse, hvit skjorte.") --> System shows character count and preview of the message.
4. Admin optionally checks "Include session info" --> System will append today's session summary (department, shift times, hook schedule) to the message.
5. Admin clicks "Send" --> System dispatches the reminder to all listed staff members --> A success toast appears: "Reminder sent to X employees."
6. The broadcast is logged in the session timeline as an event card showing: timestamp, sender name, message preview, and recipient count.

### Error Paths

- **No staff on shift:** Broadcast button is disabled with tooltip "No staff scheduled for this session." Recipient list is empty.
- **Empty message:** Send button is disabled until message field has content. Validation message: "Write a message before sending."
- **Send failure:** Toast error "Could not send reminder. Try again." The message is preserved in the dialog so the admin can retry without retyping.
- **Partial delivery failure:** System shows "Sent to X of Y employees. Z failed." with option to retry failed recipients.
- **All mock:** Current implementation shows the UI flow but does not actually send notifications. Real implementation requires integration with the notifications package (SendGrid/Twilio).

**Postcondition:** All staff assigned to the department's session today have received a reminder notification. The broadcast is logged as part of the session's event history.

---

## Journey: Admin Views Staff Attendance in Session

**Precondition:** Admin is in the Action view with a department selected and an active session. Staff are scheduled for shifts in this department.

### Happy Path

1. Admin scrolls to the "Staff" or "Attendance" section within the session timeline --> System renders a staff list showing all employees assigned to shifts in this department for today.
2. Each staff entry displays: employee name, role/position, scheduled shift time (e.g., "10:00 - 18:00"), and attendance status indicator (not arrived / arrived / late / absent).
3. Admin sees color-coded status for each employee --> Green dot: arrived on time. Orange dot: arrived late. Red dot: absent/no-show. Gray dot: shift not yet started.
4. Admin clicks on a staff member's row --> System expands the row to show additional details: contact information (phone, email), arrival time (if checked in), assigned tasks for this session, and notes field.
5. Admin can manually update attendance status (e.g., mark someone as "arrived" if automatic check-in is not yet implemented) --> Status indicator updates in real time.
6. Admin reviews the attendance summary at the top of the staff section --> System shows: "X of Y staff present" with a fill bar. If attendance is below expected, a warning indicator appears.
7. Admin can click a contact action (phone icon or SMS icon) to reach a missing employee directly from the attendance list.

### Error Paths

- **No staff scheduled:** Staff section shows empty state: "No staff scheduled for this department today."
- **All staff absent:** Attendance summary shows red warning: "0 of X staff present" with prominent alert styling. Admin is prompted to take action (contact staff, adjust session plan).
- **Check-in system unavailable:** If automatic check-in is not functional, all statuses default to gray "not arrived." Admin must manually update attendance.
- **Contact action fails:** If phone/SMS integration is not connected, clicking contact buttons shows toast: "Contact integration not configured."
- **All mock:** Current implementation shows typed mock staff data. Real attendance tracking requires integration with shift data from `schedule_shift` and a check-in mechanism.

**Postcondition:** Admin has a clear picture of who is present, who is late, and who is missing for the current department session. They can take action on absences and have a record of attendance for the session.

---

## Journey: Employee Views Operations (Limited View)

**Precondition:** Employee is logged in with role `employee`. They navigate to `/dashboard/operations`. The system detects their role and renders a limited, read-only view.

### Happy Path

1. Employee navigates to `/dashboard/operations` --> System detects `employee` role and renders a simplified Operations view --> No ActionBar view toggle is shown (employees do not get the Analytical/Action switcher).
2. Employee sees their department's current session status --> System identifies the employee's department from their profile and displays: department name, today's session status (upcoming/active/closed), and the session timeline relevant to their role.
3. Employee views their assigned tasks for the current session --> System filters the session's task cards to show only tasks assigned to the employee or their role --> Tasks are displayed in chronological order by hook stage.
4. Employee can mark their own tasks as completed --> Each task card has a "Complete" button that the employee can tap --> System updates the task status to "completed" with timestamp and employee attribution.
5. Employee views the session timeline in read-only mode --> Hook stages and other employees' tasks are visible but not interactive --> Employee can see overall session progress without being able to modify it.
6. Employee checks the staff section --> System shows a simplified staff list for their department with names and shift times, but no contact details or attendance management controls.

### Error Paths

- **Employee not assigned to any department:** Operations page shows: "You are not assigned to a department. Contact your manager."
- **No session today for employee's department:** Page shows: "No session scheduled for your department today."
- **No tasks assigned to employee:** Task section shows: "No tasks assigned to you for this session. Check with your manager."
- **Employee tries to access Action or Analytical view directly:** URL manipulation or deep links to admin views are blocked by role check --> System redirects to the employee's limited view.
- **Employee tries to edit other employees' tasks:** Edit controls are not rendered for non-own tasks. Even if manipulated client-side, backend validation (future) will reject unauthorized changes.
- **All mock:** Current implementation shows the limited view structure with mock data. Real implementation requires role-based filtering of session and task data.

**Postcondition:** Employee has visibility into their department's daily operations and their own task assignments. They can complete their tasks but cannot modify the session structure, other employees' tasks, or access administrative views.

---

## View Routing Summary

| Role                  | View Toggle      | Default View | Components Available                                 |
| --------------------- | ---------------- | ------------ | ---------------------------------------------------- |
| owner, admin, manager | Analytisk/Aksjon | Analytisk    | AnalyticalView, ActionView (dept sidebar + timeline) |
| employee              | Not shown        | Limited view | Read-only session timeline, own tasks only           |

## Department Session Lifecycle

```
upcoming --> active --> pending_signoff --> closed
                                       \
                                        --> missed (if not opened on time)
```

| Status          | Meaning                                             | Who triggers           |
| --------------- | --------------------------------------------------- | ---------------------- |
| upcoming        | Session created for today, not yet started          | System (auto-created)  |
| active          | Session is running, hooks firing, tasks in progress | Admin (manual) or hook |
| pending_signoff | All tasks done, awaiting manager review             | Admin (signs off)      |
| closed          | Signoff approved, session locked                    | Manager/Owner          |
| missed          | Session was never opened past its scheduled time    | System (timeout)       |

## Mock Data Note

All data in this feature is typed mock data. No database tables have been created yet for department sessions, session hooks, or session tasks. The TypeScript interfaces are designed to match the planned schema, ensuring a smooth migration when real tables are introduced. Key types to implement:

- `DepartmentSession` -- session record with status, department_id, date
- `SessionHook` -- hook instances (pre_open, open, scheduled, pre_close, close) linked to a session
- `SessionTask` -- individual task/procedure cards linked to hooks
- `SessionAttendance` -- staff check-in records linked to a session
