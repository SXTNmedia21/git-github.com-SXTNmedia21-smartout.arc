---
title: "Worklog — schedule-ui"
status: done
updated: 2026-03-01
created: 2026-03-01
module: schedule
tags: [schedule, ui, persistence, realtime, tanstack-query, audit-log]
---

# Worklog — schedule-ui

## Status: 🟢 Done

## Done

- [x] Initial schedule UI components (previous sessions)
- [x] Schedule database schema (ADR-0036)
- [x] Task 1-2: Installed @tanstack/react-query, added QueryClientProvider to dashboard layout
- [x] Task 3: Migration 20260301600000 — 7 new tables, 4 enums, audit trigger, rollback RPC, RLS, Realtime
- [x] Task 4: Query key factory (schedule-keys.ts) and DB type mappers (schedule-mappers.ts)
- [x] Task 5: Shift hooks — useShifts, useCreateShift, useUpdateShift, useDeleteShift, useMoveShift, usePublishShifts, useUnpublishShifts
- [x] Task 6: Entity hooks — use-absences.ts, use-templates.ts, use-open-shifts.ts, use-day-content.ts, use-audit-log.ts
- [x] Task 7: Realtime subscription hook — use-schedule-realtime.ts
- [x] Task 8: UI-only state context (schedule-ui-context.tsx) + computed values hook (use-schedule-computed.ts)
- [x] Task 9: Refactored page.tsx — ScheduleUIProvider + TanStack Query hooks replace old ScheduleProvider
- [x] Task 10: Migrated all 15 child components from dispatch() to mutation hooks + useScheduleUI
- [x] Task 11: Deleted old schedule-context.tsx (1283 lines), fixed all 40 type errors
- [x] Task 12: Final verification — zero schedule type errors, ADR-0041 written
- [x] Replace dummyEmployees with Supabase profile query (use-employees.ts hook)
- [x] Paste-day operation (batch shift creation from clipboard — usePasteDay hook)
- [x] Removed deprecated schedule-toasts.tsx
- [x] Learning 0014: supabase gen types stdout noise
- [x] User journeys documented (17 journeys)
- [x] Feature closure checklist verified

## Decisions

| Date       | Decision                                          | Reason                                                                                       |
| ---------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 2026-03-01 | Full TanStack Query replacement (not incremental) | Single source of truth in query cache. No dual-state coordination.                           |
| 2026-03-01 | Direct supabase-js (no Edge Function gateway)     | Simpler, faster. RLS enforces workspace isolation. Gateway stays for external API consumers. |
| 2026-03-01 | Row-level audit log with DB triggers              | Automatic, no missed changes. Single audit_schedule_changes() function for all tables.       |
| 2026-03-01 | Last write wins for conflicts                     | Realtime sync shows updated state. Good enough for shift-planning where conflicts are rare.  |

## Log

| Date       | Time | Event                                                                      |
| ---------- | ---- | -------------------------------------------------------------------------- |
| 2026-03-01 | —    | Session started, brainstorming Phase 1 design                              |
| 2026-03-01 | —    | Design approved, plan written (12 tasks)                                   |
| 2026-03-01 | —    | Tasks 1-2 + Task 3 executed in parallel (TanStack install + DB migration)  |
| 2026-03-01 | —    | Task 4: Query keys + mappers                                               |
| 2026-03-01 | —    | Task 5: Shift hooks with optimistic updates                                |
| 2026-03-01 | —    | Tasks 6+7+8 executed in parallel (entity hooks + realtime + UI context)    |
| 2026-03-01 | —    | Task 9: page.tsx provider swap                                             |
| 2026-03-01 | —    | Task 10: All 15 components migrated                                        |
| 2026-03-01 | —    | Task 11: Deleted schedule-context.tsx, fixed 40 type errors                |
| 2026-03-01 | —    | Task 12: Verification passed, ADR-0041 written                             |
| 2026-03-01 | —    | Paste-day: usePasteDay hook + wired into day-context-menu.tsx              |
| 2026-03-01 | —    | Replace dummyEmployees with real Supabase profile query (use-employees.ts) |
| 2026-03-01 | —    | Removed schedule-toasts.tsx, learning 0014, user journeys, feature closure |

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
