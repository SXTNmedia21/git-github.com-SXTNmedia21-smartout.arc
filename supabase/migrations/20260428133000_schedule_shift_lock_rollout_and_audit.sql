SET search_path TO public, extensions;

-- ============================================
-- 20260428133000_schedule_shift_lock_rollout_and_audit.sql
-- Adds rollout mode + audit trail for temporal shift lock.
-- Why: support shadow rollout before full hard enforcement.
-- ============================================

CREATE TABLE IF NOT EXISTS public.schedule_shift_lock_policy (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  lock_mode text NOT NULL DEFAULT 'enforce' CHECK (lock_mode IN ('enforce', 'shadow', 'off')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_schedule_shift_lock_policy_updated_at
  BEFORE UPDATE ON public.schedule_shift_lock_policy
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.schedule_shift_lock_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_schedule_shift_lock_policy" ON public.schedule_shift_lock_policy;
CREATE POLICY "jwt_read_schedule_shift_lock_policy"
  ON public.schedule_shift_lock_policy
  FOR SELECT
  USING (workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_manage_schedule_shift_lock_policy" ON public.schedule_shift_lock_policy;
CREATE POLICY "jwt_manage_schedule_shift_lock_policy"
  ON public.schedule_shift_lock_policy
  FOR ALL
  USING (public.is_admin_in_workspace(auth.uid(), workspace_id))
  WITH CHECK (public.is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_schedule_shift_lock_policy" ON public.schedule_shift_lock_policy;
CREATE POLICY "api_key_read_schedule_shift_lock_policy"
  ON public.schedule_shift_lock_policy
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());

CREATE TABLE IF NOT EXISTS public.schedule_shift_lock_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  schedule_shift_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('update', 'delete')),
  reason_code text NOT NULL,
  lock_mode text NOT NULL CHECK (lock_mode IN ('enforce', 'shadow', 'off')),
  is_enforced boolean NOT NULL,
  actor_user_id uuid NULL,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  old_row jsonb NOT NULL,
  new_row jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_shift_lock_audit_workspace_created
  ON public.schedule_shift_lock_audit (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_shift_lock_audit_shift_created
  ON public.schedule_shift_lock_audit (schedule_shift_id, created_at DESC);

ALTER TABLE public.schedule_shift_lock_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_schedule_shift_lock_audit" ON public.schedule_shift_lock_audit;
CREATE POLICY "jwt_read_schedule_shift_lock_audit"
  ON public.schedule_shift_lock_audit
  FOR SELECT
  USING (public.is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "service_role_full_schedule_shift_lock_audit" ON public.schedule_shift_lock_audit;
CREATE POLICY "service_role_full_schedule_shift_lock_audit"
  ON public.schedule_shift_lock_audit
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.get_schedule_shift_lock_mode(p_workspace_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_mode text;
BEGIN
  SELECT lock_mode
  INTO v_mode
  FROM public.schedule_shift_lock_policy
  WHERE workspace_id = p_workspace_id;

  RETURN COALESCE(v_mode, 'enforce');
END;
$$;

COMMENT ON FUNCTION public.get_schedule_shift_lock_mode(uuid)
IS 'Returns temporal shift lock mode for workspace. Defaults to enforce.';

CREATE OR REPLACE FUNCTION public.record_schedule_shift_lock_audit(
  p_workspace_id uuid,
  p_schedule_shift_id uuid,
  p_operation text,
  p_reason_code text,
  p_lock_mode text,
  p_is_enforced boolean,
  p_shift_date date,
  p_start_time time,
  p_old_row jsonb,
  p_new_row jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.schedule_shift_lock_audit (
    workspace_id,
    schedule_shift_id,
    operation,
    reason_code,
    lock_mode,
    is_enforced,
    actor_user_id,
    shift_date,
    start_time,
    old_row,
    new_row
  )
  VALUES (
    p_workspace_id,
    p_schedule_shift_id,
    p_operation,
    p_reason_code,
    p_lock_mode,
    p_is_enforced,
    auth.uid(),
    p_shift_date,
    p_start_time,
    p_old_row,
    p_new_row
  );
END;
$$;

COMMENT ON FUNCTION public.record_schedule_shift_lock_audit(uuid, uuid, text, text, text, boolean, date, time, jsonb, jsonb)
IS 'Writes temporal shift lock audit entries for blocked or shadow-allowed mutations.';

CREATE OR REPLACE FUNCTION public.handle_schedule_shift_lock_violation(
  p_workspace_id uuid,
  p_schedule_shift_id uuid,
  p_operation text,
  p_reason_code text,
  p_shift_date date,
  p_start_time time,
  p_old_row jsonb,
  p_new_row jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_mode text := public.get_schedule_shift_lock_mode(p_workspace_id);
BEGIN
  IF v_mode = 'off' THEN
    RETURN;
  END IF;

  PERFORM public.record_schedule_shift_lock_audit(
    p_workspace_id,
    p_schedule_shift_id,
    p_operation,
    p_reason_code,
    v_mode,
    v_mode = 'enforce',
    p_shift_date,
    p_start_time,
    p_old_row,
    p_new_row
  );

  IF v_mode = 'enforce' THEN
    RAISE EXCEPTION USING
      MESSAGE = 'SHIFT_LOCKED_MUTATION:' || p_reason_code,
      ERRCODE = 'P0001';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.handle_schedule_shift_lock_violation(uuid, uuid, text, text, date, time, jsonb, jsonb)
IS 'Applies rollout mode for temporal lock: enforce raises, shadow audits, off bypasses.';

CREATE OR REPLACE FUNCTION public.enforce_schedule_shift_temporal_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_is_locked boolean;
  v_allow_adhoc_assignment boolean := false;
  v_status_changed boolean := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_is_locked := public.schedule_shift_is_temporally_locked(
      OLD.workspace_id,
      OLD.shift_date,
      OLD.start_time
    );

    IF v_is_locked THEN
      PERFORM public.handle_schedule_shift_lock_violation(
        OLD.workspace_id,
        OLD.schedule_shift_id,
        'delete',
        'cannot_delete_started_or_past_shift',
        OLD.shift_date,
        OLD.start_time,
        to_jsonb(OLD),
        NULL
      );
    END IF;

    RETURN OLD;
  END IF;

  -- UPDATE path
  v_is_locked := public.schedule_shift_is_temporally_locked(
    OLD.workspace_id,
    OLD.shift_date,
    OLD.start_time
  );

  IF NOT v_is_locked THEN
    RETURN NEW;
  END IF;

  -- Special operational carve-out:
  -- Ad-hoc shift can bind employee when starting active.
  v_allow_adhoc_assignment :=
    COALESCE(OLD.is_adhoc, false) = true
    AND OLD.employee_id IS NULL
    AND NEW.employee_id IS NOT NULL
    AND OLD.status IN ('created', 'assigned', 'published')
    AND NEW.status = 'active';

  -- Planning fields become immutable after lock.
  IF (OLD.shift_date IS DISTINCT FROM NEW.shift_date)
    OR (OLD.start_time IS DISTINCT FROM NEW.start_time)
    OR (OLD.end_time IS DISTINCT FROM NEW.end_time)
    OR (OLD.role IS DISTINCT FROM NEW.role)
    OR (OLD.day_category IS DISTINCT FROM NEW.day_category)
    OR (OLD.department_id IS DISTINCT FROM NEW.department_id)
    OR (OLD.location_id IS DISTINCT FROM NEW.location_id)
    OR (OLD.position_id IS DISTINCT FROM NEW.position_id)
    OR (OLD.team_id IS DISTINCT FROM NEW.team_id)
    OR (OLD.zone IS DISTINCT FROM NEW.zone)
    OR (OLD.indicator IS DISTINCT FROM NEW.indicator)
    OR (OLD.breaks IS DISTINCT FROM NEW.breaks)
    OR (OLD.work_hours IS DISTINCT FROM NEW.work_hours)
    OR (OLD.is_published IS DISTINCT FROM NEW.is_published)
    OR (OLD.template_shift_id IS DISTINCT FROM NEW.template_shift_id)
    OR (OLD.is_adhoc IS DISTINCT FROM NEW.is_adhoc)
    OR (OLD.notes IS DISTINCT FROM NEW.notes)
    OR (
      OLD.employee_id IS DISTINCT FROM NEW.employee_id
      AND NOT v_allow_adhoc_assignment
    )
  THEN
    PERFORM public.handle_schedule_shift_lock_violation(
      OLD.workspace_id,
      OLD.schedule_shift_id,
      'update',
      'planning_fields_immutable_after_start_or_past_date',
      OLD.shift_date,
      OLD.start_time,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  END IF;

  v_status_changed := OLD.status IS DISTINCT FROM NEW.status;

  IF v_status_changed THEN
    -- Allowed status transitions in locked window:
    -- published -> active, active -> completed
    IF NOT (
      (OLD.status = 'published' AND NEW.status = 'active')
      OR (OLD.status = 'active' AND NEW.status = 'completed')
    ) THEN
      PERFORM public.handle_schedule_shift_lock_violation(
        OLD.workspace_id,
        OLD.schedule_shift_id,
        'update',
        'invalid_status_transition_for_locked_shift',
        OLD.shift_date,
        OLD.start_time,
        to_jsonb(OLD),
        to_jsonb(NEW)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
