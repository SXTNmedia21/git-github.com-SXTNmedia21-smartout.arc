---
title: "Worklog — payroll-foundation"
status: done
updated: 2026-03-22
created: 2026-03-21
module: payroll
tags: [payroll, settings, absence, timebank, norwegian-compliance, mobile, reports]
---

# Worklog — payroll-foundation

## Status: In Progress

## Done

- [x] Payroll feature spec written (user input)
- [x] Plan 1: Data Foundation — 23 tables, 16 enums, 7+2 migrations, payroll schema (ADR-0057)
- [x] Plan 2: Settings UI — 10 components, 9 hooks, all 9 settings screens
- [x] Plan 3: Mobile Payroll UI — spec, design, plan, implementation
- [x] 134 mobile tests passing (supplements 38, absence-projection 36, earnings 17, trust-labels 26, shift-phase 17)
- [x] Mobile: 6 screens (PayrollHomeCard, AbsenceBalance, Timebank, AbsenceRequest, Payslip, SupplementBadges)
- [x] Mobile: 6 query hooks + 2 mutation hooks + 4 pure functions
- [x] Mobile: Meg tab integration + 4 expo-router routes
- [x] Mobile: UX review pass — critical fixes (cache shape, enum, FK), minor fixes (a11y, strings, dedup)
- [x] Web: Reports page — 4 hooks replacing all mock data (overview, staffing, people, training)
- [x] Web: Operations/Drift page — real session/task/shift/cost data with 60s auto-refresh
- [x] Web: Min Lønn page — 3-column payslip view with breakdown, absence balance, timebank
- [x] All gates pass: 22/22 typecheck, 0 lint errors, 134/134 tests

## Remaining

- [ ] Decision log updated with ADR-0057 (payroll schema) — already written, verify registered
- [ ] Learning log updated
- [ ] User journeys documented
- [ ] Update CLAUDE.md with payroll schema type gen command
- [ ] Update DATABASE.md with 23 new tables
- [ ] Absence type settings UI (payroll.absence_type has no CRUD screen yet)
- [ ] W01-W06 seed migration (defaults only in UI, not seeded in DB)

## Decisions

| Date       | Decision                                                         | Reason                                                         |
| ---------- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| 2026-03-21 | UUID[] arrays for many-to-many config (not junction tables)      | 18 tables instead of 25+, admin UI validates on write          |
| 2026-03-21 | Wide table for all 6 supplement types (not type-specific tables) | Matches Planday architecture, simpler queries                  |
| 2026-03-21 | Separate payroll_holiday_calendar from public_holiday            | Platform vs workspace scope — admin imports from platform      |
| 2026-03-21 | Append-only ledgers for absence + timebank                       | Audit trail, balance = SUM of entries                          |
| 2026-03-21 | packages/payroll/ deferred — not needed for config + UI          | Calculation engine comes later, no premature abstraction       |
| 2026-03-22 | Payroll screens in Meg tab + Home card (not new tab)             | No tab bar pollution, action-first priority on home            |
| 2026-03-22 | Balance-first absence request (Planday pattern)                  | Show what you have before requesting, reduces failed requests  |
| 2026-03-22 | Three-tier trust labels (estimate/recorded/settled)              | Payroll is trust domain — every number needs epistemic status  |
| 2026-03-22 | Supplement stacking: kveld+helg stack, helg+helligdag don't      | Helligdag wins over helg (highest rate), kveld always additive |
| 2026-03-22 | Timebank client-side balance (tech debt)                         | MVP acceptable, move to DB view/RPC before calc engine ships   |
| 2026-03-22 | "rejected" for employee withdrawal (no "cancelled" enum value)   | absence_status enum only has pending/approved/rejected         |

## Log

| Date       | Time  | Event                                                                               |
| ---------- | ----- | ----------------------------------------------------------------------------------- |
| 2026-03-21 | —     | Feature spec received, plans written and reviewed                                   |
| 2026-03-21 | —     | wt-5 created, ready for execution                                                   |
| 2026-03-22 | —     | Plan 1 + Plan 2 executed: 23 tables, 16 enums, 10 settings components, 9 hooks      |
| 2026-03-22 | —     | Mobile payroll UI: spec designed via visual companion, brainstormed with mockups    |
| 2026-03-22 | —     | Trust model added after product review (3-tier labeling, supplement stacking rules) |
| 2026-03-22 | —     | Mobile implementation: 14 tasks via subagent-driven development, 134 tests          |
| 2026-03-22 | —     | UX review: 4 critical + 5 important + 10 minor issues found and fixed               |
| 2026-03-22 | —     | Web: Reports wired with real data (4 hooks), Operations wired, Min Lønn page built  |
| 2026-03-22 | —     | All gates pass. Session ended.                                                      |
| 2026-03-22 | 03:58 | Feature closed and merged to development                                            |
