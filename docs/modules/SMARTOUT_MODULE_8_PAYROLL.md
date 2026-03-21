---
title: "Module 8: Lønn & Økonomi (Payroll & Finance)"
id: MODULE_08
version: "2.0"
status: in_progress
layer: module
created: 2026-02-24
updated: 2026-03-21
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
  - cascade
  - riksavtalen
tables:
  - payroll_run
  - payroll_line
  - supplement_rule
  - timebank_balance
  - tariff_rate_table
  - employee_payroll_profile
  - shift_cost_snapshot
changelog:
  - date: 2026-03-21
    change: "Major update: corrected Riksavtalen rates, tariff versioning, per-shift cost model, AML overtime rules, ansiennitet steps, A-melding, employee_payroll_profile concept, five-dimension references"
  - date: 2026-02-28
    change: "Added YAML frontmatter"
---

# Module 8: Lønn & Økonomi (Payroll & Finance)

> **Smartout.ai** — Functional documentation for migration
> Version 2.0 | March 2026
> **Dependencies:** Core Architecture v2 (Profile, Department), Module 3 (Scheduling — shifts/punches), Module 7 (Absence)
> **Status:** IN PROGRESS — fleshed out with AI Council findings 2026-03-21
>
> **Cascade architecture:** This module consumes L5 (Schedule Shifts) and applies D3 (Rules & Constraints) for rate calculations. Supplement rates come from the Riksavtalen tariff tables. See `docs/cascade-spreadsheet-overview.md` for the full framework.

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

## 3. Supplements (Riksavtalen — Verified 2026-03-21)

Previous documentation had incorrect placeholder values. These are the verified Riksavtalen rates.

### 3.1 Tillegg (supplements)

| Supplement | Norwegian | Rate | Window |
|------------|-----------|------|--------|
| Evening | Kveldstillegg | 15.65 kr/t | Mon-Fri 21:00-24:00 |
| Night | Nattillegg | 54.76 kr/t | 00:00-06:00 |
| Weekend | Helgetillegg | 29.74 kr/t | Sat 14:00-24:00, Sun 06:00-24:00 |
| Public holiday | Helligdagstillegg | 100% of individual hourly rate | Red calendar days |

### 3.2 Overtid (overtime)

| Type | Rate | Trigger |
|------|------|---------|
| Daytime overtime | +50% of base | Hours beyond agreed_weekly_hours or 9h/day |
| Night/holiday overtime | +100% of base | Overtime hours during night/holiday windows |

**AML overtime rules (Arbeidsmiljoeloven ss 10-6):**
- Overtime = hours beyond agreed_weekly_hours (from employment_contract)
- Max 10h overtime/week, 25h/4 weeks, 200h/year (can be extended by agreement to 300h or 400h with Arbeidstilsynet)
- Overtime MUST be paid — cannot be compensated solely with time off unless explicitly agreed

### 3.3 Ansiennitet wage steps (seniority)

Wages increase with seniority. Example: Kokk med fagbrev (NHO/Fellesforbundet tariff):

| Years | 0 | 2 | 4 | 6 | 8 | 10 |
|-------|---|---|---|---|---|---|
| kr/t | 224.45 | 228.67 | 233.01 | 237.47 | 242.06 | 247.03 |

Fagbrev distinction: employees with/without fagbrev have different rate tables. Tracked via `profile.has_fagbrev`.

### 3.4 Personal supplements (personlige tillegg)

| Seniority | Monthly |
|-----------|---------|
| 10 years | 900 kr/mnd |
| 15 years | 1400 kr/mnd |
| 20 years | 1900 kr/mnd |

### 3.5 Allmenngjoring

ALL Riksavtalen rates are mandatory for ALL restaurants in Norway. No opt-out. Non-unionized restaurants must pay these minimums.

### 3.6 Tariff Rate Versioning

Rates change annually when new tariff agreements are negotiated. The system must support:
- `tariff_rate_table` with `effective_from` / `effective_until` dates
- Lookup: for a given shift date, find the active tariff version
- Historical accuracy: past shifts use the tariff that was active at the time
- Source tracking: which Riksavtalen version the rates come from

Configured via `tariff_rate_table` (planned, see `docs/cascade-spreadsheet-overview.md` Schema Gaps).

---

## 4. Overtime & Timebank

### 4.1 Overtime Detection

Overtime is triggered when hours exceed the threshold from `employment_contract.agreed_weekly_hours`. This field is CRITICAL and currently missing from the schema (see Schema Gaps in `docs/cascade-spreadsheet-overview.md`).

**Detection logic:**
1. Sum all schedule_shift hours for the week (Mon-Sun)
2. Compare against agreed_weekly_hours from employment_contract
3. If over: mark excess hours as overtime
4. Apply correct rate: +50% (day) or +100% (night/holiday)

**AML limits (hard blocks in cascade):**
- Max 10h overtime per 7-day period
- Max 25h overtime per 4-week period
- Max 200h overtime per 52 weeks (extendable to 300h/400h by agreement)

### 4.2 Timebank (TOIL)

- Overtime as time off instead of pay (avspasering)
- Balance tracking with expiry dates
- Employee choice: payout vs. avspasering (configurable per workspace)
- Different rules per employment type (full_time, part_time, temporary, flexible, apprentice)

---

## 5. Absence Pay

> **TODO:** Detailed specification needed

- Sick pay: employer period (16 days) at full pay
- Vacation pay: 12% of previous year's earnings (10.2% for over-60s)
- Parental leave: NAV coverage
- NAV refund tracking for employer

---

## 6. Payroll Calculation Engine

### 6.1 Per-Shift Cost Calculation (real-time)

Every shift gets a cost snapshot at creation/update. This feeds the schedule UI cost column.

```
For each schedule_shift:
  1. Look up employee_payroll_profile → base_hourly_rate, seniority_step
  2. Look up active tariff_rate_table for shift_date
  3. Calculate base cost = work_hours * base_hourly_rate
  4. Calculate supplements:
     - For each hour of the shift, check which supplement windows apply
     - Kveldstillegg: 15.65 kr/t (Mon-Fri 21-24)
     - Nattillegg: 54.76 kr/t (00-06)
     - Helgetillegg: 29.74 kr/t (Sat 14-24, Sun 06-24)
     - Helligdagstillegg: 100% (red days)
  5. Store as shift_cost_snapshot (append-only audit)
```

### 6.2 Monthly Payroll Run Pipeline

```
Shifts (from Module 3, L5 in cascade)
  → Hours per day/supplement window
    → Base pay calculation (from employee_payroll_profile)
      → + Supplements (per tariff_rate_table)
        → + Overtime (detected from agreed_weekly_hours threshold)
          → + Personal supplements (seniority-based monthly amounts)
            → - Absence deductions + absence pay (from Module 7)
              → = Gross salary
                → + Employer costs:
                    Arbeidsgiveravgift (14.1%)
                    Feriepenger (12% / 10.2% for over-60s)
                    OTP Pension (2% minimum)
                → = Total employer cost
```

### 6.3 A-melding Requirements

Monthly reporting to Norwegian tax authorities. Must include:
- Hours worked per employee
- Gross pay breakdown (base + supplements + overtime)
- Employer contributions (arbeidsgiveravgift, feriepenger, OTP)
- Employment type and contract hours
- Absence periods and types

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

### 8.1 Existing tables (used by payroll)

- `employment_contract` — base employment data. MISSING: `agreed_weekly_hours` (critical for overtime)
- `profile` — employee identity. MISSING: `seniority_start_date`, `has_fagbrev`
- `schedule_shift` — completed shifts = hours worked (L5 in cascade)

### 8.2 New tables needed

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `tariff_rate_table` | Versioned Riksavtalen rates | effective_from, effective_until, rate_type, amount, source |
| `employee_payroll_profile` | Links contract to payroll calculation | profile_id, employment_contract_id, tariff_table_id, base_hourly_rate, seniority_step |
| `shift_cost_snapshot` | Append-only per-shift cost audit | schedule_shift_id, base_cost, supplements_json, total_cost, calculated_at |
| `payroll_run` | Monthly run with status | workspace_id, period_start, period_end, status (draft/calculating/review/finalized) |
| `payroll_line` | Individual line items per employee per run | payroll_run_id, profile_id, line_type, hours, rate, amount |
| `timebank_balance` | TOIL balance per employee | profile_id, balance_hours, last_updated |

### 8.3 Expected enums

- `RateType`: fixed | hourly | multiplier | percentage | calculated
- `SalaryCategory`: base_pay | overtime | supplement | absence | deductions
- `SalaryType`: hourly | monthly
- `EmploymentCategory`: full_time | part_time | temporary | flexible | apprentice

Full schema gap list: `docs/cascade-spreadsheet-overview.md` (Schema Gaps section)

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

_Remaining work: complete calculation algorithms, Norwegian tax edge cases (graded sick leave payroll, holiday pay for variable hours), payroll UI screens, A-melding export format. The supplement rates and tariff structure above are verified and locked._
