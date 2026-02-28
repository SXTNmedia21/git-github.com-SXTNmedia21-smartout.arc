---
title: "Module 8: Lønn & Økonomi (Payroll & Finance)"
id: MODULE_08
version: "1.0"
status: draft
layer: module
created: 2026-02-24
updated: 2026-02-28
author: pontus
supersedes: []
superseded_by: null
depends_on:
  - CORE_ARCH_V2
  - MODULE_03
tags:
  - payroll
  - finance
  - supplements
  - overtime
  - norwegian-compliance
tables:
  - payroll_run
  - payroll_line
  - supplement_rule
  - timebank_balance
changelog:
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Module 8: Lønn & Økonomi (Payroll & Finance)

> **Smartout.io** — Functional documentation for migration
> Version 1.0 | February 2026
> **Dependencies:** Core Architecture v2 (Profile, Department), Module 3 (Scheduling — shifts/punches), Module 7 (Absence)
> **Status:** PLACEHOLDER — requires detailed specification

---

## 1. Module Overview

Full payroll calculation from shift data. Covers wage types, supplements (evening, night, weekend, holiday, overtime), timebank/TOIL, absence pay (sick, vacation, parental), and Norwegian tax/pension compliance. Monthly payroll runs with validation.

### What This Module Covers

- Wage basis (hourly vs fixed salary, employment categories)
- Supplements (evening, night, weekend, holiday, overtime)
- Overtime detection and timebank (TOIL)
- Absence pay (sick, vacation, parental)
- Monthly payroll calculation engine
- Norwegian compliance: arbeidsgiveravgift, feriepenger, OTP, A-melding
- Payroll reports per employee and department

---

## 2. Wage Basis

> **TODO:** Detailed specification needed

- Wage types: fixed monthly salary, hourly rate
- Base rate per employee (stored on employment contract or payroll extension)
- Employment category: full_time | part_time | temporary | flexible | apprentice
- Effective hourly rate calculation (for fixed salary: monthly / agreed hours)

---

## 3. Supplements

> **TODO:** Detailed specification needed

Configured via Policy (`policy_type: payroll`) with `rules_json`:

| Supplement                  | Trigger                        | Typical Rate |
| --------------------------- | ------------------------------ | ------------ |
| Evening (kveldstillegg)     | After 17:00/21:00              | kr/hour or % |
| Night (nattillegg)          | After 21:00/23:00              | kr/hour or % |
| Weekend (helgetillegg)      | Saturday/Sunday                | kr/hour or % |
| Holiday (helligdagstillegg) | Public holidays                | kr/hour or % |
| Overtime 40%                | First 2 hours overtime         | 40% of base  |
| Overtime 50%                | Beyond 2 hours / night/weekend | 50% of base  |

Rules per day category (`_dayCategory`): morning, midday, afternoon, evening, night, weekend.

---

## 4. Overtime & Timebank

> **TODO:** Detailed specification needed

- Automatic overtime detection based on Norwegian law (Arbeidsmiljøloven §10-6)
- Different rules per employment type
- Timebank (TOIL) — overtime as time off instead of pay
- Balance tracking with expiry dates
- Employee choice: payout vs. avspasering (configurable per workspace)

---

## 5. Absence Pay

> **TODO:** Detailed specification needed

- Sick pay: employer period (16 days) at full pay
- Vacation pay: 12% of previous year's earnings (10.2% for over-60s)
- Parental leave: NAV coverage
- NAV refund tracking for employer

---

## 6. Payroll Calculation Engine

> **TODO:** Detailed specification needed

Monthly payroll run pipeline:

```
Shifts (from Module 3)
  → Hours per day category
    → Base pay calculation
      → + Supplements (evening, night, weekend, holiday)
        → + Overtime supplements
          → - Absence deductions + absence pay
            → = Gross salary
              → + Employer costs:
                  Arbeidsgiveravgift (14.1%)
                  Feriepenger (12%)
                  OTP Pension (2% minimum)
              → = Total employer cost
```

Validation checks before finalization. Admin review and approval step.

---

## 7. Reports

> **TODO:** Detailed specification needed

- Payslip (lønnslipp) per employee per period
- Wage cost per department
- Overtime report
- Vacation pay report (feriepengerapport)
- Budget vs. actual
- A-melding export data

---

## 8. Data Model

> **TODO:** Detailed table schemas needed

**Expected tables:**

- `payroll_run` — monthly run with status (draft, calculating, review, finalized)
- `payroll_line` — individual line items per employee per run
- `supplement_rule` — configured via Policy, referenced during calculation
- `timebank_balance` — TOIL balance per employee

**Expected enums:**

- `RateType`: fixed | hourly | multiplier | percentage | calculated
- `SalaryCategory`: base_pay | overtime | supplement | absence | deductions
- `SalaryType`: hourly | monthly
- `EmploymentCategory`: full_time | part_time | temporary | flexible | apprentice

---

## 9. Integration Points

| Module                       | Integration                                          |
| ---------------------------- | ---------------------------------------------------- |
| **Module 3 (Scheduling)**    | Shift data + punch records = hours worked            |
| **Module 7 (Absence)**       | Absence days → pay deductions + absence pay          |
| **Module 11 (Settings)**     | Payroll configuration via Policy                     |
| **Module 13 (Multi-Tenant)** | Workspace-scoped payroll, no cross-workspace leakage |
| **Module 14 (Compliance)**   | A-melding export, Bokføringsloven retention          |

---

_This module requires detailed specification. The content above is extracted from SMARTOUT_COMPLETE_DOCUMENTATION.md and the master index. A full spec should include complete data models, calculation algorithms, Norwegian tax/law edge cases, and the payroll UI._
