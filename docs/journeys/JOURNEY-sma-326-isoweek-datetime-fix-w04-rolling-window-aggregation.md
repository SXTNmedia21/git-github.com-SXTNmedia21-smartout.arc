---
title: "Journey — W04 4-week rolling OT cap uses correct week-keys"
feature: sma-326-isoweek-datetime-fix
journey: w04-rolling-window-aggregation
status: verified
verified_at: 2026-05-13
e2e_test: packages/payroll-calculate/__tests__/deviation-checks.test.ts
created: 2026-05-13
updated: 2026-05-13
module: payroll
tags: [journey, payroll, deviation-checks, W04]
---

# Journey: W04 4-week rolling OT cap uses correct week-keys

**Role:** payroll calculation engine (Aml. §10-6 4-uker overtidsgrense — 25h cap)

**Precondition:** Employee has shifts spanning 4+ ISO weeks. `checkW04` at `deviation-checks.ts:211+` uses same `isoWeek`/`isoYear` helpers (line 229) — inherits the same NaN bug.

## Happy Path

1. Calc engine receives `InterpretedShift[]` covering W14, W15, W16, W17 of 2026
2. `checkW04` groups shifts by week-key using `${isoYear(effective_start)}:${isoWeek(effective_start)}`
3. With fix: each shift hashes to its real week-key (`2026:14`, `2026:15`, etc.) — 4 distinct buckets
4. Rolling 4-week window computes correctly:
   - W14-W17 totals: each window of 4 consecutive weeks evaluated against `max_weekly_ot_hours * 4` cap (default 40h × 4 = 160h normal, or `4-week-ot-cap` if framework defines)
5. Without fix: all weeks collapse into `NaN:NaN` bucket; rolling window logic breaks entirely (can't sort by week-string when all are "WNaN")
6. After fix: W04 emits deviation only when ACTUAL 4-week sum exceeds cap

**Postcondition:** W04 deviations reflect real 4-week rolling OT exposure. No false-positives from NaN-bucket collisions; no missed-positives from broken windowing.

## Error Paths

- **Scenario:** Shifts span year boundary (W52 2025 + W01 2026) → `isoYear` returns real year per shift; weekEntries sort lexicographically correctly (`2025:52` < `2026:01`)
- **Scenario:** ISO week 53 (rare leap-week years) → real number, valid rolling window

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter): new test case asserts W04 4-week rolling window aggregates correctly across W14-W17 with full ISODateTime inputs
- [ ] Manually tested end-to-end: existing W04 unit tests still pass; `weekEntries` array length matches distinct week count (not 1)

**Mark `status: verified` in frontmatter when all three boxes are checked.**
