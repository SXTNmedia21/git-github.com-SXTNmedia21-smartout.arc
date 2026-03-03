---
title: "User Journeys — Entity Detail Pages"
status: done
updated: 2026-03-05
created: 2026-03-05
module: org-structure
tags: [journeys, entity-detail, departments, locations, teams, people]
---

# User Journeys — Entity Detail Pages

## Journey: Admin Views Department Details

**Precondition:** Admin is logged in, on Organization page, departments tab has at least one department.

1. Admin clicks a department card → System navigates to `/dashboard/organization/departments/[id]` → Admin sees EntityDetailLayout with breadcrumbs (Organization > Departments > [name]), department color dot, name, and 5 tabs
2. Admin sees **Overview** tab (default) → System shows department stats: member count, position count, team count, policy count
3. Admin clicks **Positions** tab → System shows table of positions with name, type, and member count. "New Position" button available.
4. Admin clicks "New Position" → CreatePositionDialog opens → Admin fills name and type → Saves → Position appears in list
5. Admin clicks **Teams** tab → System shows teams linked to this department with member counts and seasonal badges
6. Admin clicks **Policies** tab → System shows policies scoped to this department
7. Admin clicks **Settings** tab → System shows department edit form (name, icon, color)
8. Admin clicks back arrow → System navigates to previous page (organization departments list)

**Postcondition:** Admin has viewed and optionally edited department details.

**Error paths:**

- Department ID not found → Page shows loading state, then empty (no crash)
- Network error during fetch → Toast error, data shows as empty

---

## Journey: Admin Views Location Details

**Precondition:** Admin is logged in, on Organization page, locations tab has at least one location.

1. Admin clicks a location card → System navigates to `/dashboard/organization/locations/[id]` → Admin sees EntityDetailLayout with breadcrumbs, location type badge, and 4 tabs
2. Admin sees **Overview** tab (default) → System shows location stats: zone count, asset count, capacity info
3. Admin clicks **Zones** tab → System shows zones linked to this location with seasonal indicators
4. Admin clicks **Assets** tab → System shows assets at this location with seasonal indicators
5. Admin clicks **Settings** tab → System shows location edit form

**Postcondition:** Admin has viewed location details, zones, and assets.

**Error paths:**

- Location ID not found → Loading state, then empty

---

## Journey: Admin Views Team Details

**Precondition:** Admin is logged in, on Organization page, teams tab has at least one team.

1. Admin clicks a team card → System navigates to `/dashboard/organization/teams/[id]` (previously opened a sheet — replaced with full page) → Admin sees EntityDetailLayout with breadcrumbs, team color, seasonal badge (if applicable), and 4 tabs
2. Admin sees **Overview** tab → System shows team stats: member count, leader info, department link
3. Admin clicks **Members** tab → System shows profile list of team members with roles and join dates
4. Admin clicks **Policies** tab → System shows policies scoped to this team
5. Admin clicks **Settings** tab → System shows team edit form

**Postcondition:** Admin has viewed team details and members.

**Error paths:**

- Team ID not found → Loading state, then empty

---

## Journey: Admin Views Employee Profile Details

**Precondition:** Admin is logged in, on People page, at least one active employee exists.

1. Admin clicks an employee row in the data table → System navigates to `/dashboard/people/[id]` → Admin sees EntityDetailLayout with breadcrumbs (People > [name]), avatar, role/status badges, and 4 tabs
2. Admin sees **Overview** tab → System shows profile summary: department, team, position, contact info, joined date
3. Admin clicks **Competence** tab → System shows training progress, protocol assignments, readiness score
4. Admin clicks **HR & Logs** tab → System shows contract info, shift history, deviation history
5. Admin clicks **Settings** tab → System shows profile management (role change, status change, deactivate)

**Postcondition:** Admin has full visibility into an employee's profile, competence, and HR data.

**Error paths:**

- Profile ID not found → Loading state, then empty
- Invited user row clicked → System opens slide-out card (does NOT navigate to detail page, because invited users have no profile_id)

---

## Journey: Admin Navigates Between Entity Pages

**Precondition:** Admin is on any entity detail page.

1. Admin clicks a linked entity (e.g. department name in team overview, or team name in profile overview) → System navigates to that entity's detail page
2. Admin clicks breadcrumb link (e.g. "Organization") → System navigates back to the list view
3. Admin clicks back arrow → System uses `router.back()` to return to previous page

**Postcondition:** Admin can navigate fluidly between related entities without losing context.
