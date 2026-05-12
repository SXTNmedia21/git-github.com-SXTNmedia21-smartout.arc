-- 20260602000300_payroll_employee_profile_rate_backfill.sql
--
-- Backfill hourly_rate, monthly_salary, remuneration_type, currency
-- on employee_payroll_profile from latest active employment_contract per profile.
--
-- Handles NULL contract case: rate columns stay NULL → snapshot-period-costs
-- resolver will fall back to tariff lookup (S2b).
--
-- Deviations from plan (schema-verified before writing):
--   1. employment_contract has NO currency column → hardcode 'NOK'.
--   2. employment_contract.remuneration_type is remuneration_type_enum
--      (monthlyWage/hourlyWage/commissionOnly) → mapped to TEXT values.
--   3. Idempotent: WHERE hourly_rate IS NULL (unchanged from plan).

WITH latest_contracts AS (
  SELECT DISTINCT ON (workspace_id, profile_id)
    workspace_id,
    profile_id,
    hourly_rate,
    monthly_salary,
    -- Map remuneration_type_enum → employee_payroll_profile TEXT values
    CASE remuneration_type::text
      WHEN 'hourlyWage'     THEN 'hourly'
      WHEN 'monthlyWage'    THEN 'monthly'
      WHEN 'commissionOnly' THEN 'mixed'
      ELSE NULL
    END AS remuneration_type
  FROM public.employment_contract
  WHERE status IN ('signed', 'active')
  ORDER BY workspace_id, profile_id, signed_at DESC NULLS LAST, created_at DESC
)
UPDATE public.employee_payroll_profile epp
SET
  hourly_rate = lc.hourly_rate,
  monthly_salary = lc.monthly_salary,
  remuneration_type = lc.remuneration_type,
  currency = 'NOK',
  updated_at = NOW()
FROM latest_contracts lc
WHERE epp.workspace_id = lc.workspace_id
  AND epp.profile_id = lc.profile_id
  AND epp.hourly_rate IS NULL;  -- idempotent: only backfill empty rows
