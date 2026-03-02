---
title: "User Journeys — Team Member Management"
status: done
updated: 2026-03-02
created: 2026-03-02
module: org-structure
tags: [journeys, people, organization]
---

# User Journeys — Team Member Management

This document describes all user journeys for the team member management feature, covering people management, team composition, department organization, and employee profile editing.

---

## Journey: Admin Manages Team Members

**Precondition:** Admin is logged in, at least one team exists, at least one profile exists in the workspace.

1. Admin navigates to Organization > Teams tab -> System loads all teams for the workspace -> Admin sees a list of teams with member counts
2. Admin clicks on a team row -> System opens the team detail view -> Admin sees team name, current members, and a "Manage Members" button
3. Admin clicks "Manage Members" -> System opens a sheet/drawer with current members listed and a search input -> Admin sees existing members and an empty search field
4. Admin types a name in the search field -> System queries profiles matching the search text (excluding current members) -> Admin sees matching profiles in a dropdown/list
5. Admin clicks a profile from the search results -> System adds the profile to the team (creates team_member record) -> Admin sees the profile appear in the member list with a success toast
6. Admin clicks the star icon next to a member -> System sets that member as team leader (updates team.leader_profile_id) -> Admin sees the star filled/highlighted for the new leader, previous leader star is cleared
7. Admin clicks the remove button on a member -> System removes the team_member record -> Admin sees the member disappear from the list with a confirmation toast
8. Admin closes the sheet -> System persists all changes (already saved per action) -> Admin returns to the team detail view with updated member count

**Postcondition:** Team membership is updated. Leader assignment is reflected in team.leader_profile_id. All changes are persisted immediately (no separate save step).

**Error paths:**

- Search returns no results -> System displays "No profiles found" message. Admin can refine search or add profiles to the workspace first.
- Network error on add/remove -> System shows error toast with retry option. Member list reflects the last successful state.
- Attempting to remove the only member who is also leader -> System removes the member and clears leader_profile_id. Team has no leader.
- Adding a profile that was concurrently added by another admin -> System returns a conflict/duplicate error. Toast informs admin the profile is already a member. List refreshes.

---

## Journey: Admin Reassigns Position to Another Department

**Precondition:** Admin is logged in, at least two departments exist, the source department has at least one position.

1. Admin navigates to Organization > Departments -> System loads all departments with their positions -> Admin sees departments listed, each showing its positions
2. Admin right-clicks on a position within a department -> System shows a context menu with options including "Move Position" -> Admin sees the context menu
3. Admin clicks "Move Position" -> System opens a dialog showing the position name and a dropdown of target departments (excluding the current department) -> Admin sees the move dialog
4. Admin selects a target department from the dropdown -> System highlights the selection -> Admin sees the target department selected
5. Admin clicks "Confirm" / "Move" -> System updates the position's department_id to the target department -> Admin sees the position disappear from the source department and appear in the target department, with a success toast

**Postcondition:** The position record's department_id is updated. Profiles assigned to that position retain their assignment. The position appears under the new department in all views.

**Error paths:**

- Only one department exists -> "Move Position" option is disabled or hidden in the context menu. Admin cannot move positions without a target.
- Network error on move -> System shows error toast. Position remains in its original department. Admin can retry.
- Position has active shifts in the current schedule -> System warns admin that moving the position may affect scheduled shifts. Admin can confirm or cancel.
- Concurrent deletion of target department -> System returns an error that the target department no longer exists. Dialog refreshes the department list.

---

## Journey: Admin Assigns Department Manager

**Precondition:** Admin is logged in, at least one department exists, at least one profile with manager or admin role exists in the workspace.

1. Admin navigates to Organization > Departments -> System loads all departments -> Admin sees department list with current manager shown (or "No manager" placeholder)
2. Admin clicks "Edit" on a department (or creates a new department) -> System opens the department form/dialog with all fields including a manager profile picker -> Admin sees the department form with a manager field
3. Admin clicks the manager profile picker -> System loads eligible profiles (managers/admins in the workspace) and displays them in a searchable dropdown -> Admin sees a list of eligible profiles
4. Admin selects a profile -> System sets the selection in the form state -> Admin sees the selected profile name/avatar in the manager field
5. Admin clicks "Save" -> System updates department.manager_profile_id to the selected profile's ID -> Admin sees the department detail with the new manager displayed and a success toast

**Postcondition:** department.manager_profile_id is set to the chosen profile. The manager appears on the department card/row in all views.

**Error paths:**

- No eligible profiles exist -> Profile picker shows "No eligible profiles" message. Admin must first create profiles or assign appropriate roles.
- Selected profile is deleted before save -> System returns a foreign key error. Toast shows "Selected profile no longer exists." Form resets the manager field.
- Network error on save -> System shows error toast. Form retains the selection so admin can retry without re-selecting.
- Admin removes manager (clears the field) and saves -> System sets manager_profile_id to null. Department shows "No manager" placeholder.

---

## Journey: Admin Performs Bulk Update on Employees

**Precondition:** Admin is logged in, People tab is accessible, at least two profiles exist in the workspace.

1. Admin navigates to People tab -> System loads all profiles for the workspace -> Admin sees a table/list of employees with checkboxes
2. Admin checks the checkbox on multiple employee rows -> System tracks selected profile IDs and shows a floating action bar at the bottom of the screen -> Admin sees the action bar with the count of selected employees (e.g., "3 selected")
3. Admin clicks an action on the floating bar (e.g., "Update Role") -> System opens a dropdown or dialog with available values (role options) -> Admin sees role options: employee, manager, admin
4. Admin selects the desired value (e.g., "manager") -> System applies the role change to ALL selected profiles in a single batch operation -> Admin sees a success toast ("3 profiles updated to manager"), the table refreshes, and the floating bar clears
5. (Alternative) Admin clicks "Update Department" -> System shows a department picker -> Admin selects a department -> System moves all selected profiles to that department -> Admin sees updated department column for all selected rows
6. (Alternative) Admin clicks "Update Status" -> System shows status options (trainee, active, inactive, offboarding) -> Admin selects a status -> System updates all selected profiles -> Admin sees updated status badges

**Postcondition:** All selected profiles have the new value applied. Changes are persisted in a single batch. The people table reflects the updated state.

**Error paths:**

- No employees selected and action bar is not visible -> Admin must select at least one employee. No action bar appears without selection.
- One or more profiles fail to update (e.g., RLS violation) -> System shows partial success toast: "2 of 3 profiles updated. 1 failed." Failed profiles are highlighted in the table.
- Network error during batch update -> System shows error toast. No profiles are updated (transaction rollback). Selection is preserved so admin can retry.
- Admin deselects all employees -> Floating action bar disappears. No action is taken.
- Attempting to set role to "owner" -> System does not include "owner" in bulk role options. Owner is assigned through a separate flow.

---

## Journey: Admin/Manager Views Employee Profile Card - Overview Tab

**Precondition:** Admin or manager is logged in, at least one employee profile exists in the workspace.

1. Admin navigates to People tab -> System loads the employee list -> Admin sees the list of employees
2. Admin clicks on an employee row -> System opens the employee profile card/sheet with the Overview tab active -> Admin sees the profile card displaying: full name, avatar, role badge, status badge, department, position, and team memberships
3. Admin reviews the profile details -> System displays all data from the profile record including: email, phone, hire date, department name, current teams (with links), and readiness score if applicable -> Admin has a complete overview of the employee

**Postcondition:** No data is modified. Admin has reviewed the employee's organizational context.

**Error paths:**

- Profile has missing/incomplete data (e.g., no department assigned) -> System shows placeholder text ("Not assigned") for missing fields. Profile card still renders.
- Profile was deleted by another admin concurrently -> System shows "Profile not found" error. Admin is returned to the people list.
- Slow network -> System shows skeleton/loading state in the profile card until data arrives.

---

## Journey: Admin/Manager Views Employee Profile Card - Competence Tab

**Precondition:** Admin or manager is logged in, an employee profile card is open.

1. Admin clicks the "Competence" tab on the profile card -> System queries protocol_assignment records for this profile -> Admin sees a list of assigned protocols with their completion status
2. System displays each protocol assignment showing: protocol name, assignment date, status (not_started, in_progress, completed), and completion percentage -> Admin reviews the employee's training progress
3. Admin can see which protocols are complete (checkmark), in progress (progress indicator), or not started (empty) -> System renders status indicators per assignment -> Admin understands the employee's readiness level

**Postcondition:** No data is modified. Admin has a clear picture of the employee's competence status and which protocols remain.

**Error paths:**

- Employee has no protocol assignments -> System shows "No protocols assigned" message with a suggestion to assign protocols via the training module.
- Protocol assignment data fails to load -> System shows error state within the tab with a retry button. Other tabs remain functional.
- Protocol was deleted but assignment still exists (orphaned record) -> System shows the assignment with a "Protocol removed" label. No broken links.

---

## Journey: Admin Views/Edits Employee Profile Card - HR Tab

**Precondition:** Admin is logged in (HR tab is admin-only), an employee profile card is open.

1. Admin clicks the "HR" tab on the profile card -> System loads sensitive HR fields for the profile -> Admin sees: address, personal number (personnummer), bank account number, and emergency contact information
2. Admin clicks on a field to edit (inline editing) -> System enables the field for editing -> Admin sees the field become editable (input field replaces display text)
3. Admin modifies the value (e.g., updates the address) -> System validates the input in real-time (format checks) -> Admin sees validation feedback (green check or red error)
4. Admin clicks "Save" or presses Enter -> System persists the change to the profile record -> Admin sees the field return to display mode with the updated value and a success toast
5. Admin edits emergency contact fields (name, phone, relationship) -> System saves each field on save action -> Admin sees updated emergency contact information

**Postcondition:** Profile HR fields are updated in the database. Changes are immediately visible. Audit trail records the modification (if audit logging is enabled).

**Error paths:**

- Invalid personal number format -> System shows inline validation error: "Invalid format. Expected 11 digits." Field is not saved until corrected.
- Invalid bank account number -> System shows validation error with expected format. Save is blocked.
- Network error on save -> System shows error toast. Field reverts to the previous value. Admin can retry.
- Manager attempts to access HR tab -> System hides the HR tab entirely for non-admin roles. Tab is not rendered in the profile card.
- Empty required fields -> System allows empty values (fields are optional in HR context) but shows a visual indicator that data is missing.

---

## Journey: Admin Edits Employee Profile Card - Settings Tab

**Precondition:** Admin is logged in, an employee profile card is open.

1. Admin clicks the "Settings" tab on the profile card -> System loads current role, department, and status for the profile -> Admin sees dropdown fields for role, department, and status, pre-filled with current values
2. Admin clicks the "Role" dropdown -> System shows available roles: employee, manager, admin -> Admin sees role options
3. Admin selects a new role (e.g., changes from "employee" to "manager") -> System updates the selection in the form -> Admin sees the dropdown reflect the new selection
4. Admin clicks the "Department" dropdown -> System loads all departments in the workspace -> Admin sees department options
5. Admin selects a new department -> System updates the selection -> Admin sees the new department selected
6. Admin clicks the "Status" dropdown -> System shows status options: trainee, active, inactive, offboarding -> Admin sees status options
7. Admin selects a new status -> System updates the selection -> Admin sees the new status selected
8. Admin clicks "Save" -> System persists all changes (role, department_id, status) to the profile record -> Admin sees a success toast and the profile card Overview tab reflects the changes

**Postcondition:** Profile role, department, and/or status are updated. Changes are reflected across all views (people table, team lists, department views). If role changed to manager, the profile becomes eligible for department manager assignment.

**Error paths:**

- No departments exist -> Department dropdown shows "No departments available." Admin must create a department first via Organization.
- Setting status to "offboarding" -> System may trigger offboarding workflows (if configured). Admin sees a confirmation dialog: "This will initiate offboarding. Continue?"
- Setting role to "admin" -> System shows confirmation: "This will grant admin access. Continue?" Admin must confirm.
- Network error on save -> System shows error toast. Form retains the selections so admin can retry.
- Another admin concurrently changed the same profile -> System detects stale data (optimistic concurrency) and shows: "Profile was updated by another user. Refresh to see latest changes." Admin must refresh before saving.
- Attempting to change own role to a lower level -> System prevents self-demotion: "You cannot change your own role." Save is blocked for the role field.
