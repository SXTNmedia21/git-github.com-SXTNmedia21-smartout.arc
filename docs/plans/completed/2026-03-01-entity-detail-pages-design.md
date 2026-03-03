---
title: "Entity Detail Pages Design"
id: PLAN_ENTITY_DETAIL_PAGES
version: "1.0"
status: draft
layer: plan
created: 2026-03-01
updated: 2026-03-01
author: pontus + claude
depends_on:
  - MODULE_2_ORG_STRUCTURE
  - PLAN_TEAM_MEMBER_MGMT
  - PLAN_PEOPLE_MGMT
tags:
  - org-structure
  - people
  - detail-pages
  - ui
tables:
  - department
  - location
  - team
  - profile
  - position
  - zone
  - asset
  - team_member
  - protocol_assignment
changelog:
  - date: 2026-03-01
    change: "Initial design"
---

# Entity Detail Pages Design

## Problem

All entity management is done via card grids with dialogs/sheets. There are no dedicated detail pages. Users can't deep-dive into a department, location, team, or profile without juggling multiple dialogs.

## Solution

Create 4 dedicated detail pages with a shared tabs layout pattern.

### Shared Pattern: EntityDetailLayout

All 4 pages share a common structure:

```
┌─────────────────────────────────┐
│ ← Back    Entity: Name    [Edit]│
│ [color] [icon/badges] [status]  │
├─────────────────────────────────┤
│ Tab1 | Tab2 | Tab3 | Tab4       │
├─────────────────────────────────┤
│ [Tab content area]              │
│                                 │
└─────────────────────────────────┘
```

**Navigation:**

- Card click in list view → `router.push(/dashboard/.../[id])`
- Back button → `router.back()`
- Breadcrumb: Organization > Departments > Kitchen

**Data fetching:** Server Component wrapper fetches the entity, client tabs for interactivity.

### Page 1: Department Detail

**Route:** `/dashboard/organization/departments/[id]`

**Header:** Name, color accent, icon, manager name, active/inactive badge, Edit button

| Tab           | Content                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------ |
| **Overview**  | Description, manager, created date, stat cards (positions, teams, members, policies)       |
| **Positions** | Positions list with CRUD (lifted from department drill-down). Create/edit/move/deactivate. |
| **Teams**     | Teams linked to this department. Clickable → team detail page.                             |
| **Policies**  | Policies scoped to this department. Placeholder (Module 6, future wave).                   |
| **Settings**  | Edit form (name, description, color, icon, manager, slug). Deactivate button.              |

### Page 2: Location Detail

**Route:** `/dashboard/organization/locations/[id]`

**Header:** Name, type badge (main/outdoor/kitchen/etc), address, capacity, active/inactive

| Tab          | Content                                                                         |
| ------------ | ------------------------------------------------------------------------------- |
| **Overview** | Description, address, capacity, type, stat cards (zones, assets)                |
| **Zones**    | Zone list with CRUD (lifted from location drill-down). Capacity per zone.       |
| **Assets**   | Asset list with CRUD (lifted from location drill-down). Training/routine flags. |
| **Settings** | Edit form (name, type, address, capacity, lat/lng). Deactivate button.          |

### Page 3: Team Detail

**Route:** `/dashboard/organization/teams/[id]`

**Header:** Name, color accent, type badge (operational/seasonal/etc), leader name, member count, active/inactive

| Tab          | Content                                                                      |
| ------------ | ---------------------------------------------------------------------------- |
| **Overview** | Description, leader, department, season link, stat cards (members, policies) |
| **Members**  | TeamMembersSheet content lifted to a tab. Add/remove members, leader picker. |
| **Policies** | Policies scoped to this team. Placeholder (Module 6, future wave).           |
| **Settings** | Edit form (name, type, department, color, season). Deactivate button.        |

### Page 4: Profile Detail

**Route:** `/dashboard/people/[id]`

**Header:** Avatar, name, role badge, department, status badge, email/phone

| Tab            | Content                                                                             |
| -------------- | ----------------------------------------------------------------------------------- |
| **Overview**   | Contact info, team memberships, recent activity (existing Overview tab content)     |
| **Competence** | Protocol progress (existing Competence tab content)                                 |
| **HR & Logs**  | Personal info editing, contract status, communication log (existing HR tab content) |
| **Settings**   | Role/dept/status editing (existing Settings tab content)                            |

This page replaces the sidebar card as the primary profile view.

## Files to Create/Modify

| File                                              | Action                                      |
| ------------------------------------------------- | ------------------------------------------- |
| `organization/_components/EntityDetailLayout.tsx` | **Create** — Shared layout component        |
| `organization/departments/[id]/page.tsx`          | **Create** — Department detail page         |
| `organization/locations/[id]/page.tsx`            | **Create** — Location detail page           |
| `organization/teams/[id]/page.tsx`                | **Create** — Team detail page               |
| `people/[id]/page.tsx`                            | **Create** — Profile detail page            |
| `organization/_components/departments-tab.tsx`    | **Modify** — Card click navigates to detail |
| `organization/_components/locations-tab.tsx`      | **Modify** — Card click navigates to detail |
| `organization/_components/teams-tab.tsx`          | **Modify** — Card click navigates to detail |
| `people/_components/people-data-table.tsx`        | **Modify** — Row click navigates to detail  |

## No Database Changes

All tables and columns already exist. No migrations needed.

## No New Dependencies

Uses existing shadcn components and Next.js App Router dynamic routes.
