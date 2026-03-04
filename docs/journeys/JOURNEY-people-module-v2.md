---
title: "User Journeys — People Module v2"
status: done
updated: 2026-03-03
created: 2026-03-03
module: people
tags: [people, profiles, export, filters, journeys]
---

# User Journeys — People Module v2

This document describes all user journeys for the People Module v2 redesign, covering the enhanced DataTable with real data, department filters, advanced filtering, export, context menus, employee profile cards, full-page profiles, protocol assignment, and member invitations.

---

## Journey: Admin Views People Table

**Precondition:** Admin is logged in, workspace has employees with profiles, departments, and roles assigned.

1. Admin navigates to `/dashboard/people` -> System queries all profiles for the workspace with joined department, role, status, contract, and readiness data -> Admin sees a DataTable with columns: Name, Role (badge), Department, Status, Last Active (relative time, e.g. "2 timer siden"), Contract (signed/pending/draft badge), Readiness score (percentage)
2. Admin clicks a column header (e.g. "Name") -> System sorts the table by that column ascending -> Admin sees rows reordered alphabetically
3. Admin clicks the same column header again -> System toggles to descending sort -> Admin sees rows in reverse order
4. Admin clicks a department pill above the table (e.g. "Bar") -> System filters the table to show only employees in that department -> Admin sees filtered results with the selected department pill highlighted
5. Admin clicks the same department pill again -> System removes the filter and shows all employees -> Admin sees the full unfiltered table
6. Admin clicks a different department pill -> System filters to that department -> Admin sees only employees belonging to the selected department

**Postcondition:** Admin has browsed the people table, sorted by columns, and filtered by department. No data is modified.

**Error paths:**

- No employees in workspace -> System shows empty state with prompt to invite members
- No departments exist -> Department filter pills are not rendered. Table still shows all employees.
- Profile data partially missing (e.g. no department assigned) -> System shows "Ikke tildelt" placeholder in the Department column. Row still renders.
- Slow network -> System shows skeleton loading rows until data arrives

---

## Journey: Admin Uses Advanced Filters

**Precondition:** Admin is on the People page with employees loaded in the table.

1. Admin clicks the advanced filter button (filter icon or "Filter" label) -> System opens a filter popover with sections: Status, Role, Contract, Readiness -> Admin sees the filter popover with all filter options
2. Admin selects one or more Status values (e.g. "active", "trainee") -> System applies the status filter immediately -> Admin sees the table update to show only employees matching the selected statuses
3. Admin selects a Role filter (e.g. "manager") -> System combines the role filter with existing status filter -> Admin sees further narrowed results showing only active/trainee managers
4. Admin selects a Contract filter (e.g. "pending") -> System adds the contract filter -> Admin sees only employees matching all three filters
5. Admin adjusts the Readiness range slider (e.g. 0-50%) -> System filters to employees with readiness score within the range -> Admin sees employees who are below 50% readiness
6. Admin clicks "Nullstill" / "Reset" in the filter popover -> System clears all advanced filters -> Admin sees the full unfiltered table again
7. Admin closes the popover -> Filters remain applied. Active filter count is shown as a badge on the filter button.

**Postcondition:** Table shows only employees matching the combined filter criteria. Filters persist until explicitly cleared.

**Error paths:**

- No employees match the combined filters -> System shows "Ingen resultater" message in the table body. Admin can adjust or reset filters.
- Filter state becomes stale (e.g. department deleted while filter is active) -> System gracefully ignores the stale filter value and shows remaining matches.

---

## Journey: Admin Exports People Data

**Precondition:** Admin is on the People page with employees visible in the table (filters may be active).

1. Admin clicks the Export button -> System shows a dropdown with two options: "Last ned Excel" and "Skriv ut / PDF" -> Admin sees export options
2. (Excel path) Admin clicks "Last ned Excel" -> System generates an .xlsx file containing all currently visible rows with columns matching the table (Name, Role, Department, Status, Last Active, Contract, Readiness) -> Browser downloads the file -> Admin sees the download appear in the browser
3. (PDF path) Admin clicks "Skriv ut / PDF" -> System opens the browser's native print dialog with a print-optimized layout of the current table data -> Admin sees the print preview
4. Admin completes the print/save as PDF -> Browser handles the print/save action -> Admin has a PDF of the people table

**Postcondition:** Admin has exported the current table data (respecting active filters) as Excel or PDF.

**Error paths:**

- No employees visible (all filtered out) -> Export generates an empty file or shows "Ingen data a eksportere" toast. No file is downloaded.
- Excel generation fails (e.g. library error) -> System shows error toast "Kunne ikke generere fil". Admin can retry.
- Browser blocks popup for print dialog -> Admin must allow popups for the domain. System cannot control browser settings.

---

## Journey: Admin Opens Employee Quick Card

**Precondition:** Admin is on the People page with employees listed.

1. Admin clicks on an employee row in the table -> System opens the Employee Profile Card as a sheet/drawer from the right side -> Admin sees the profile card with the Overview tab active
2. Overview tab shows: full name, avatar, role badge, status badge, department, position, team memberships, hire date, email, phone, readiness score -> Admin reviews the employee's organizational context
3. Admin clicks the "Kompetanse" (Competence) tab -> System loads protocol assignments for this profile -> Admin sees a list of assigned protocols with status (not started, in progress, completed) and completion percentage
4. Admin clicks the "HR & Logger" (HR & Logs) tab -> System loads HR-specific fields -> Admin sees: address, personal details, emergency contact, and activity/change logs for this employee
5. Admin clicks the "Innstillinger" (Settings) tab -> System loads role, department, and status dropdowns pre-filled with current values -> Admin can modify the employee's role, department, or status from here
6. Admin closes the card (clicks outside or presses Escape) -> System closes the sheet -> Admin returns to the people table

**Postcondition:** Admin has reviewed the employee across all four tabs without leaving the People page.

**Error paths:**

- Profile data fails to load -> System shows error state in the card with a retry button. Table remains functional.
- Profile was deleted by another admin concurrently -> System shows "Profilen finnes ikke" error. Card closes and table refreshes.
- Slow network -> System shows skeleton loading in each tab until data arrives. Tabs remain clickable.

---

## Journey: Admin Opens Full Employee Profile

**Precondition:** Admin is on the People page or has the Employee Profile Card open.

1. Admin clicks the "Se full profil" (View Full Profile) link on the profile card, or navigates directly to `/dashboard/people/[id]` -> System loads the full-page employee profile -> Admin sees a dedicated page with the employee's name, avatar, role, status, and department in a header section
2. Full-page profile shows 6 tabs: Oversikt (Overview), Kompetanse (Competence), HR & Logger (HR & Logs), Innstillinger (Settings), Vaktplan (Schedule), Aktivitet (Activity) -> Admin sees all tabs
3. Admin clicks "Oversikt" tab -> System shows full employee details, team memberships, readiness score, and summary metrics -> Admin reviews the overview
4. Admin clicks "Kompetanse" tab -> System shows all protocol assignments with detailed progress, completion dates, and ability to assign new protocols -> Admin reviews competence data
5. Admin clicks "HR & Logger" tab -> System shows editable HR fields (address, personal number, emergency contact) and audit/change logs -> Admin can review and edit HR data
6. Admin clicks "Innstillinger" tab -> System shows role, department, status management with save functionality -> Admin can update organizational settings
7. Admin clicks "Vaktplan" tab -> System shows this employee's upcoming and past shifts in a calendar or list view -> Admin reviews the employee's schedule
8. Admin clicks "Aktivitet" tab -> System shows a timeline of the employee's recent actions, logins, completed protocols, and system events -> Admin reviews the activity history
9. Admin clicks the back button or breadcrumb -> System navigates back to `/dashboard/people` -> Admin returns to the people table

**Postcondition:** Admin has reviewed (and optionally edited) the full employee profile across all 6 tabs.

**Error paths:**

- Invalid employee ID in URL -> System shows "Profilen finnes ikke" (404) with a link back to the people page
- Employee belongs to a different workspace -> RLS blocks the query. System shows "Ingen tilgang" error.
- Network error loading a tab -> System shows error state in the tab content with retry. Other tabs remain functional.

---

## Journey: Admin Assigns Protocol to Employee

**Precondition:** Admin is on the employee profile (quick card or full page), Competence tab is visible. At least one protocol exists in the workspace.

1. Admin clicks "Tildel protokoll" (Assign Protocol) button on the Competence tab -> System opens a protocol assignment dialog -> Admin sees the dialog with a search field and a list of available protocols
2. Admin types in the search field (e.g. "Brannrutine") -> System filters the protocol list by name matching the search query -> Admin sees matching protocols
3. Admin selects a protocol from the list -> System highlights the selected protocol -> Admin sees the protocol marked as selected
4. Admin clicks "Tildel" (Assign) -> System creates a `protocol_assignment` record linking the protocol to the employee profile -> System shows success toast "Protokoll tildelt" -> Admin sees the new assignment appear in the Competence tab list with status "not_started"
5. Admin can repeat steps 2-4 to assign additional protocols

**Postcondition:** The employee has a new protocol assignment. Readiness score may decrease (more protocols to complete). Assignment is visible on both quick card and full profile.

**Error paths:**

- No protocols exist in workspace -> Dialog shows "Ingen protokoller funnet. Opprett protokoller i opplæringsmodulen først."
- Protocol already assigned to this employee -> System prevents duplicate assignment. Toast shows "Denne protokollen er allerede tildelt." Protocol is greyed out or hidden in the list.
- Search returns no results -> Dialog shows "Ingen treff" below the search field. Admin can clear the search and browse all protocols.
- Network error on assignment -> System shows error toast "Kunne ikke tildele protokoll". Dialog stays open so admin can retry.

---

## Journey: Admin Changes Employee Role or Department

**Precondition:** Admin is on the People page with employees listed.

1. Admin right-clicks on an employee row -> System shows a context menu with options: Se profil (View Profile), Endre rolle (Change Role), Endre avdeling (Change Department), Deaktiver (Deactivate) -> Admin sees the context menu
2. (Change Role path) Admin clicks "Endre rolle" -> System opens a role picker (dropdown or small dialog) with options: employee, manager, admin -> Admin sees role options with the current role indicated
3. Admin selects the new role (e.g. "manager") -> System updates the profile's role -> System shows success toast "Rolle oppdatert" -> Admin sees the Role badge update in the table row
4. (Change Department path) Admin right-clicks an employee row and clicks "Endre avdeling" -> System opens a department picker showing all workspace departments -> Admin sees department options with the current department indicated
5. Admin selects the new department -> System updates the profile's department_id -> System shows success toast "Avdeling oppdatert" -> Admin sees the Department column update in the table row
6. (Deactivate path) Admin right-clicks an employee row and clicks "Deaktiver" -> System shows a confirmation dialog: "Er du sikker på at du vil deaktivere [Name]?" -> Admin confirms -> System sets profile status to "inactive" -> Admin sees the Status badge change to inactive

**Postcondition:** Employee's role, department, or status is updated. Change is reflected immediately in the table and across all views.

**Error paths:**

- Admin tries to change own role -> System blocks with "Du kan ikke endre din egen rolle"
- Admin tries to deactivate the workspace owner -> System blocks with "Eieren kan ikke deaktiveres"
- Only one admin left and attempting to change their role to employee -> System warns "Dette er den siste administratoren. Tildel en ny administrator først."
- Network error on update -> System shows error toast. Table row reverts to previous value.
- Context menu triggered on mobile/touch (no right-click) -> System provides an alternative action button (three-dot menu) on each row for touch devices.

---

## Journey: Admin Invites New Member

**Precondition:** Admin is logged in, workspace exists, at least one department exists.

1. Admin clicks "Inviter medlem" (Invite Member) button on the People page -> System opens the Invite Member dialog -> Admin sees form fields: name, email, role selector, department selector
2. Admin enters the new member's name -> System accepts text input -> Admin sees the name filled in
3. Admin enters the new member's email address -> System validates email format in real-time -> Admin sees validation feedback (green check or red error for invalid format)
4. Admin selects a role from the dropdown (employee, manager, admin) -> System sets the role selection -> Admin sees the role selected
5. Admin selects a department from the dropdown -> System loads real departments from the workspace and displays them -> Admin sees actual department names (e.g. "Sal & Service", "Bar", "Kjokken")
6. Admin clicks "Send invitasjon" (Send Invitation) -> System creates an invitation record with workspace_id, email, role, and department -> System sends an invitation email to the provided address -> System shows success toast "Invitasjon sendt til [email]" -> Admin sees the dialog close
7. The invited person appears in the people table with a "Invited" / "Venter" status badge until they accept

**Postcondition:** An invitation record is created. The invitee receives an email with a link to accept and create their account. Upon acceptance, a profile is created in the workspace with the pre-selected role and department.

**Error paths:**

- Email already exists in workspace (active profile) -> System shows validation error: "Denne e-postadressen er allerede registrert i denne arbeidsplassen."
- Email already has a pending invitation -> System shows: "En invitasjon er allerede sendt til denne e-postadressen. Vil du sende på nytt?" Admin can resend or cancel.
- Invalid email format -> System shows inline validation: "Ugyldig e-postadresse." Send button is disabled.
- No departments exist -> Department dropdown shows "Ingen avdelinger. Opprett en avdeling først." Send button is disabled until a department is selected.
- Email delivery fails -> Invitation record is still created. System shows warning toast: "Invitasjon opprettet, men e-post kunne ikke sendes. Profilen kan dele lenken manuelt."
- Network error on submit -> System shows error toast. Dialog stays open with form data preserved so admin can retry.

---

## Journey: Manager Views People Table

**Precondition:** Manager is logged in, manager has a department assignment, employees exist in the manager's department.

1. Manager navigates to `/dashboard/people` -> System detects the user's role as "manager" -> System queries profiles scoped to the manager's department(s) only -> Manager sees a DataTable with the same columns as admin view (Name, Role, Department, Status, Last Active, Contract, Readiness) but limited to their department
2. Manager can sort columns by clicking headers -> System sorts within the visible (department-scoped) data -> Manager sees sorted results
3. Department filter pills are not shown (or only show the manager's department) -> Manager cannot browse other departments
4. Manager clicks on an employee row -> System opens the Employee Profile Card with Overview and Competence tabs -> Manager can review employee details and training progress
5. Manager clicks the Competence tab -> System shows protocol assignments for the employee -> Manager reviews training status
6. Context menu on rows shows limited options: Se profil (View Profile) -> Manager does NOT see Change Role, Change Department, or Deactivate options
7. Manager does NOT see the "Inviter medlem" button -> Invitation is an admin-only action

**Postcondition:** Manager has reviewed their department's employees. No cross-department data is visible. No administrative actions (role change, deactivation, invitation) are available.

**Error paths:**

- Manager has no department assignment -> System shows empty state: "Du er ikke tilknyttet noen avdeling. Kontakt administrator."
- Manager's department has no employees -> System shows "Ingen ansatte i din avdeling" with no action prompt (manager cannot invite).
- Manager tries to access `/dashboard/people/[id]` for an employee outside their department -> RLS blocks the query. System shows "Ingen tilgang" or redirects to the people list.
- Manager attempts to access admin-only features via URL manipulation -> Server-side role check blocks the request. System returns 403.
