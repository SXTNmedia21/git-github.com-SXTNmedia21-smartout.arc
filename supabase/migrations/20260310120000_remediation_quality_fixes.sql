SET search_path TO public, extensions;

-- ============================================
-- 20260310120000_remediation_quality_fixes.sql
-- Remediation migration: fixes quality issues across recent tables.
--
-- Fixes:
--   C2: UNIQUE constraint on shift_approval(reconciliation_id, shift_id)
--   C3: Missing created_at/updated_at on schedule_template_shift
--   C4: Missing updated_at on settlement_validation
--   C5: Missing set_updated_at() triggers on 6 tables
--   S1: Missing indexes on shift_approval
--   S2: Missing updated_at on settlement_image
--   S3: Missing updated_at on engine_step, engine_trigger, engine_delayed_trigger
--
-- All statements are idempotent — safe to run on any state.
-- Source: Migration Startup Plan §3-4
-- ============================================

-- ══════════════════════════════════════════════
-- C2: UNIQUE constraint — prevent duplicate shift approvals
-- ══════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_shift_approval_recon_shift'
  ) THEN
    ALTER TABLE public.shift_approval
      ADD CONSTRAINT uq_shift_approval_recon_shift UNIQUE (reconciliation_id, shift_id);
  END IF;
END $$;

-- ══════════════════════════════════════════════
-- C3: schedule_template_shift — add missing timestamps
-- ══════════════════════════════════════════════
ALTER TABLE public.schedule_template_shift
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE TRIGGER set_schedule_template_shift_updated_at
  BEFORE UPDATE ON public.schedule_template_shift
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════
-- C4: settlement_validation — add missing updated_at
-- ══════════════════════════════════════════════
ALTER TABLE public.settlement_validation
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE TRIGGER set_settlement_validation_updated_at
  BEFORE UPDATE ON public.settlement_validation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════
-- S2: settlement_image — add missing updated_at
-- ══════════════════════════════════════════════
ALTER TABLE public.settlement_image
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE TRIGGER set_settlement_image_updated_at
  BEFORE UPDATE ON public.settlement_image
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════
-- S3: engine tables — add missing updated_at columns
-- (engine_event is an immutable log — intentionally no updated_at)
-- ══════════════════════════════════════════════
ALTER TABLE public.engine_step
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE TRIGGER set_engine_step_updated_at
  BEFORE UPDATE ON public.engine_step
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.engine_trigger
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE TRIGGER set_engine_trigger_updated_at
  BEFORE UPDATE ON public.engine_trigger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.engine_delayed_trigger
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE TRIGGER set_engine_delayed_trigger_updated_at
  BEFORE UPDATE ON public.engine_delayed_trigger
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════
-- C5: Missing set_updated_at() triggers on tables that HAVE updated_at
-- ══════════════════════════════════════════════

-- department_session (has updated_at, no trigger)
CREATE OR REPLACE TRIGGER set_department_session_updated_at
  BEFORE UPDATE ON public.department_session
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- daily_reconciliation (has updated_at, no trigger)
CREATE OR REPLACE TRIGGER set_daily_reconciliation_updated_at
  BEFORE UPDATE ON public.daily_reconciliation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- deviation (has updated_at, no trigger)
CREATE OR REPLACE TRIGGER set_deviation_updated_at
  BEFORE UPDATE ON public.deviation
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- shift_approval (has updated_at, no trigger)
CREATE OR REPLACE TRIGGER set_shift_approval_updated_at
  BEFORE UPDATE ON public.shift_approval
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- engine_process (has updated_at, no trigger)
CREATE OR REPLACE TRIGGER set_engine_process_updated_at
  BEFORE UPDATE ON public.engine_process
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- engine_state (has updated_at, no trigger)
CREATE OR REPLACE TRIGGER set_engine_state_updated_at
  BEFORE UPDATE ON public.engine_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ══════════════════════════════════════════════
-- S1: shift_approval — missing indexes
-- ══════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_shift_approval_shift
  ON public.shift_approval (shift_id);

CREATE INDEX IF NOT EXISTS idx_shift_approval_workspace_status
  ON public.shift_approval (workspace_id, status)
  WHERE status IN ('pending', 'edited');
