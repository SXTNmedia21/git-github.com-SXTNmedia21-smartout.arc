-- 20260527101300_payroll_phase1_timebank_backfill_repair.sql
-- FIX-4 (IMPORTANT): Repair always-false backfill in time-banks migration.
--
-- Problem: 20260527100300_payroll_phase1_time_banks.sql:Step4 has:
--   UPDATE payroll.timebank_entry SET value_amount = hours, ...
--   WHERE value_amount IS NULL;
-- But value_amount was added with DEFAULT 0 NOT NULL in Step 2 — the column is
-- NEVER NULL post-migration. WHERE clause matches zero rows.
-- On production with existing rows, hours data is lost (value_amount stays 0).
--
-- Fix: Unconditional backfill targeting rows where:
--   - hours carries actual data (IS NOT NULL AND <> 0)
--   - value_amount is still the default sentinel (= 0)
--   - value_unit is consistent with hours-based toil
-- Also: set account_type for legacy rows that have hours but NULL account_type.
--
-- Idempotent: WHERE value_amount = 0 means re-running after a manual fix is safe
-- (already-corrected rows with value_amount <> 0 are not touched).
--
-- Source authority: SORTIE-PHASE-1.md T1.3, TIME-BANKS.md §8, ADR-0254.

SET search_path TO payroll, public, extensions;

-- ─── Repair backfill: hours → value_amount for existing toil rows ─────────────
UPDATE payroll.timebank_entry
SET value_amount = hours,
    value_unit   = 'hours'
WHERE hours IS NOT NULL
  AND hours <> 0
  AND value_amount = 0
  AND (value_unit IS NULL OR value_unit = 'hours');

-- ─── Backfill account_type for legacy rows missing it ────────────────────────
-- Pre-Phase-1 rows had no account_type; all were time-off-in-lieu (TOIL).
UPDATE payroll.timebank_entry
SET account_type = 'toil'
WHERE account_type IS NULL
  AND hours IS NOT NULL;

COMMENT ON COLUMN payroll.timebank_entry.value_amount IS
  'Monetary amount (NOK) for vacation_pay; hours for toil; days for wellness. '
  'Sign convention: positive = accrual/credit, negative = withdrawal/debit. '
  'entry_type discriminates (accrual | withdrawal | adjustment | expiry | carry_over | payout). '
  'Backfilled from `hours` column by repair migration 20260527101300 '
  '(original backfill in 20260527100300 had always-false WHERE value_amount IS NULL).';
