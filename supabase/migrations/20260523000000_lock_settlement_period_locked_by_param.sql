-- 20260523000000_lock_settlement_period_locked_by_param.sql
-- Fix: lock_settlement_period() called via service-role client returns auth.uid()=NULL,
-- violating settlement_period_locked_fields_check (locked_by NOT NULL when status=locked).
-- Add explicit p_locked_by parameter so callers pass the authenticated userId
-- resolved at the application layer.
--
-- Discovered: 2026-05-02 during M8 Erik UAT walkthrough. executeSettlementRun
-- passes serviceClient (SECURITY DEFINER bypass) → auth.uid() returns NULL →
-- check constraint fails → entire run rejected.

-- Drop existing 3-arg signature first (CREATE OR REPLACE doesn't allow signature change)
DROP FUNCTION IF EXISTS billing.lock_settlement_period(uuid, date, date);

CREATE OR REPLACE FUNCTION billing.lock_settlement_period(
  p_workspace_id uuid,
  p_period_start date,
  p_period_end date,
  p_locked_by uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'billing', 'public'
AS $function$
DECLARE
  v_period_id uuid;
  v_status    billing.settlement_status;
BEGIN
  -- p_locked_by is required — caller resolves the authenticated user_identity.user_id
  -- from the application layer (Server Action or service-context invocation).
  -- auth.uid() is NOT used here because SECURITY DEFINER functions called via
  -- service-role clients have no JWT context.
  IF p_locked_by IS NULL THEN
    RAISE EXCEPTION 'p_locked_by required (auth.uid not available via service-role)'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Check if period row already exists
  SELECT period_id, status
  INTO v_period_id, v_status
  FROM billing.settlement_period
  WHERE workspace_id  = p_workspace_id
    AND period_start  = p_period_start
    AND period_end    = p_period_end;

  IF NOT FOUND THEN
    -- Create new period directly in locked state
    INSERT INTO billing.settlement_period (
      workspace_id, period_start, period_end,
      status, locked_at, locked_by
    )
    VALUES (
      p_workspace_id, p_period_start, p_period_end,
      'locked', now(), p_locked_by
    )
    RETURNING period_id INTO v_period_id;

    RETURN v_period_id;
  END IF;

  -- Already closed — hard stop. Must not be unlocked without ADR-supersession.
  IF v_status = 'closed' THEN
    RAISE EXCEPTION
      'settlement_period % is closed and cannot be locked again (ADR-E: closed is terminal)',
      v_period_id
      USING ERRCODE = 'check_violation';
  END IF;

  -- Already locked — idempotent success
  IF v_status = 'locked' THEN
    RETURN v_period_id;
  END IF;

  -- Open → locked transition
  UPDATE billing.settlement_period
  SET status    = 'locked',
      locked_at = now(),
      locked_by = p_locked_by
  WHERE period_id = v_period_id;

  RETURN v_period_id;
END;
$function$;

COMMENT ON FUNCTION billing.lock_settlement_period IS
  'Lock a workspace settlement period. p_locked_by = authenticated user_identity.user_id, resolved at application layer. SECURITY DEFINER bypasses RLS but auth.uid() is NULL when invoked via service-role client — the param is mandatory.';
