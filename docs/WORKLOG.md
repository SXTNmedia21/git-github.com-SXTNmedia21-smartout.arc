---
title: "Worklog — team-member-management"
status: in_progress
updated: 2026-03-01
created: 2026-03-01
module: org-structure
tags: [teams, departments, members, people, ui]
---

# Worklog — team-member-management

## Status: 🟡 In Progress

## Done

### Team Member Management

- [x] Migration: `manager_profile_id` column on department table
- [x] Add `ProfileRow` type + update `DepartmentRow`
- [x] Fetch full profile rows in page.tsx, pass to tabs
- [x] Create `TeamMembersSheet` component (Sheet with member list, add/remove, leader picker)
- [x] Wire `TeamMembersSheet` into `TeamsTab` (card click opens sheet, stopPropagation on dropdown)
- [x] Add department manager picker to `EditDepartmentDialog`
- [x] Thread `profiles` to `DepartmentsTab`, show manager name on cards

### People Management

- [x] Extend Employee type with `profileId`, thread deps to profile card
- [x] Rewrite Settings tab: real dept/role/status dropdowns with save action
- [x] Rewrite HR tab: editable personal info (address, SSN, bank, emergency contact)
- [x] Rewrite Competence tab: real protocol assignment data from DB
- [x] Enhance Overview tab: real team memberships from DB
- [x] Add bulk actions: multi-select checkboxes + floating action bar (dept/role/status)

### Position-Department Mapping

- [x] Create MovePositionDialog for position reassignment
- [x] Add "Move to Department" menu item in position dropdown

### Verification

- [x] Typecheck: 18/18 packages PASS
- [x] All commits pass pre-commit hooks (eslint + prettier)

## Remaining

- [ ] Manual verification in browser
- [ ] Update BUILD_ORDER.md with completed items

## Decisions

| Date       | Decision                                                                    | Reason                                                                  |
| ---------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 2026-03-01 | Used native `<select>` for leader/manager pickers instead of shadcn Command | Simpler UX for small lists, consistent with existing edit dialogs       |
| 2026-03-01 | Custom search input for add-member instead of cmdk Command                  | More control over styling, avoids extra abstraction for a simple filter |
| 2026-03-01 | Adapted Competence tab to real DB schema (pending/completed/expired)        | Plan referenced `progress` column that doesn't exist; used actual enum  |

## Log

| Date       | Time | Event                                                                                                  |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------ |
| 2026-03-01 | —    | Session start: Tasks 1-3 already committed                                                             |
| 2026-03-01 | —    | Implemented Tasks 4-7: TeamMembersSheet, TeamsTab wiring, dept manager picker, DepartmentsTab profiles |
| 2026-03-01 | —    | Typecheck + lint: PASS                                                                                 |
| 2026-03-01 | —    | People management: Settings tab, HR tab, Competence tab, Overview tab                                  |
| 2026-03-01 | —    | Bulk actions: checkbox multi-select + floating action bar                                              |
| 2026-03-01 | —    | Position-dept reassignment: MovePositionDialog                                                         |
| 2026-03-01 | —    | Final typecheck: 18/18 PASS                                                                            |
