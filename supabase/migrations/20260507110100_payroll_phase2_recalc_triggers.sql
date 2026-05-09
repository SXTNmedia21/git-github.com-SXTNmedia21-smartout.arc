-- 20260507110100_payroll_phase2_recalc_triggers.sql
--
-- T1.2 — Three DB triggers that emit engine_event rows for payroll recalc
--         orchestration (Payroll Phase 2).
--
-- ─── Transport choice (Q2 resolution) ────────────────────────────────────────
-- Transport: DB trigger → INSERT into public.engine_event → engine_dispatch
-- consumes via the existing engine_event poller.
--
-- Why NOT pg_net.http_post (Edge Function direct call):
--   1. Transactionality: the INSERT is atomic with the data write (same txn).
--      An HTTP call from a trigger fires AFTER commit but BEFORE any failure-
--      recovery; if the HTTP call fails the supplement is committed but recalc
--      never fires — a silent gap.
--   2. Retry semantics: engine_event queue inherits pg retry via engine_dispatch
--      polling. HTTP calls from triggers have no native retry.
--   3. Pattern consistency: existing seasonal triggers (20260518010001) and
--      session hooks (20260427100000) all use the engine_event INSERT pattern.
--
-- engine_event schema (20260304100000):
--   id UUID, event_type TEXT, payload JSONB, workspace_id UUID, idempotency_key TEXT,
--   fired_at TIMESTAMPTZ
--
-- ADR references: ADR-0292 (override-applier semantics), ADR-0251 (audit chain).
-- Skill refs: payroll-engine-developer §Principle 3 (audit non-negotiable).
--
-- Rollback plan:
--   DROP TRIGGER IF EXISTS payroll_manual_supplement_recalc_trg ON public.payroll_manual_supplement;
--   DROP FUNCTION IF EXISTS public.fn_payroll_manual_supplement_recalc();
--   DROP TRIGGER IF EXISTS payroll_proposal_applied_trg ON public.change_proposal;
--   DROP FUNCTION IF EXISTS public.fn_payroll_proposal_applied();
--   DROP TRIGGER IF EXISTS payroll_tip_distribution_recalc_trg ON public.tip_distribution;
--   DROP FUNCTION IF EXISTS public.fn_payroll_tip_distribution_recalc();

SET search_path TO public, extensions;

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger A — payroll_manual_supplement AFTER INSERT OR DELETE
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Fires on INSERT (supplement added) and DELETE (supplement removed).
-- Condition: the supplement's shift must belong to an open payroll period.
-- Because payroll_manual_supplement.schedule_shift_id → schedule_shift, and
-- payroll.period is scope-per-workspace, we look up the open period for the
-- supplement's workspace that contains the shift's date.
--
-- Idempotency key: 'payroll.recalc_supplement.<supplement_id>.<op>.<fired_at_minute>'
-- The minute-precision key prevents duplicate events if the trigger fires twice
-- within the same minute for the same supplement (edge case during batch ops).

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

  -- If no open period covers this shift, no recalc needed (period locked or not yet created)
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
    -- Minute-precision idempotency: prevents duplicate events in batch ops
    'payroll.recalc_supplement.' || v_supplement_id::text || '.' || v_op || '.'
      || to_char(now(), 'YYYYMMDDHH24MI'),
    now()
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Install Trigger A
DROP TRIGGER IF EXISTS payroll_manual_supplement_recalc_trg
  ON public.payroll_manual_supplement;

CREATE TRIGGER payroll_manual_supplement_recalc_trg
  AFTER INSERT OR DELETE
  ON public.payroll_manual_supplement
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_payroll_manual_supplement_recalc();

COMMENT ON FUNCTION public.fn_payroll_manual_supplement_recalc() IS
  'Trigger A (Phase 2 T1.2): fires on payroll_manual_supplement INSERT/DELETE. '
  'Emits engine_event(payroll.recalc_triggered_by_supplement) if the supplement '
  'falls within an open payroll period. The engine_dispatch poller consumes this '
  'and invokes recalculate_period. ADR-0292.';


-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger B — change_proposal AFTER UPDATE: status → 'applied', kind = 'wage_line_override'
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Fires when an admin approves a wage_line_override proposal by setting status='applied'.
-- The trigger emits engine_event(payroll.line_override_applied), which the override-
-- applier function (T2.2, next batch) will consume to:
--   1. INSERT shift_pay_calculation_event with supersession chain (ADR-0251).
--   2. INSERT new payroll_calculation row with derivation_version+1, source='override'.
--   3. Leave original payroll_calculation row UNCHANGED (audit immutability).
--
-- This trigger is intentionally thin — it only emits the event. The business logic
-- lives in the applier function (T2.2) to keep the trigger side-effect minimal and
-- testable in isolation.
--
-- Idempotency key: 'payroll.line_override_applied.<proposal_id>' — global uniqueness
-- (one proposal can only be applied once; if trigger re-fires somehow, the ON CONFLICT
-- suppresses the duplicate event).

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

  -- Extract calculation_id and period_id from the changes JSONB payload
  -- (stored by override_calculation_line capability tool, T2.1)
  v_calculation_id := (NEW.changes ->> 'calculation_id')::UUID;
  v_period_id      := (NEW.changes ->> 'period_id')::UUID;

  -- Guard: payload must be complete (defensive — Zod validates at write time in the
  -- override_calculation_line capability tool, so this branch should never fire in
  -- production). Use RAISE EXCEPTION (not WARNING) so the UPDATE rolls back: a phantom
  -- 'applied' proposal with no engine_event is silent data-loss with no retry path.
  -- If this fires it means Zod validation was bypassed or the payload shape changed
  -- without updating this trigger — both cases warrant a loud 500, not a buried warning.
  IF v_calculation_id IS NULL OR v_period_id IS NULL THEN
    RAISE EXCEPTION 'payroll_proposal_applied_trg: change_proposal % has kind=wage_line_override but missing calculation_id or period_id in changes JSONB — cannot emit override-applier event.',
      NEW.change_proposal_id;
  END IF;

  -- Emit engine_event: consumed by override-applier (T2.2) in next batch
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
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Install Trigger B
DROP TRIGGER IF EXISTS payroll_proposal_applied_trg
  ON public.change_proposal;

CREATE TRIGGER payroll_proposal_applied_trg
  AFTER UPDATE
  ON public.change_proposal
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_payroll_proposal_applied();

COMMENT ON FUNCTION public.fn_payroll_proposal_applied() IS
  'Trigger B (Phase 2 T1.2): fires when change_proposal transitions to status=''applied'' '
  'AND kind=''wage_line_override''. Emits engine_event(payroll.line_override_applied) '
  'for the override-applier (T2.2, next batch). Trigger is thin — all business logic '
  'lives in the applier function. ADR-0292, ADR-0251.';


-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger C — tip_distribution AFTER INSERT (approved, linked to open period)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Fires when a tip_distribution row is inserted with:
--   status = 'approved'
--   payroll_period_id IS NOT NULL
--   The referenced payroll.period has status = 'open'
--
-- Design note: tip_pool approval inserts multiple tip_distribution rows (one
-- per participating employee) in a single transaction. Each row fires this trigger
-- independently. The engine_event idempotency_key is scoped to
-- (payroll_period_id, profile_id) so multiple rows for the same employee+period
-- only produce one event (edge case: duplicate distribution rows).
-- The recalc consumer handles N events per period via the engine_event queue;
-- serialisation is the engine's responsibility.
--
-- tip_distribution.payroll_period_id FK: added in 20260527100900 (Phase 1 T1.8).
-- tip_distribution_status enum: 'calculated' | 'approved' | 'paid' (20260428220000).

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

  -- Check the referenced period is still open (period may have been locked
  -- between the approval being initiated and the INSERT landing)
  SELECT p.status
    INTO v_period_status
    FROM payroll.period p
   WHERE p.id = NEW.payroll_period_id;

  IF v_period_status IS DISTINCT FROM 'open' THEN
    -- Period is locked or missing — tip_distribution becomes an "orphan"
    -- (flagged as a warning on next period-opening per journey spec §Error Paths).
    -- Do NOT fire recalc; the aggregate-period pass will ignore this row.
    RETURN NEW;
  END IF;

  -- Emit engine_event for recalc — scoped to (period, profile) for idempotency
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
    -- Period+profile scoped key: one recalc event per employee per period per pool
    'payroll.recalc_tip.' || NEW.payroll_period_id::text
      || '.' || NEW.profile_id::text
      || '.' || NEW.pool_id::text,
    now()
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Install Trigger C
DROP TRIGGER IF EXISTS payroll_tip_distribution_recalc_trg
  ON public.tip_distribution;

CREATE TRIGGER payroll_tip_distribution_recalc_trg
  AFTER INSERT
  ON public.tip_distribution
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_payroll_tip_distribution_recalc();

COMMENT ON FUNCTION public.fn_payroll_tip_distribution_recalc() IS
  'Trigger C (Phase 2 T1.2): fires on tip_distribution INSERT when status=''approved'' '
  'AND payroll_period_id IS NOT NULL AND period.status=''open''. '
  'Emits engine_event(payroll.recalc_triggered_by_tip_distribution). '
  'Idempotency key scoped to (period, profile, pool) to avoid duplicate events '
  'in batch-approval scenarios. ADR-0292.';
