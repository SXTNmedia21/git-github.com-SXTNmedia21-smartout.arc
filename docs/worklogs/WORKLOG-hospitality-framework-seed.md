---
title: "Worklog — hospitality-framework-seed"
status: done
updated: 2026-03-24
created: 2026-03-24
module: cascade
tags: [k1a, framework, seed, riksavtalen, tariff]
---

# Worklog — hospitality-framework-seed

> Branch: `feat/hospitality-framework-seed` | Worktree: wt-5 | Started: 2026-03-24

## Status: Done

## Done

- [x] Audit existing framework seed (20260422400100): 8 rules, 8 triggers, 5 tariff rates
- [x] Created migration 20260424100000: extends framework with 19 namespaced rules + 7 triggers + 4 tariff rates
- [x] Total after seed: 27 rules, 15 triggers, 9 platform-level tariff rates
- [x] Framework record updated: name, description, version 1.0.0, rich metadata
- [x] Verified hospitality.ts tariff rates are correct (15.65/29.74/100%)
- [x] Regenerated database.types.ts
- [x] Migration tested against local Supabase — all inserts clean

## Remaining

- [ ] None

## Decisions

| Date       | Decision                                                        | Reason                                                                                              |
| ---------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 2026-03-24 | Additive migration on top of existing K1a seed (20260422400100) | Original seed has 8 rules/triggers; new adds 19 rules + 7 triggers with AML/Riksavtalen namespacing |
| 2026-03-24 | Used aml. and riksavtalen. prefixes for new rule codes          | Clear provenance. Original unprefixed codes kept for backwards compat                               |
| 2026-03-24 | Added min wage, OTP, employer tax to tariff_rate_table          | Bootstrap copies platform rates to workspace — these are needed for payroll                         |

## Log

| Date       | Time  | Event                                              |
| ---------- | ----- | -------------------------------------------------- |
| 2026-03-24 | 22:00 | Feature started                                    |
| 2026-03-24 | 22:30 | Created seed migration with comprehensive rules    |
| 2026-03-24 | 22:45 | Tested migration — 27 rules, 15 triggers, 9 rates |
