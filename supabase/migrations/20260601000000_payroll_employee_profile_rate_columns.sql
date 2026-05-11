-- 20260601000000_payroll_employee_profile_rate_columns.sql
--
-- Add rate columns to employee_payroll_profile.
--
-- Council 2026-05-10 PM verdict (SMA-344): salary_query Botsson tool reads
-- monthly_salary/hourly_rate/remuneration_type/currency from
-- employee_payroll_profile but none exist there. Tool crashes on first call.
-- snapshot-period-costs/route.ts:403 hardcodes baseHourlyRateNok = 0.
--
-- This migration adds the 4 columns. Sync trigger update + backfill follow
-- in 20260601000100 + 20260601000300.
--
-- Note on remuneration_type: employee_payroll_profile uses a simpler
-- TEXT CHECK (hourly/monthly/mixed) rather than the remuneration_type_enum
-- used on employment_contract (monthlyWage/hourlyWage/commissionOnly).
-- Mapping lives in the sync trigger (20260601000100) and backfill (20260601000300).

ALTER TABLE public.employee_payroll_profile
  ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS remuneration_type TEXT
    CHECK (remuneration_type IN ('hourly', 'monthly', 'mixed')),
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NOK';

COMMENT ON COLUMN public.employee_payroll_profile.hourly_rate IS
  'Per-employee custom hourly rate (NOK). Override of tariff_rate_table lookup. NULL = use tariff fallback.';

COMMENT ON COLUMN public.employee_payroll_profile.monthly_salary IS
  'Per-employee monthly salary (NOK). Used when remuneration_type=monthly.';

COMMENT ON COLUMN public.employee_payroll_profile.remuneration_type IS
  'How the employee is paid: hourly (per-hour rate), monthly (fixed salary), or mixed. '
  'Maps from employment_contract.remuneration_type_enum: hourlyWage→hourly, monthlyWage→monthly, commissionOnly→mixed.';

COMMENT ON COLUMN public.employee_payroll_profile.currency IS
  'ISO 4217 currency code. Always NOK for Norwegian operations (default).';
