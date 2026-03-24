---
title: "User Journeys — Staff Handling Complete"
status: done
updated: 2026-03-22
created: 2026-03-22
module: core
tags: [people, invitation, profile, mobile]
---

# User Journeys — Staff Handling Complete

## Journey: Admin views accurate staff metrics

**Precondition:** Admin is logged into a workspace with employees and protocol assignments.

1. Admin navigates to `/dashboard/people`
2. System fetches profiles, departments, invitations, readiness scores (via RPC), and contract status in parallel
3. Admin sees 4 metric cards:
   - Total Staff: count of profiles
   - Active Now: count of active profiles
   - Avg Readiness: computed from protocol_assignment (completed/total), only profiles WITH assignments
   - Pending Invites: count of non-expired pending invitations
4. Employees with no protocol assignments show "—" instead of 0%
5. Employees with signed contracts show contract indicator

**Postcondition:** All metrics reflect real data. No fake 0% or false contract status.

**Error paths:**
- If readiness RPC fails: readiness shows undefined/N/A, does not break page
- If contracts query fails: hasContract defaults to false

---

## Journey: Admin invites employee via SMS

**Precondition:** Admin is on the People page.

1. Admin clicks "Invite" button → Invite dialog opens
2. Admin selects "SMS" from the invite type selector (Email | SMS | Link)
3. Email field hides, phone field appears
4. Admin enters phone number, name, role, department
5. Admin clicks "Send invitasjon"
6. System calls `create-invitation` Edge Function with `invite_type: "sms"`
7. Edge Function creates invitation + dispatches SMS
8. Dialog closes, People table refreshes showing new pending invite

**Postcondition:** Invitation created with type "sms", SMS dispatched.

**Error paths:**
- Missing phone number: validation error shown inline
- Edge Function failure: toast error "Failed to send invitation"

---

## Journey: Admin creates shareable invite link

**Precondition:** Admin is on the People page.

1. Admin clicks "Invite" → selects "Lenke" invite type
2. Contact fields hide, info text appears: "En delbar invitasjonslenke vil bli generert"
3. Admin enters name, role → clicks "Opprett lenke"
4. System creates invitation with `invite_type: "link"`, no email/SMS dispatch
5. Dialog shows generated URL with copy button
6. Admin clicks copy → URL copied to clipboard, button shows "Kopiert"
7. Admin shares the link externally

**Postcondition:** Invitation exists with shareable token. No email/SMS sent.

---

## Journey: Admin reactivates an offboarded employee

**Precondition:** Employee has status "offboarding" in the People table.

1. Admin clicks the row action menu (⋯) for the offboarded employee
2. Menu shows "Reactivate" option
3. Admin clicks "Reactivate" → confirmation dialog: "This will restore full access for {name}. Continue?"
4. Admin confirms → system updates profile: `status = 'active'`, `is_active = true`
5. Toast: "{name} has been reactivated"
6. Table refreshes, employee now shows "Active" badge

**Postcondition:** Employee is active again with full access.

**Error paths:**
- Server error: toast "Failed to reactivate employee"

---

## Journey: Admin bulk deactivates employees

**Precondition:** Admin has selected multiple employees via checkboxes.

1. Bulk action bar appears with count: "{N} selected"
2. Admin clicks "Deactivate Selected" button (destructive style)
3. Confirmation dialog: "Are you sure you want to deactivate {N} employees?"
4. Admin confirms → system calls bulkUpdateProfiles with `{ status: 'offboarding', is_active: false }`
5. Toast: "Deactivated {N} employees"
6. Selection cleared, table refreshes

**Postcondition:** All selected employees moved to offboarding status.

---

## Journey: Admin exports filtered employee list

**Precondition:** Admin is on People page, optionally with filters applied.

1. Admin clicks Export button (download icon) in table header
2. System generates CSV from current `filteredEmployees`:
   - Columns: Name, Email, Phone, Role, Department, Status, Readiness %, Contract
   - Respects active search, department, status, and advanced filters
3. Browser downloads file: `employees-YYYY-MM-DD.csv`

**Postcondition:** CSV file downloaded with filtered data.

---

## Journey: Admin uses advanced filters

**Precondition:** Admin is on People page.

1. Admin clicks filter icon button → popover appears
2. Filter options:
   - Status: checkboxes for active, trainee, inactive, offboarding, invited
   - Role: checkboxes for owner, admin, manager, employee
   - Readiness: preset buttons (0-25%, 25-50%, 50-75%, 75-100%)
   - Contract: All / Has contract / No contract
3. Admin selects filters → table updates in real-time
4. Filter icon shows badge with active filter count
5. Admin clicks "Clear filters" → all filters reset

**Postcondition:** Table shows only matching employees.

---

## Journey: Admin manages employee teams

**Precondition:** Admin is on employee profile detail page, Settings tab.

1. Admin sees "Teams" section listing current team memberships
2. To remove: click X button next to team name → team_member row deleted
3. To add: select from "Add to team" dropdown (shows workspace teams not already assigned)
4. System calls addToTeam/removeFromTeam server actions
5. Team list refreshes

**Postcondition:** Employee's team memberships updated.

---

## Journey: Admin views employee schedule

**Precondition:** Admin is on employee profile detail page.

1. Admin clicks "Schedule" tab
2. System queries `schedule_shift` for ±7 days from today
3. Shifts displayed grouped by date: time range, department, status badge
4. If no shifts: empty state "No shifts scheduled" with calendar icon

**Postcondition:** Admin sees employee's upcoming and recent shifts. Read-only.

---

## Journey: Admin views employee activity history

**Precondition:** Admin is on employee profile detail page.

1. Admin clicks "Activity" tab
2. System queries `activity_trail` filtered by profile's actor_id
3. Shows chronological list (newest first): action, timestamp, category color
4. "Load more" button loads next 20 entries
5. Overview tab also shows 5 most recent entries

**Postcondition:** Admin sees full activity history.

**Error paths:**
- No activity: empty state "No activity recorded yet"

---

## Journey: Admin sends protocol reminder

**Precondition:** Admin is viewing employee profile with incomplete protocol assignments.

1. Admin clicks "Send Reminder" button next to an incomplete protocol
2. System logs reminder in `activity_trail`: event "Reminder sent for {protocol_name}"
3. Toast: "Reminder logged" (actual email dispatch is a TODO)

**Postcondition:** Reminder logged in activity trail. Email dispatch pending future Edge Function.

---

## Journey: Employee views team on mobile

**Precondition:** Employee is logged into the mobile app.

1. Employee navigates to Team screen
2. FlatList shows workspace members: name, role, department, status badge
3. Employee can search by name/role/department
4. Pull-to-refresh updates the list
5. Tap on a member → detail screen with contact info, readiness, teams

**Postcondition:** Employee can see colleagues' profiles. Read-only, no admin actions on mobile.

---

## Journey: Admin changes employee status with enforced transitions

**Precondition:** Admin is on employee profile detail, Settings tab.

1. Admin opens status dropdown
2. Only valid transitions are enabled:
   - trainee → active, offboarding
   - active → inactive, offboarding
   - inactive → active, offboarding
   - offboarding → active (reactivation)
3. Invalid options are disabled with "(not allowed)" label
4. Admin selects valid status → save calls `updateProfileStatus` with transition validation
5. Server validates transition before applying

**Postcondition:** Status changed only if transition is valid.

**Error paths:**
- Invalid transition attempted: server returns "Invalid status transition: X → Y"
