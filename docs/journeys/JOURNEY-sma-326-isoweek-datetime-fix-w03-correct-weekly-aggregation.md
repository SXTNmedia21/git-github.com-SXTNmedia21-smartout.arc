---
title: "Journey — W03 aggregates per ISO week (not collapsed into NaN bucket)"
feature: sma-326-isoweek-datetime-fix
journey: w03-correct-weekly-aggregation
status: draft
verified_at: null
e2e_test: packages/payroll-calculate/__tests__/deviation-checks.test.ts
created: 2026-05-13
updated: 2026-05-13
module: payroll
tags: [journey, payroll, deviation-checks, W03]
---

# Journey: W03 aggregates per ISO week (not collapsed into NaN bucket)

**Role:** payroll calculation engine (internal — exposed via deviations on payroll-period UI)

**Precondition:** Employee has multiple shifts spread across 3 distinct ISO weeks, each week individually under the `max_weekly_ot_hours` cap (default 10h).

## Happy Path

1. Calc engine receives `InterpretedShift[]` for the employee covering shifts in W14 + W15 + W16 — each week sums to <10h OT individually (e.g. 5h, 8h, 5h)
2. `checkW03(shifts, framework)` runs:
   - For each shift: `weekKey = ${profile_id}:${isoYear(shift.effective_start)}:W${isoWeek(shift.effective_start)}`
   - `isoYear`/`isoWeek` accept full ISO datetime (`"2026-04-07T06:00:00Z"`) → return real year + week number (2026 + 14)
   - Three distinct buckets created: `prof:2026:W14`, `prof:2026:W15`, `prof:2026:W16`
3. For each bucket, `otMinutes = max(0, totalMinutes - normalWeeklyMinutes)` — each well under `maxOtMinutesPerWeek`
4. No deviation emitted for these shifts
5. UI shows zero W03 warnings for this employee

**Postcondition:** `Deviation[]` from `runDeviationChecks` contains no `W03` for the employee. Buckets are per-week, not collapsed.

## Error Paths

- **Scenario:** Single week exceeds 10h OT → W03 fires correctly for THAT week (correct positive)
- **Scenario:** Mixed input — some shifts pass YYYY-MM-DD-only date → `isoWeek` tolerates both shapes; returns real week number; no NaN collision

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter): new test case in `deviation-checks.test.ts` asserts 3 shifts across W14/W15/W16 each 8h OT → 0 W03 deviations
- [ ] Manually tested end-to-end: run `pnpm --filter @smartout/payroll-calculate test -- deviation-checks` — new test passes; existing 35/35 still green

**Mark `status: verified` in frontmatter when all three boxes are checked.**
