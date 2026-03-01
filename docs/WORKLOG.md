---
title: "Worklog — schedule-ui"
status: in_progress
updated: 2026-03-01
created: 2026-03-01
module: schedule
tags: [schedule, ui, persistence, realtime, tanstack-query, audit-log]
---

# Worklog — schedule-ui

## Status: 🟢 Phase 1 Complete

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
- [x] Task 12: Final verification — zero schedule type errors, ADR written

## Remaining

- [ ] Replace dummyEmployees with profile query (schedule-data.ts still provides employee grid data)
- [ ] Paste-day operation (batch shift creation from clipboard — left as TODO)
- [ ] schedule-toasts.tsx cleanup (deprecated, mutations handle own toasts)

## Decisions

| Date       | Decision                                          | Reason                                                                                       |
| ---------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 2026-03-01 | Full TanStack Query replacement (not incremental) | Single source of truth in query cache. No dual-state coordination.                           |
| 2026-03-01 | Direct supabase-js (no Edge Function gateway)     | Simpler, faster. RLS enforces workspace isolation. Gateway stays for external API consumers. |
| 2026-03-01 | Row-level audit log with DB triggers              | Automatic, no missed changes. Single audit_schedule_changes() function for all tables.       |
| 2026-03-01 | Last write wins for conflicts                     | Realtime sync shows updated state. Good enough for shift-planning where conflicts are rare.  |

## Log

| Date       | Time | Event                                                                     |
| ---------- | ---- | ------------------------------------------------------------------------- |
| 2026-03-01 | —    | Session started, brainstorming Phase 1 design                             |
| 2026-03-01 | —    | Design approved, plan written (12 tasks)                                  |
| 2026-03-01 | —    | Tasks 1-2 + Task 3 executed in parallel (TanStack install + DB migration) |
| 2026-03-01 | —    | Task 4: Query keys + mappers                                              |
| 2026-03-01 | —    | Task 5: Shift hooks with optimistic updates                               |
| 2026-03-01 | —    | Tasks 6+7+8 executed in parallel (entity hooks + realtime + UI context)   |
| 2026-03-01 | —    | Task 9: page.tsx provider swap                                            |
| 2026-03-01 | —    | Task 10: All 15 components migrated                                       |
| 2026-03-01 | —    | Task 11: Deleted schedule-context.tsx, fixed 40 type errors               |
| 2026-03-01 | —    | Task 12: Verification passed, ADR-0037 written                            |
