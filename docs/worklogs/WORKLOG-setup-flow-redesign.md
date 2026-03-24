---
title: "Worklog — setup-flow-redesign"
status: done
updated: 2026-03-22
created: 2026-03-22
module: onboarding
tags: [data-pipeline, design-tokens, source-tracking]
---

# Worklog — setup-flow-redesign

> Branch: `feat/setup-flow-redesign` | Worktree: wt-2 | Started: 2026-03-22

## Status: Done

## Done

- [x] Task 1: Fix naceCode in shell + double key mismatch in useIndustryPackage
- [x] Task 2: Fix onboarding resume — restore all 7 dropped join intake fields
- [x] Task 3: Extend finalize RPC — write all business data to DB + field_sources JSONB
- [x] Task 4: Add source tracking to join shell and company_details
- [x] Task 5: Dashboard wizard — read all data from DB tables (4 new TanStack queries)
- [x] Task 6: Handbook generation — enrich chapters with real business data + document extraction
- [x] Task 7: Governance step — wire extracted policies to auto-select templates
- [x] Task 8: Wire remaining extraction gaps (payroll supplements, notice period)
- [x] Task 9: Team step — suggest template positions per department via POSITION_MAP
- [x] Task 10: WelcomeStep — persist inline edits to DB with source tracking
- [x] Task 11: Design tokens — join flow (43 hardcoded color violations replaced)
- [x] Task 12: Design tokens — onboarding flow (18 hardcoded color violations replaced)
- [x] Task 13: Design tokens — dashboard wizard (299 isDark ternaries removed, 12 files)
- [x] Task 14: Integration verification — typecheck 0 errors, Step4Hours strict null fix

## Remaining

- None

## Decisions

| Date       | Decision                                                         | Reason                                                                                                   |
| ---------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 2026-03-22 | Source tracking via field_sources JSONB on company_details       | Track provenance of every auto-populated field (scrape/brreg/ai/user) without adding columns per field   |
| 2026-03-22 | Replace isDark prop with CSS variable tokens                     | isDark ternaries created 299 instances of duplicated logic; CSS variables handle dark mode automatically |
| 2026-03-22 | Read dashboard wizard data from DB tables, not intelligence_data | intelligence_data is a staging blob for onboarding; DB tables are the source of truth post-finalize      |

## Log

| Date       | Time  | Event                                                                           |
| ---------- | ----- | ------------------------------------------------------------------------------- |
| 2026-03-22 | 19:07 | Feature started                                                                 |
| 2026-03-22 | 19:15 | Plan read from main repo, copied to wt-2                                        |
| 2026-03-22 | 19:16 | Team created: 3 parallel agents (data-pipeline, join-tokens, onboarding-tokens) |
| 2026-03-22 | 19:20 | Tasks 11+12 (design tokens) completed by join-tokens + onboarding-tokens        |
| 2026-03-22 | 19:22 | Tasks 1-10 (data pipeline) completed by data-pipeline agent                     |
| 2026-03-22 | 19:23 | Task 13 (dashboard wizard tokens) completed by wizard-tokens agent              |
| 2026-03-22 | 19:25 | Task 14: typecheck passes, Step4Hours fix committed                             |
| 2026-03-22 | 19:30 | Feature closure — all 14 tasks complete, 14 commits, 0 type errors              |
| 2026-03-22 | 20:55 | Feature closed and merged to development                                        |
