-- 20260527100300_payroll_phase1_time_banks.sql
-- T1.3 — Bredde-ALTER payroll.timebank_entry: account_type, value_amount, value_unit.
--
-- Existing table has `hours` column (hours-only). Phase 1 requires:
--   - account_type: discriminator for vacation_pay (NOK) vs toil (hours) vs wellness (days)
--   - value_amount: replaces `hours` for monetary accounts (vacation_pay NOK)
--   - value_unit: 'hours' | 'nok' | 'days'
--
-- Strategy (O26 resolution — bredde-ALTER, not split-tables):
--   ADD account_type + value_amount + value_unit with safe defaults.
--   Existing rows default to account_type='toil', value_unit='hours',
--   value_amount = hours (coerced from existing column).
--   `hours` column RETAINED for backward compat during Phase 1 — deprecated in Phase 2.
--
-- Source authority: TIME-BANKS.md §8, O26 resolution, SORTIE-PHASE-1.md T1.3.

SET search_path TO payroll, public, extensions;

-- Step 1: Add account_type column
-- Checked TEXT (not a PG enum) to avoid enum migration complexity mid-sortie.
-- Values enforced by CHECK constraint — upgradeable to enum in Phase 2.
ALTER TABLE payroll.timebank_entry
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'toil'
    CHECK (account_type IN ('vacation_pay', 'toil', 'wellness'));

-- Step 2: Add value_amount column
-- For vacation_pay: NOK amount. For toil: hours (mirrors `hours` column).
-- For wellness: days count.
-- Default: 0 (safe sentinel). Backfill from `hours` in Step 4.
-- Seed.sql data may omit value_amount — default prevents NOT NULL violation at seed time.
ALTER TABLE payroll.timebank_entry
  ADD COLUMN IF NOT EXISTS value_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Step 3: Add value_unit column
ALTER TABLE payroll.timebank_entry
  ADD COLUMN IF NOT EXISTS value_unit TEXT NOT NULL DEFAULT 'hours'
    CHECK (value_unit IN ('hours', 'nok', 'days'));

-- Step 4: Backfill value_amount from existing hours column for toil rows.
-- Existing rows are all toil (pre-Phase-1 data had no other account type).
UPDATE payroll.timebank_entry
  SET value_amount = hours,
      value_unit   = 'hours',
      account_type = 'toil'
  WHERE value_amount IS NULL;

-- Step 5: value_amount already NOT NULL (set in Step 2 with default 0).
-- Note: seed.sql inserts will use default=0 for value_amount if not supplied.
-- Phase 2 trigger can mirror from `hours` on new inserts.

-- Step 6: Also add overtime_mode and toil_agreement fields to employee_payroll_profile.
-- These live in public schema but are payroll-domain additions.
-- Type: payroll_overtime_mode — create only if it doesn't exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'payroll_overtime_mode'
  ) THEN
    CREATE TYPE public.payroll_overtime_mode AS ENUM ('paid_out', 'banked');
  END IF;
END $$;

ALTER TABLE public.employee_payroll_profile
  ADD COLUMN IF NOT EXISTS overtime_mode        public.payroll_overtime_mode NOT NULL DEFAULT 'paid_out',
  ADD COLUMN IF NOT EXISTS toil_agreement_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS toil_max_banked_hours    NUMERIC(5,2);
  -- toil_max_banked_hours: NULL = use workspace_settings.toil_default_max_banked_hours

COMMENT ON COLUMN payroll.timebank_entry.account_type IS
  'vacation_pay = NOK holiday allowance accrual (value_unit=nok). '
  'toil = Time-Off-In-Lieu hours banked from overtime (value_unit=hours). '
  'wellness = wellness days (value_unit=days). TIME-BANKS.md §1.';

COMMENT ON COLUMN payroll.timebank_entry.value_amount IS
  'Monetary amount (NOK) for vacation_pay; hours for toil; days for wellness. '
  'Sign convention: positive = accrual/credit, negative = withdrawal/debit. '
  'entry_type discriminates (accrual | withdrawal | adjustment | expiry | carry_over | payout).';

COMMENT ON COLUMN payroll.timebank_entry.value_unit IS
  'Unit of value_amount. hours for toil; nok for vacation_pay; days for wellness. '
  'Deprecated `hours` column remains for Phase 1 backward compat.';

COMMENT ON COLUMN public.employee_payroll_profile.overtime_mode IS
  'paid_out = OT hours paid on lønnsslipp. banked = OT hours added to TOIL. '
  'OT-tillegg (50%/100%) ALWAYS paid out per Aml. §10-6 tolvte ledd regardless of mode. '
  'Switching to banked requires toil_agreement_signed_at NOT NULL. TIME-BANKS.md §2.';

COMMENT ON COLUMN public.employee_payroll_profile.toil_agreement_signed_at IS
  'Timestamp when TOIL written agreement was signed (§10-6 tolvte ledd requirement). '
  'Calc engine blocks banked-mode accrual until this is set. NULL = agreement pending.';
