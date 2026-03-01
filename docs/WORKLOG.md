---
title: "Worklog — team-member-management"
status: in_progress
updated: 2026-03-01
created: 2026-03-01
module: org-structure
tags: [teams, departments, members, ui]
---

# Worklog — team-member-management

## Status: 🟡 In Progress

## Done

- [x] Migration: `manager_profile_id` column on department table
- [x] Add `ProfileRow` type + update `DepartmentRow`
- [x] Fetch full profile rows in page.tsx, pass to tabs
- [x] Create `TeamMembersSheet` component (Sheet with member list, add/remove, leader picker)
- [x] Wire `TeamMembersSheet` into `TeamsTab` (card click opens sheet, stopPropagation on dropdown)
- [x] Add department manager picker to `EditDepartmentDialog`
- [x] Thread `profiles` to `DepartmentsTab`, show manager name on cards
- [x] Typecheck: 18/18 packages PASS
- [x] Lint: 0 errors (warnings are pre-existing)

## Remaining

- [ ] Manual verification in browser
- [ ] Commit all changes

## Decisions

| Date       | Decision                                                                    | Reason                                                                  |
| ---------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 2026-03-01 | Used native `<select>` for leader/manager pickers instead of shadcn Command | Simpler UX for small lists, consistent with existing edit dialogs       |
| 2026-03-01 | Custom search input for add-member instead of cmdk Command                  | More control over styling, avoids extra abstraction for a simple filter |

## Log

| Date       | Time | Event                                                                                                  |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------ |
| 2026-03-01 | —    | Session start: Tasks 1-3 already committed                                                             |
| 2026-03-01 | —    | Implemented Tasks 4-7: TeamMembersSheet, TeamsTab wiring, dept manager picker, DepartmentsTab profiles |
| 2026-03-01 | —    | Typecheck + lint: PASS                                                                                 |
