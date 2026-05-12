-- 20260527100900_payroll_phase1_tip_payroll_fk.sql
-- T1.8 — Add FK constraint tip_distribution.payroll_period_id → payroll.period(id).
--
-- Column already exists (added in 20260428220004_tips_distribution_table.sql, line 22)
-- as a bare UUID column with no FK constraint. This migration adds the FK.
--
-- Two-step for rollback safety on production-like data (O38 resolution):
--   Step 1 — ADD CONSTRAINT ... NOT VALID (non-blocking, skips existing rows)
--   Step 2 — VALIDATE CONSTRAINT (validates existing rows, can be paused if needed)
--
-- Target: payroll.period (renamed from public.payroll_period in 20260422110700).
-- Source authority: SORTIE-PHASE-1.md T1.8.

SET search_path TO public, extensions;

-- Step 1: Add FK constraint NOT VALID (non-blocking on large tables)
ALTER TABLE public.tip_distribution
  ADD CONSTRAINT fk_tip_distribution_payroll_period
    FOREIGN KEY (payroll_period_id)
    REFERENCES payroll.period(id)
    ON DELETE SET NULL
    NOT VALID;

-- Step 2: Validate existing rows (blocking but can be run separately in production)
ALTER TABLE public.tip_distribution
  VALIDATE CONSTRAINT fk_tip_distribution_payroll_period;

COMMENT ON CONSTRAINT fk_tip_distribution_payroll_period ON public.tip_distribution IS
  'Links tip distribution rows to their payroll period. '
  'ON DELETE SET NULL: tip rows survive period deletion (tip audit must outlive period). '
  'Populated at period-close by lock_period capability tool. ADR-0251.';
