---
title: "Journey — W03 deviation message contains real ISO week number"
feature: sma-326-isoweek-datetime-fix
journey: w03-message-contains-real-week-number
status: verified
verified_at: 2026-05-13
e2e_test: packages/payroll-calculate/__tests__/deviation-checks.test.ts
created: 2026-05-13
updated: 2026-05-13
module: payroll
tags: [journey, payroll, deviation-checks, W03]
---

# Journey: W03 deviation message contains real ISO week number

**Role:** payroll calculation engine (output consumed by manager-review UI)

**Precondition:** Employee has shifts that legitimately exceed `max_weekly_ot_hours` cap (10h) in a single ISO week.

## Happy Path

1. Calc engine receives `InterpretedShift[]` where one week's total exceeds 10h OT (e.g. 60h Mon-Sun = 20h OT in W14 2026)
2. `checkW03` constructs `weekKey = prof:2026:W14`
3. W03 deviation emitted with message containing literal `"uke W14"` (real digit), NOT `"uke WNaN"`
4. Deviation `details.week` field equals `"W14"` (real string), not `"WNaN"`
5. Manager-review UI renders message: `"Overtid 20.0t i uke W14 overstiger 10t grense (Aml. §10-6)"`

**Postcondition:** Deviation message + details surface real ISO week number for downstream UI, A-melding export, audit logs.

## Error Paths

- **Scenario:** Shift datetime is invalid format (not ISO 8601) → `isoWeek` returns NaN gracefully; calc engine should emit a structured warning, not a "WNaN" message (out of scope for this journey — covered by input validation upstream)
- **Scenario:** ISO week 53 edge case (year-end overflow) → real number returned, not NaN

## Verification

- [ ] Implementation matches the steps above
- [ ] E2E test exists and passes (path in `e2e_test:` frontmatter): new test case asserts `deviation.message` matches `/uke W\d+/` and does NOT match `/WNaN/`; `deviation.details.week` matches `/^W\d+$/`
- [ ] Manually tested end-to-end: existing 35/35 deviation-checks tests still pass + new assertion green

**Mark `status: verified` in frontmatter when all three boxes are checked.**
