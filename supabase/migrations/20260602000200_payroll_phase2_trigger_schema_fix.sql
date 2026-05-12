-- 20260602000200_payroll_phase2_trigger_schema_fix.sql
--
-- Fix Phase 2 recalc-triggers schema mismatch.
--
-- Original migration 20260507110100 referenced public.payroll_manual_supplement
-- but the table actually lives at payroll.manual_supplement (moved in
-- 20260422110700_payroll_schema_move.sql). The entire migration rolled back
-- on first application — ALL THREE triggers (A, B, C) were never installed.
--
-- Pattern B BFF sync-chain (ADR-0293) compensates today, but engine_dispatch
-- handler ship will break without these triggers.
--
-- Trigger A: payroll.manual_supplement (was wrongly: public.payroll_manual_supplement)
-- Trigger B: public.change_proposal (correct in original — reinstalled here)
-- Trigger C: public.tip_distribution (correct in original — reinstalled here)
--
-- All functions preserve the full business logic from 20260507110100.
-- Only Trigger A changes: table reference corrected from public.payroll_manual_supplement
-- → payroll.manual_supplement.

-- Drop any partial installs (idempotent)
-- NOTE: public.payroll_manual_supplement does not exist (table is payroll.manual_supplement).
-- Defensive drop is only on the correct schema; no drop on the old wrong reference needed.
DROP TRIGGER IF EXISTS payroll_manual_supplement_recalc_trg ON payroll.manual_supplement;
DROP TRIGGER IF EXISTS payroll_proposal_applied_trg ON public.change_proposal;
DROP TRIGGER IF EXISTS payroll_tip_distribution_recalc_trg ON public.tip_distribution;
DROP FUNCTION IF EXISTS public.fn_payroll_manual_supplement_recalc() CASCADE;
DROP FUNCTION IF EXISTS public.fn_payroll_proposal_applied() CASCADE;
DROP FUNCTION IF EXISTS public.fn_payroll_tip_distribution_recalc() CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger A — payroll.manual_supplement AFTER INSERT OR DELETE
-- ─────────────────────────────────────────────────────────────────────────────
-- Fires on INSERT (supplement added) and DELETE (supplement removed).
-- Emits engine_event(payroll.recalc_triggered_by_supplement) if the supplement
-- falls within an open payroll period.

CREATE OR REPLACE FUNCTION public.fn_payroll_manual_supplement_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, payroll, extensions
AS $$
DECLARE
  v_period_id   UUID;
  v_workspace_id UUID;
  v_shift_date  DATE;
  v_op          TEXT;
  v_supplement_id UUID;
BEGIN
  -- Determine operation and the row to inspect
  IF TG_OP = 'INSERT' THEN
    v_op             := 'insert';
    v_supplement_id  := NEW.id;
    v_workspace_id   := NEW.workspace_id;
    -- Resolve shift date for period lookup
    SELECT s.shift_date
      INTO v_shift_date
      FROM public.schedule_shift s
     WHERE s.schedule_shift_id = NEW.schedule_shift_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_op             := 'delete';
    v_supplement_id  := OLD.id;
    v_workspace_id   := OLD.workspace_id;
    SELECT s.shift_date
      INTO v_shift_date
      FROM public.schedule_shift s
     WHERE s.schedule_shift_id = OLD.schedule_shift_id;
  END IF;

  -- Guard: shift date must be resolvable
  IF v_shift_date IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Find an open period that spans this shift's date in the same workspace
  SELECT p.id
    INTO v_period_id
    FROM payroll.period p
   WHERE p.workspace_id = v_workspace_id
     AND p.status = 'open'
     AND p.start_date <= v_shift_date
     AND p.end_date   >= v_shift_date
   LIMIT 1;

  -- If no open period covers this shift, no recalc needed
  IF v_period_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Emit engine_event for recalc orchestration
  INSERT INTO public.engine_event (
    event_type,
    payload,
    workspace_id,
    idempotency_key,
    fired_at
  )
  VALUES (
    'payroll.recalc_triggered_by_supplement',
    jsonb_build_object(
      'period_id',      v_period_id,
      'supplement_id',  v_supplement_id,
      'workspace_id',   v_workspace_id,
      'op',             v_op
    ),
    v_workspace_id,
    'payroll.recalc_supplement.' || v_supplement_id::text || '.' || v_op || '.'
      || to_char(now(), 'YYYYMMDDHH24MI'),
    now()
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Install Trigger A on correct schema: payroll.manual_supplement
CREATE TRIGGER payroll_manual_supplement_recalc_trg
  AFTER INSERT OR DELETE ON payroll.manual_supplement
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_payroll_manual_supplement_recalc();

COMMENT ON FUNCTION public.fn_payroll_manual_supplement_recalc() IS
  'Trigger A (Phase 2 T1.2 fix): fires on payroll.manual_supplement INSERT/DELETE. '
  'Emits engine_event(payroll.recalc_triggered_by_supplement) if the supplement '
  'falls within an open payroll period. Fixed from 20260507110100 which referenced '
  'public.payroll_manual_supplement (wrong schema). ADR-0292.';


-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger B — change_proposal AFTER UPDATE: status → 'applied', kind = 'wage_line_override'
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_payroll_proposal_applied()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_calculation_id UUID;
  v_period_id      UUID;
BEGIN
  -- Guard: only react to wage_line_override proposals transitioning to 'applied'
  IF OLD.status = 'applied'
     OR NEW.status != 'applied'
     OR NEW.kind IS DISTINCT FROM 'wage_line_override' THEN
    RETURN NEW;
  END IF;

  v_calculation_id := (NEW.changes ->> 'calculation_id')::UUID;
  v_period_id      := (NEW.changes ->> 'period_id')::UUID;

  IF v_calculation_id IS NULL OR v_period_id IS NULL THEN
    RAISE EXCEPTION 'payroll_proposal_applied_trg: change_proposal % has kind=wage_line_override but missing calculation_id or period_id in changes JSONB — cannot emit override-applier event.',
      NEW.change_proposal_id;
  END IF;

  INSERT INTO public.engine_event (
    event_type,
    payload,
    workspace_id,
    idempotency_key,
    fired_at
  )
  VALUES (
    'payroll.line_override_applied',
    jsonb_build_object(
      'change_proposal_id', NEW.change_proposal_id,
      'calculation_id',     v_calculation_id,
      'period_id',          v_period_id,
      'workspace_id',       NEW.workspace_id,
      'resolved_by',        NEW.resolved_by,
      'resolved_at',        NEW.resolved_at
    ),
    NEW.workspace_id,
    'payroll.line_override_applied.' || NEW.change_proposal_id::text,
    now()
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER payroll_proposal_applied_trg
  AFTER UPDATE ON public.change_proposal
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_payroll_proposal_applied();

COMMENT ON FUNCTION public.fn_payroll_proposal_applied() IS
  'Trigger B (Phase 2 T1.2 fix): fires when change_proposal transitions to status=''applied'' '
  'AND kind=''wage_line_override''. Emits engine_event(payroll.line_override_applied). '
  'ADR-0292, ADR-0251.';


-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger C — tip_distribution AFTER INSERT (approved, linked to open period)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_payroll_tip_distribution_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, payroll, extensions
AS $$
DECLARE
  v_period_status TEXT;
BEGIN
  -- Guard: only react when approved AND linked to a payroll period
  IF NEW.status != 'approved' OR NEW.payroll_period_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.status
    INTO v_period_status
    FROM payroll.period p
   WHERE p.id = NEW.payroll_period_id;

  IF v_period_status IS DISTINCT FROM 'open' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.engine_event (
    event_type,
    payload,
    workspace_id,
    idempotency_key,
    fired_at
  )
  VALUES (
    'payroll.recalc_triggered_by_tip_distribution',
    jsonb_build_object(
      'payroll_period_id', NEW.payroll_period_id,
      'profile_id',        NEW.profile_id,
      'tip_distribution_id', NEW.id,
      'tip_pool_id',       NEW.pool_id,
      'workspace_id',      NEW.workspace_id
    ),
    NEW.workspace_id,
    'payroll.recalc_tip.' || NEW.payroll_period_id::text
      || '.' || NEW.profile_id::text
      || '.' || NEW.pool_id::text,
    now()
  )
  ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER payroll_tip_distribution_recalc_trg
  AFTER INSERT ON public.tip_distribution
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_payroll_tip_distribution_recalc();

COMMENT ON FUNCTION public.fn_payroll_tip_distribution_recalc() IS
  'Trigger C (Phase 2 T1.2 fix): fires on public.tip_distribution INSERT when '
  'status=''approved'' AND payroll_period_id IS NOT NULL AND period.status=''open''. '
  'Emits engine_event(payroll.recalc_triggered_by_tip_distribution). ADR-0292.';
