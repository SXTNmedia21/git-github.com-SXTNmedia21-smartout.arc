-- Migration: payroll_phase1_snapshot_cost_columns
-- T4.1: Extend public.shift_cost_snapshot with payroll-pipeline columns.
--
-- The payroll calc-engine (BFF orchestrators) writes per-profile, per-period
-- cost snapshots. The existing shift_cost_snapshot table (Cascade C3 origin)
-- gets payroll-specific columns so both Cascade and Payroll paths share the
-- same append-only audit row.
--
-- New columns:
--   payroll_period_id  — FK to payroll.period (nullable for non-payroll snaps)
--   shift_id           — alias for schedule_shift_id (engine uses this name)
--   base_amount        — base pay in NOK (oreToNok boundary conversion)
--   supplement_amount  — total supplements in NOK
--   total_amount       — grand total in NOK
--   currency           — ISO currency code, default 'NOK'
--   pay_rule_ids       — JSONB array of supplement_rule.id values that fired
--   session_date       — date string "YYYY-MM-DD" for the shift
--
-- ADR-0252: snapshot is append-only; re-calc writes a new row.
-- ADR-0057: payroll schema separation; public table extended, not moved.

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS payroll_period_id UUID
    REFERENCES payroll.period(id) ON DELETE SET NULL;

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS shift_id UUID
    REFERENCES public.schedule_shift(schedule_shift_id);

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS base_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS supplement_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS total_amount   NUMERIC(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS currency       TEXT NOT NULL DEFAULT 'NOK';

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS pay_rule_ids   JSONB NOT NULL DEFAULT '[]';

ALTER TABLE public.shift_cost_snapshot
  ADD COLUMN IF NOT EXISTS session_date   TEXT;

-- Index for payroll period lookups.
CREATE INDEX IF NOT EXISTS idx_shift_cost_snapshot_payroll_period
  ON public.shift_cost_snapshot (payroll_period_id)
  WHERE payroll_period_id IS NOT NULL;

-- Index for shift_id lookups (the payroll engine queries by shift_id).
CREATE INDEX IF NOT EXISTS idx_shift_cost_snapshot_shift_id
  ON public.shift_cost_snapshot (shift_id)
  WHERE shift_id IS NOT NULL;

COMMENT ON COLUMN public.shift_cost_snapshot.payroll_period_id IS
  'FK to payroll.period. Populated by payroll snapshot-period-costs orchestrator.';
COMMENT ON COLUMN public.shift_cost_snapshot.shift_id IS
  'Redundant alias for schedule_shift_id used by the payroll engine layer.';
COMMENT ON COLUMN public.shift_cost_snapshot.base_amount IS
  'Base pay in NOK (hourly × worked_minutes). Set by payroll orchestrator.';
COMMENT ON COLUMN public.shift_cost_snapshot.supplement_amount IS
  'Total supplement pay in NOK. Set by payroll orchestrator.';
COMMENT ON COLUMN public.shift_cost_snapshot.total_amount IS
  'Grand total pay in NOK = base + supplements. Set by payroll orchestrator.';
COMMENT ON COLUMN public.shift_cost_snapshot.pay_rule_ids IS
  'JSONB array of supplement_rule.id values that fired for this snapshot.';
COMMENT ON COLUMN public.shift_cost_snapshot.session_date IS
  'Shift date "YYYY-MM-DD" for period-group queries.';
