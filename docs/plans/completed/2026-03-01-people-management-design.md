---
title: "People Management + Position-Dept Mapping"
id: PLAN_PEOPLE_MGMT
version: "1.0"
status: done
layer: plan
created: 2026-03-01
updated: 2026-03-03
author: pontus + claude
depends_on:
  - MODULE_2_ORG_STRUCTURE
tags:
  - people
  - profiles
  - bulk-actions
  - positions
  - ui
tables:
  - profile
  - user_identity
  - department
  - team_member
  - team
  - protocol_assignment
  - protocol
  - employment_contract
  - position
changelog:
  - date: 2026-03-01
    change: "Initial design"
---

# People Management + Position-Dept Mapping

## Problem

The People page (`/dashboard/people`) has a functional data table and a profile sidebar card, but:

1. Sidebar tabs are mostly stubs with hardcoded data
2. No edit capabilities for profile fields (role, status, department, personal info)
3. No bulk actions for managing multiple profiles at once
4. Positions cannot be moved between departments

## Solution

### Feature 1: Profile Sidebar — Real Data + Editing

Rewrite the 4 tab contents in `employee-profile-card.tsx` to use real DB data and add edit capabilities.

**Overview tab:**

- Real contact info from DB (email, phone — partially works already)
- Team memberships via `team_member` JOIN `team`
- Activity timeline stays as placeholder (needs `activity_trail` data, future wave)

**Competence tab:**

- Query `protocol_assignment` JOIN `protocol` for this profile
- Real completion status and progress percentage
- "Send Reminder" button stays as placeholder (needs notification system)

**HR tab:**

- Make personal info fields editable: address, personal_number, bank_account
- Show contract status from `employment_contract` table
- Emergency contact editing (stored on `user_identity`)
- Inline save with toast confirmation

**Settings tab:**

- Department dropdown connected to real departments list with save action
- Role dropdown (employee/manager/admin/owner) with save action
- Status management (active/inactive/trainee/offboarding) with save action
- "Deactivate Account" connected to real `is_active` toggle
- Language preference and notification preference fields

**Data flow:** The sidebar receives the full `Employee` object. For editing, it creates a Supabase client and updates `profile` or `user_identity` directly. After save, it calls `onRefresh()` to reload the parent data table.

### Feature 2: Bulk Actions on People Table

Add multi-select with a floating action bar to `PeopleDataTable`.

**UI:**

- Checkbox column on each row + "select all" checkbox in header
- When 1+ rows selected, floating action bar appears above table:
  - "Assign Department" — dropdown with department list
  - "Change Role" — dropdown (employee/manager/admin)
  - "Change Status" — dropdown (active/inactive/offboarding)
  - "Deactivate" — red button with confirmation dialog
  - "Clear selection" — deselect all
- Selected count shown: "3 selected"

**Data operations:**

- All bulk actions: `supabase.from("profile").update({...}).in("profile_id", selectedIds)`
- Toast confirmation with count ("3 profiles updated")
- Refresh table after each bulk action

**Constraints:**

- Cannot bulk-change to `owner` role (security)
- Cannot deactivate yourself
- Invited profiles (from `invitation` table) are excluded from bulk actions

### Feature 3: Position-Department Mapping

Add ability to move positions between departments.

**UI:** New "Move to Department" option in the position dropdown menu (in `departments-tab.tsx`). Opens a small dialog with a department select dropdown.

**Data:** `supabase.from("position").update({ department_id: newDeptId }).eq("position_id", posId)`

No new page needed — just a dropdown menu item + a small confirmation dialog.

## Files to Create/Modify

| File                                              | Action            | Scope                                  |
| ------------------------------------------------- | ----------------- | -------------------------------------- |
| `people/_components/employee-profile-card.tsx`    | **Major rewrite** | All 4 tabs: real data + editing        |
| `people/_components/people-data-table.tsx`        | **Modify**        | Add checkbox column + bulk action bar  |
| `people/_components/types.ts`                     | **Modify**        | Extend Employee type if needed         |
| `people/page.tsx`                                 | **Modify**        | Pass departments to profile card       |
| `organization/_components/departments-tab.tsx`    | **Modify**        | Add "Move" menu item for positions     |
| `organization/_components/MovePositionDialog.tsx` | **Create**        | Small dialog for position reassignment |

## No Database Changes

All tables and columns already exist. No migrations needed.

## No New Dependencies

Uses existing shadcn components: Checkbox (may need to add), Select, Dialog, DropdownMenu.
