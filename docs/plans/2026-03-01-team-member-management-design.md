---
title: "Team Member Management + Department Manager Assignment"
id: PLAN_TEAM_MEMBER_MGMT
version: "1.0"
status: active
layer: plan
created: 2026-03-01
updated: 2026-03-01
author: pontus + claude
depends_on:
  - MODULE_2_ORG_STRUCTURE
tags:
  - org-structure
  - teams
  - departments
  - ui
tables:
  - team_member
  - team
  - profile
  - department
changelog:
  - date: 2026-03-01
    change: "Initial design"
---

# Team Member Management + Department Manager Assignment

## Problem

Teams can be created and edited, but there is no way to add or remove members.
The `team_member` table exists and is queried for counts, but no UI manages it.
Similarly, departments have no manager assignment UI (`department_manager` field unused).

## Solution

### Feature 1: Team Member Sheet

**Entry point:** Click a team card to open a Sheet (right slide-in panel).

**Sheet contents:**

1. **Header** — Team name, type badge, color accent, member count
2. **Leader section** — Current leader shown with star badge. Change via dropdown (filtered to current members only). Clear button to remove leader.
3. **Member list** — Each row: avatar initials + full name + role badge + department name + remove button (X). Leader gets a star icon.
4. **Add member** — Combobox (shadcn Command) that searches workspace profiles NOT already in the team. Shows name + role + department in results. Selecting adds immediately.

**Data operations (all client-side Supabase):**

| Action         | Query                                                       |
| -------------- | ----------------------------------------------------------- |
| Load members   | `team_member` JOIN `profile` WHERE team_id = X              |
| Load available | `profile` WHERE workspace_id = X AND NOT IN current members |
| Add member     | INSERT `team_member` (team_id, profile_id)                  |
| Remove member  | DELETE `team_member` WHERE team_id + profile_id             |
| Set leader     | UPDATE `team` SET leader_profile_id WHERE team_id           |
| Clear leader   | UPDATE `team` SET leader_profile_id = null WHERE team_id    |

**Edge case:** Removing a member who is the current leader clears `leader_profile_id` automatically.

### Feature 2: Department Manager Picker

**Entry point:** New field in the existing `EditDepartmentDialog`.

**UI:** Combobox dropdown showing profiles in the workspace. Selected profile shown with name + avatar. Clear button to remove manager.

**Data:** UPDATE `department` SET `department_manager` = profile_id (or null to clear).

Note: `department_manager` is a text field on the `department` table. It stores a profile_id reference.

## Files to Create/Modify

| File                                                | Action                              |
| --------------------------------------------------- | ----------------------------------- |
| `organization/_components/TeamMembersSheet.tsx`     | **Create** — Main sheet component   |
| `organization/_components/teams-tab.tsx`            | **Modify** — Card click opens sheet |
| `organization/_components/EditDepartmentDialog.tsx` | **Modify** — Add manager picker     |
| `organization/_components/types.ts`                 | **Modify** — Add ProfileRow type    |

## No New Dependencies

Uses existing shadcn components: Sheet, Command, Button, Badge, Avatar (if installed, otherwise initials-only).

## No Database Changes

All tables and columns already exist. No migrations needed.
