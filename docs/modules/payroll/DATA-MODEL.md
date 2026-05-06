---
title: Payroll Data Model
status: draft
updated: 2026-05-06
created: 2026-05-06
module: payroll
tags: [payroll, schema, data-model, payroll-namespace, cascade]
---

# Payroll Data Model

> 23 tables in `payroll.*` namespace + 5 cross-cutting tables in `public.*`. All schema is Phase 0a — DONE. Migrations: `supabase/migrations/20260422110*` + `20260422110700` + `20260515100500` + `20260428220004`.

## 1. Schema Layout

```
payroll.* (dedicated namespace, ADR-0057)
├── Config (set up workspace once)
│   ├── payroll_workspace_settings        — period type, AGA%, vacation%, pension%, default codes
│   ├── payroll_employee_group            — group of employees with shared default rate
│   ├── payroll_employee_group_member     — per-employee membership w/ rate history (valid_from/until)
│   ├── payroll_shift_type                — per-shift-type rate adjustments (e.g. evening, weekend)
│   ├── payroll_salary_code               — code, category, a_melding_code, accounting_account_code
│   ├── payroll_holiday_calendar          — header
│   ├── payroll_holiday_entry             — per-holiday rows
│   ├── payroll_supplement_rule           — 6 supplement types (normal/week/day/manual/holiday/contract)
│   ├── payroll_break_rule                — auto-applied break logic (after_duration / time_of_day)
│   ├── payroll_meal_rule                 — meal deduction or contribution
│   └── payroll_working_time_rule         — AML compliance rules (W01–W12)
├── Calculation (per-period output, append-only)
│   ├── payroll_period                    — period state machine (open → locked → approved → exported)
│   ├── payroll_calculation               — per-shift result, append-only (newest calculated_at wins)
│   ├── payroll_calculation_line          — per-line items (worked, OT, supplement, deduction)
│   ├── payroll_deviation                 — error/warn/info flags (severity gates approval)
│   └── payroll_manual_supplement         — admin-added per-shift adjustments (tips, bonuses)
├── Export
│   ├── payroll_export_event              — one row per export attempt (format: csv/pdf/amelding/tripletex_api)
│   └── payroll_export_line               — per-line sync status (pending/synced/failed) + external_code
└── Absence
    ├── absence_type                      — sick_leave, parental_leave, vacation, etc.
    ├── absence_quota                     — yearly quota per employee per type
    ├── absence_ledger                    — per-day debit/credit
    ├── absence_balance                   — derived view
    ├── absence_request                   — employee requests
    └── absence_decision                  — manager approval

public.* (cross-cutting — read-only from payroll's perspective)
├── employee_payroll_profile              — tariff_override_id, salary_type, contract_hours_weekly, holiday%, tax_card_*
├── employment_contract                   — hourly_rate, monthly_salary, employment_percentage, contract_status
├── employment_contract_detail            — append-only versioning per effective_date (Tripletex-canonical fields)
├── tariff_rate_table                     — Riksavtalen seed (NULL workspace_id = platform) + workspace overrides
├── framework_rule                        — AML §10-* rules, GATE/CONSTRAINT severity
├── public_holiday                        — Norwegian helligdager
├── shift_hour_interpretation             — derivation layer 3 (regular/OT/night/holiday/weekend)
├── shift_cost_snapshot                   — derivation layer 4 (tariff frozen as JSONB, base+supplement+deduction)
├── shift_pay_calculation_event           — ADR-0251 audit (5-yr retention, immutable, supersession-chain)
├── tip_pool                              — campaign-scoped tip distribution
├── tip_distribution                      — per-employee tip allocation
└── payroll_ledger_archive                — Bubble historical (17,607 rows, read-only, raw_json)
```

## 2. Core Lifecycle Tables

### 2.1 `payroll.period`

State machine container. One row per workspace per period.

```sql
-- Migration: 20260422110200
-- Columns:
period_id          UUID PK
workspace_id       UUID NOT NULL
period_type        ENUM(monthly, biweekly, weekly)
start_date         DATE NOT NULL
end_date           DATE NOT NULL
status             ENUM payroll_period_status DEFAULT 'open'
                     -- open → locked → approved → exported
locked_by          UUID
locked_at          TIMESTAMPTZ
approved_by        UUID
approved_at        TIMESTAMPTZ
exported_at        TIMESTAMPTZ
created_at         TIMESTAMPTZ DEFAULT now()
updated_at         TIMESTAMPTZ DEFAULT now()

UNIQUE(workspace_id, start_date, end_date)
INDEX (workspace_id, status)
INDEX (workspace_id, end_date)
```

**Transitions:**
- `open → locked`: `lock_period` capability tool. `acknowledged severity=error deviations` precondition.
- `locked → approved`: `approve_period` tool. `min_role=admin`, optional four-eyes.
- `approved → exported`: automated on first successful export to A-melding or Tripletex.
- `* → open`: NEVER. Re-open via new corrective period.

### 2.2 `payroll.calculation`

Per-shift, append-only. Newest `calculated_at` wins.

```sql
-- Migration: 20260422110200
calculation_id          UUID PK
workspace_id            UUID NOT NULL
period_id               UUID NOT NULL FK payroll.period
profile_id              UUID NOT NULL
schedule_shift_id       UUID FK public.schedule_shift (nullable for manual entries)
employee_group_id       UUID FK payroll.employee_group
shift_type_id           UUID FK payroll.shift_type
scheduled_start         TIMESTAMPTZ
scheduled_end           TIMESTAMPTZ
actual_start            TIMESTAMPTZ
actual_end              TIMESTAMPTZ
gross_minutes           INT
break_minutes_paid      INT
break_minutes_unpaid    INT
net_working_minutes     INT
base_rate               NUMERIC(8,2)
base_pay                NUMERIC(10,2)
total_supplements       NUMERIC(10,2)
total_deductions        NUMERIC(10,2)
total_pay               NUMERIC(10,2)
calculated_at           TIMESTAMPTZ DEFAULT now()
calculated_by           UUID  -- system or user
calculation_version     INT NOT NULL  -- per (shift, period)
provenance              JSONB  -- which rules + tariff version applied

INDEX (period_id, profile_id, calculated_at DESC)
INDEX (schedule_shift_id, calculation_version DESC)
```

### 2.3 `payroll.calculation_line`

Per-item rows that sum into `payroll_calculation.total_pay`.

```sql
line_id              UUID PK
calculation_id       UUID NOT NULL FK payroll.calculation
salary_code          TEXT NOT NULL FK payroll.salary_code(code)
line_type            ENUM(worked_hours, supplement, overtime, absence, deduction, monthly_salary, manual_adj)
hours                NUMERIC(5,2)
rate                 NUMERIC(8,2)
amount               NUMERIC(10,2) NOT NULL
description          TEXT
metadata             JSONB

INDEX (calculation_id, line_type)
INDEX (calculation_id, salary_code)
```

### 2.4 `payroll.deviation`

Validation flags. Severity gates approval.

```sql
deviation_id         UUID PK
workspace_id         UUID NOT NULL
period_id            UUID FK
calculation_id       UUID FK
profile_id           UUID
schedule_shift_id    UUID FK public.schedule_shift (nullable)
check_id             TEXT NOT NULL  -- e.g. W01, W02, P10, C03
severity             ENUM(error, warning, info)
message              TEXT NOT NULL
details              JSONB
acknowledged_by      UUID
acknowledged_at      TIMESTAMPTZ
resolution           TEXT
created_at           TIMESTAMPTZ DEFAULT now()

INDEX (period_id, severity, acknowledged_by)
```

**Approval gate:**
```sql
-- pseudocode for approve_period precondition
IF EXISTS (
  SELECT 1 FROM payroll.deviation
  WHERE period_id = $1 AND severity = 'error' AND acknowledged_by IS NULL
) THEN BLOCK
```

### 2.5 `payroll.manual_supplement`

Admin-added per-shift adjustment. Recalc-trigger on insert/update.

```sql
supplement_id        UUID PK
workspace_id         UUID NOT NULL
profile_id           UUID NOT NULL
period_id            UUID FK payroll.period
schedule_shift_id    UUID FK public.schedule_shift
salary_code          TEXT NOT NULL FK payroll.salary_code(code)
amount               NUMERIC(10,2)
hours                NUMERIC(5,2)
reason               TEXT NOT NULL
created_by           UUID NOT NULL  -- admin who added
created_at           TIMESTAMPTZ DEFAULT now()
```

### 2.6 `payroll.export_event` + `payroll.export_line`

```sql
-- export_event
export_event_id      UUID PK
period_id            UUID NOT NULL FK
format               ENUM(csv, pdf, amelding, tripletex_api, excel)
status               ENUM(pending, processing, completed, failed)
initiated_by         UUID NOT NULL
initiated_at         TIMESTAMPTZ DEFAULT now()
completed_at         TIMESTAMPTZ
error_message        TEXT
artifact_url         TEXT  -- signed URL to Storage bucket if applicable
metadata             JSONB

-- export_line (one per calculation_line per export)
export_line_id       UUID PK
export_event_id      UUID NOT NULL FK
line_id              UUID NOT NULL FK payroll.calculation_line
external_id          TEXT  -- Tripletex transactionId, A-melding fnr+linje-ref
external_code        TEXT  -- Tripletex SalaryType id, A-melding inntektstype-kode
sync_status          ENUM(pending, synced, failed, skipped)
synced_at            TIMESTAMPTZ
error_detail         JSONB
```

---

## 3. Cross-Cutting Tables (Read by Payroll)

### 3.1 `public.employee_payroll_profile`

```sql
profile_id                  UUID NOT NULL FK public.profile
workspace_id                UUID NOT NULL
employment_contract_id      UUID FK
salary_type                 ENUM(hourly, monthly, per_shift)
contract_hours_weekly       NUMERIC(4,1)
hourly_rate                 NUMERIC(8,2)
monthly_salary              NUMERIC(10,2)
holiday_allowance_pct       NUMERIC(4,2) CHECK (10.20 <= value <= 20.00)
otp_pct                     NUMERIC(4,2) DEFAULT 2.00
tariff_override_id          UUID FK public.tariff_rate_table  -- workspace-specific override
tax_table_number            TEXT  -- Skatteetaten DERIVED
tax_card_type               ENUM(tabelltrekk, prosenttrekk, frikort)
tax_percentage              NUMERIC(5,2)  -- if prosenttrekk
tax_card_year               INT
tax_card_fetched_at         TIMESTAMPTZ
personal_number             TEXT  -- HØY PII, RevealableField
bank_account_number         TEXT  -- HØY PII
valid_from                  DATE
valid_until                 DATE  -- nullable; current = NULL

EXCLUDE USING gist (profile_id WITH =, workspace_id WITH =, daterange(valid_from, valid_until, '[)') WITH &&)
```

### 3.2 `public.tariff_rate_table`

Riksavtalen seed.

```sql
tariff_rate_id        UUID PK
workspace_id          UUID  -- NULL = platform-level (Riksavtalen)
rate_type             TEXT NOT NULL
                        -- e.g. 'kveldstillegg', 'helgetillegg', 'overtidstillegg_50',
                        -- 'minstelonn_ufaglart', 'otp_arbeidsgiver'
source                ENUM(riksavtalen, allmenngjoring, internal)
amount                NUMERIC(10,2) NOT NULL
unit                  TEXT NOT NULL  -- 'kr/t' or 'percent'
effective_from        DATE NOT NULL
effective_until       DATE  -- nullable; current = NULL
seniority_years       INT
metadata              JSONB
provenance            JSONB

EXCLUDE USING gist (
  rate_type WITH =,
  COALESCE(workspace_id, '00000000-...'::uuid) WITH =,
  daterange(effective_from, effective_until, '[)') WITH &&
)
```

**Lookup pattern:**
```sql
-- Resolve rate at point-in-time, workspace-override-first
SELECT * FROM public.tariff_rate_table
WHERE rate_type = $1
  AND (workspace_id = $2 OR workspace_id IS NULL)
  AND $3 BETWEEN effective_from AND COALESCE(effective_until, '9999-12-31'::date)
ORDER BY (workspace_id IS NOT NULL) DESC  -- workspace wins
LIMIT 1
```

### 3.3 `public.framework_rule`

AML compliance rules (W01–W12 codes). Seeded by `20260424100000`.

```sql
rule_id           UUID PK
workspace_id      UUID  -- NULL = platform
rule_code         TEXT NOT NULL  -- e.g. 'aml.max_overtime_week'
rule_kind         ENUM(GATE, CONSTRAINT, INFORMATIONAL)
severity          ENUM(error, warning, info)
threshold_value   JSONB  -- e.g. {hours: 10, period: 'week'}
paragraf_ref      TEXT NOT NULL  -- 'AML §10-6 fjerde ledd'
description       TEXT
effective_from    DATE
effective_until   DATE
```

### 3.4 `public.shift_hour_interpretation` (Layer 3)

```sql
interpretation_id      UUID PK
schedule_shift_id      UUID NOT NULL FK
time_entry_ids         UUID[]  -- which reality rows consumed
framework_rule_ids     UUID[]  -- which rules applied
regular_hours          NUMERIC(5,2)
overtime_hours         NUMERIC(5,2)
night_hours            NUMERIC(5,2)
holiday_hours          NUMERIC(5,2)
weekend_hours          NUMERIC(5,2)
break_deductions       NUMERIC(5,2)
total_interpreted_hours NUMERIC(5,2)
derivation_version     INT NOT NULL  -- append-only per shift
derived_at             TIMESTAMPTZ
derived_by             TEXT  -- 'derive_shift_hours v1.2'

UNIQUE(schedule_shift_id, derivation_version)
RLS: UPDATE/DELETE blocked
```

### 3.5 `public.shift_cost_snapshot` (Layer 4)

```sql
snapshot_id              UUID PK
schedule_shift_id        UUID NOT NULL FK
interpretation_id        UUID NOT NULL FK shift_hour_interpretation
payroll_profile_id       UUID NOT NULL FK employee_payroll_profile
tariff_rate_snapshot     JSONB NOT NULL  -- frozen tariff rows applied
base_hours               NUMERIC(5,2)
base_rate                NUMERIC(8,2)
base_cost                NUMERIC(10,2)
regular_cost             NUMERIC(10,2)
night_cost               NUMERIC(10,2)
holiday_cost             NUMERIC(10,2)
weekend_cost             NUMERIC(10,2)
total_supplements        NUMERIC(10,2)
total_deductions         NUMERIC(10,2)
gross_cost               NUMERIC(10,2)
total_cost               NUMERIC(10,2)
calculation_version      INT NOT NULL

UNIQUE(schedule_shift_id, calculation_version)
```

### 3.6 `public.shift_pay_calculation_event` (ADR-0251 Audit)

Append-only with supersession-chain. 5-year retention from `shift_period_end_date`.

```sql
event_id                UUID PK
workspace_id            UUID NOT NULL
profile_id              UUID NOT NULL
schedule_shift_id       UUID NOT NULL FK
shift_period_end_date   DATE NOT NULL  -- retention anchor
rule_type               TEXT NOT NULL  -- 'kveldstillegg', 'overtidstillegg_50', etc.
rate_value_applied      NUMERIC(10,2) NOT NULL  -- snapshotted, immutable
quantity_value          NUMERIC(8,2) NOT NULL  -- hours or units
subtotal                NUMERIC(10,2) NOT NULL
provenance              JSONB NOT NULL
                          -- {
                          --   tariff_rate_id, tariff_version,
                          --   framework_rule_ids, source_text_applied,
                          --   triggered_by_event, derivation_version
                          -- }
source_text_applied     TEXT  -- e.g. 'Riksavtalen §6 (2024-versjon, gyldig fra 2024-04-01)'
superseded_by_event_id  UUID FK shift_pay_calculation_event
created_at              TIMESTAMPTZ DEFAULT now()
created_by              UUID

INDEX (profile_id, schedule_shift_id)
INDEX (shift_period_end_date)
INDEX (schedule_shift_id) WHERE superseded_by_event_id IS NULL
INDEX (workspace_id)

RLS:
  no_delete_shift_pay_calc: USING (false)  -- never delete
  no_update_shift_pay_calc: USING (false)  -- service_role-only for supersession
```

### 3.7 `public.payroll_ledger_archive` (ADR-0110 — read-only)

Bubble historical (17,607 rows, Wrightegaarden + 3 migrated workspaces).

```sql
ledger_id                UUID PK  -- v5 UUID derived from Bubble _id
workspace_id             UUID NOT NULL
profile_id               UUID NOT NULL FK
schedule_shift_id        UUID FK  -- nullable, orphan-tolerant
transaction_date         DATE NOT NULL
hours                    NUMERIC(8,2)
base_salary              NUMERIC(12,2)
total_salary             NUMERIC(12,2)
a_melding_code           TEXT
accounting_account_code  TEXT
raw_json                 JSONB NOT NULL  -- full Bubble record
created_at               TIMESTAMPTZ DEFAULT now()

RLS: INSERT service_role only; UPDATE/DELETE = false
```

---

## 4. Tip Tables (Cross-Cutting)

```sql
public.tip_pool
  pool_id, workspace_id, period_start, period_end, status (calculated/approved/paid),
  algorithm_snapshot JSONB, total_amount, payroll_period_id (set on lock)

public.tip_distribution
  distribution_id, pool_id, profile_id, hours_worked, weight_applied,
  calculated_amount, adjusted_amount, adjustment_reason, status (calculated/approved/paid),
  payroll_period_id, paid_at
```

---

## 5. Enums (in payroll schema + cross-cutting)

> Verified against `database.types.ts` 2026-05-06. Enum names use clean naming (no `payroll_` prefix).

```
payroll.wage_type                  = (hourly, per_shift, monthly)
payroll.rate_adjustment_type       = (none, replace, add, percentage)
payroll.salary_code_category       = (worked_hours, supplement, overtime, absence, deduction, monthly_salary)
payroll.supplement_type            = (normal, week_pattern, day_pattern, manual, holiday, contract)
payroll.supplement_rate_type       = (fixed_per_hour, percentage, fixed_per_shift)
payroll.supplement_start_type      = (time_of_day, after_shift_start)
payroll.break_trigger_type         = (after_duration, time_of_day)
payroll.meal_rule_type             = (deduction, contribution)
payroll.period_status              = (open, locked, approved, exported)
payroll.deviation_severity         = (error, warning, info)
payroll.rule_severity              = (block, warn)
payroll.timebank_entry_type        = (accrual, withdrawal, adjustment, expiry, carry_over, payout)
payroll.absence_category           = (...)
payroll.absence_ledger_type        = (debit, credit)
payroll.sick_leave_grade           = (...)
payroll.custom_rate_type           = (per_hour, per_shift)
public.tariff_source               = (riksavtalen, allmenngjoring, internal)
public.shift_status                = (created, assigned, published, active, completed, unpublished)
```

**Verified discrepancies fixed (cascade-audit 2026-05-06):**
- `rule_severity` values are `(block, warn)` — NOT `(warn, error)`
- All enum names previously prefixed `payroll_*` are clean (e.g. `wage_type`, not `payroll_wage_type`)
- `timebank_entry_type` is the discriminator on `payroll.timebank_entry`

---

## 6. RLS Highlights

- All `payroll.*` tables: `workspace_id` filter via `get_workspace_ids_for_user()`. INSERT/UPDATE require `is_admin_in_workspace()`.
- `payroll_ledger_archive`: SELECT for workspace member, INSERT service_role only, UPDATE/DELETE = false.
- `shift_pay_calculation_event`: SELECT workspace member, INSERT service_role only, UPDATE/DELETE = false (supersession via service-role only).
- `employee_payroll_profile.personal_number` + `bank_account_number`: column-level access via RevealableField pattern (Phase 0c+ work). Audit-emit on each reveal.
- All payroll mutations also gate via `gate_action` RPC at app layer per ADR-0204.

---

## 7. Indexing Strategy

- Period queries: `(period_id, profile_id, calculated_at DESC)` on `payroll_calculation`
- Audit queries: `(profile_id, shift_id)`, `(shift_period_end_date)` on `shift_pay_calculation_event`
- Deviation review: `(period_id, severity, acknowledged_by)` on `payroll_deviation`
- Tariff lookup: btree_gist EXCLUDE handles overlap; backed by btree on `(rate_type, effective_from)`
- Profile validity: btree_gist EXCLUDE on `employee_payroll_profile`

---

## 8. Schema Changes Reserved for Phase 1+

Will add migrations for:

- `payroll.calculation_recalc_trigger` — log table for recalc invocations.
- `change_proposal.proposal_kind` enum gets new value `wage_line_override` and `wage_deduction_claim`.
- `payroll.export_event.format` enum gets value `pdf_payslip` (distinct from generic `pdf`).
- `engine_authority_config` rows for new tools `lock_period`, `approve_period`, `add_manual_supplement`, `override_calculation_line`, `acknowledge_deviation`, `export_period`, `recalculate_period`.

These are documented in [PHASES.md](./PHASES.md) with target migration timestamps.
