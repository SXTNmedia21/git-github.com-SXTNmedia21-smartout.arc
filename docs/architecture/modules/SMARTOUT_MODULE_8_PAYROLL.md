---
title: "Module 8: Lønn & Økonomi (Payroll & Finance)"
id: MODULE_08
version: "2.0"
status: archived
layer: module
created: 2026-02-24
updated: 2026-05-23
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
> Archived 2026-05-23 — see [payroll domain](../../domains/payroll/).


# Module 8: Lønn & Økonomi (Payroll & Finance)

> **Smartout.ai** — Functional documentation for migration
> Version 2.0 | March 2026
> **Dependencies:** Core Architecture v2 (Profile, Department), Module 3 (Scheduling — shifts/punches), Module 7 (Absence)
> **Status:** IN PROGRESS — fleshed out with AI Council findings 2026-03-21

## Cascade Mapping

> This module's relationship to the Cascade Core Foundation
> (spec: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`)

| Dimension                | Role                                                  |
| ------------------------ | ----------------------------------------------------- |
| D3 Rules & Constraints   | Primary — Riksavtalen/AML rates from framework tables |
| C3 Commercial & Outcome  | Primary — cost model, labor cost attribution          |
| D2 Resource Availability | Consumes — employee contracts, payroll profiles       |
| D6 Production & Product  | Consumes — actual hours worked from shifts            |
| C4 Governance            | Enforces — payroll approval authorization             |

All rates resolved from `tariff_rate_table` via `framework_rule` (D3). Note: `hospitality.ts` rates are WRONG — do not use as source.

**Key principle:** This module READS cost data from `shift_cost_snapshot` (created by the cascade engine). It does not independently compute shift costs. The cascade proposal pipeline owns cost computation; this module owns payroll aggregation and export.

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

All rates, thresholds, and time windows are framework-managed data loaded from `tariff_rate_table` at runtime. They are NOT hardcoded in application code or module documentation. The active regulatory framework (`hospitality.no.default.v1`) seeds these values from the verified source bundle at release time.

### 3.1 Tillegg (supplements)

Supplement types defined by the framework. Each has: amount (kr/t or %), time window, and source layer.

| Supplement     | Norwegian         | Parameter Types                               |
| -------------- | ----------------- | --------------------------------------------- |
| Evening        | Kveldstillegg     | Amount (kr/t), weekday + hour window          |
| Night          | Nattillegg        | Amount (kr/t), hour window                    |
| Weekend        | Helgetillegg      | Amount (kr/t), weekday + hour window          |
| Public holiday | Helligdagstillegg | Rate type (% of base), calendar day reference |

Concrete rates are resolved from `tariff_rate_table` rows with the active framework's `effective_from`/`effective_until` dates. See cascade spec Section 5.3 for framework seed structure.

### 3.2 Overtid (overtime)

Overtime factors are framework-defined with rate multipliers and trigger thresholds:

| Factor                  | Parameter Types                                   |
| ----------------------- | ------------------------------------------------- |
| Standard overtime       | Rate multiplier (%), daily/weekly hour thresholds |
| Unsocial-hours overtime | Rate multiplier (%), applicable time windows      |

Thresholds are AML ordinary-hours baselines (framework-configured, not hardcoded). The active work-time regime resolves actual applicable thresholds per employee context (shift patterns, contract terms, averaging arrangements). See cascade spec Section 5.3 for details.

### 3.3 Ansiennitet wage steps (seniority)

Wages increase with seniority. Rate tables are stored as `tariff_rate_table` rows with `seniority_years` brackets and `source = 'riksavtalen'`. The framework defines brackets per tariff category (e.g., `kokk_fagbrev`, `kokk_uten_fagbrev`, `servitor`).

Fagbrev distinction: employees with/without fagbrev have different tariff categories. Tracked via `employee_payroll_profile.has_fagbrev` and `tariff_category`.

### 3.4 Personal supplements (personlige tillegg)

Personal supplement amounts are resolved from `tariff_rate_table` via `framework_rule` (D3) with seniority bracket lookups. Note: `hospitality.ts` rates are WRONG — do not use as source. The active regulatory framework (`hospitality.no.default.v1`) seeds correct values at release time.

### 3.5 Allmenngjoring

ALL Riksavtalen rates are mandatory for ALL restaurants in Norway. No opt-out. Non-unionized restaurants must pay these minimums.

### 3.6 Tariff Rate Versioning

Rates change annually when new tariff agreements are negotiated. The system must support:

- `tariff_rate_table` with `effective_from` / `effective_until` dates
- Lookup: for a given shift date, find the active tariff version
- Historical accuracy: past shifts use the tariff that was active at the time
- Source tracking: which Riksavtalen version the rates come from

Configured via `tariff_rate_table` (planned, see `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` Schema Gaps).

---

## 4. Overtime & Timebank

### 4.1 Overtime Detection

Overtime is triggered when hours exceed the threshold from `employment_contract.agreed_weekly_hours`. This field is CRITICAL and currently missing from the schema (see Schema Gaps in `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md`).

**Detection logic:**

1. Sum all schedule_shift hours for the week (Mon-Sun)
2. Compare against agreed_weekly_hours from employment_contract
3. If over: mark excess hours as overtime
4. Apply correct rate from `tariff_rate_table` (rate multipliers are framework-loaded, not hardcoded)

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

- Sick pay: employer period and rates resolved from `tariff_rate_table` via `framework_rule` (D3)
- Vacation pay: rate percentages (standard and over-60) resolved from framework tables
- Parental leave: NAV coverage
- NAV refund tracking for employer

---

## 6. Payroll Calculation Engine

### 6.1 Per-Shift Cost Calculation (real-time)

Every shift gets a cost snapshot at creation/update. This feeds the schedule UI cost column.

```
Per-shift cost is computed by the cascade engine (Phase B), NOT by this module.
The cascade engine:
  1. Looks up employee_payroll_profile → tariff_category, seniority bracket
  2. Resolves active tariff_rate_table rows for shift_date (framework-loaded)
  3. Evaluates framework supplement rules against shift hours + time windows
  4. Stores result as shift_cost_snapshot (append-only audit trail)

This module READS shift_cost_snapshot for payroll aggregation. It does not recompute.
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
                → + Employer costs (rates from framework tables):
                    Arbeidsgiveravgift (rate from tariff_rate_table)
                    Feriepenger (rate from tariff_rate_table, age-adjusted)
                    OTP Pension (rate from tariff_rate_table)
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

| Table                      | Purpose                                    | Key Columns                                                                           |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `tariff_rate_table`        | Versioned Riksavtalen rates                | effective_from, effective_until, rate_type, amount, source                            |
| `employee_payroll_profile` | Links contract to payroll calculation      | profile_id, employment_contract_id, tariff_table_id, base_hourly_rate, seniority_step |
| `shift_cost_snapshot`      | Append-only per-shift cost audit           | schedule_shift_id, base_cost, supplements_json, total_cost, calculated_at             |
| `payroll_run`              | Monthly run with status                    | workspace_id, period_start, period_end, status (draft/calculating/review/finalized)   |
| `payroll_line`             | Individual line items per employee per run | payroll_run_id, profile_id, line_type, hours, rate, amount                            |
| `timebank_balance`         | TOIL balance per employee                  | profile_id, balance_hours, last_updated                                               |

### 8.3 Expected enums

- `RateType`: fixed | hourly | multiplier | percentage | calculated
- `SalaryCategory`: base_pay | overtime | supplement | absence | deductions
- `SalaryType`: hourly | monthly
- `EmploymentCategory`: full_time | part_time | temporary | flexible | apprentice

Full schema gap list: `docs/superpowers/specs/2026-03-21-cascade-scheduling-system-design.md` (Schema Gaps section)

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
