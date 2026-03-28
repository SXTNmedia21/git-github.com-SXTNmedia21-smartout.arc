SET search_path TO public, extensions;

-- ============================================
-- 20260428140000_shift_lock_high_access_override.sql
-- Allows high-access users to override temporal shift lock in enforce mode.
-- Why: operations may require emergency correction by admins/owners.
-- ============================================

ALTER TABLE public.schedule_shift_lock_audit
  ADD COLUMN IF NOT EXISTS is_overridden_by_high_access boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.can_override_schedule_shift_lock(p_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_is_godmode boolean := false;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT is_godmode
  INTO v_is_godmode
  FROM public.user_identity
  WHERE user_id = v_user_id;

  IF COALESCE(v_is_godmode, false) THEN
    RETURN true;
  END IF;

  -- is_admin_in_workspace covers admin/owner-level workspace access patterns.
  RETURN public.is_admin_in_workspace(v_user_id, p_workspace_id);
END;
$$;

COMMENT ON FUNCTION public.can_override_schedule_shift_lock(uuid)
IS 'Returns true when current actor has high access and can override temporal shift lock.';

CREATE OR REPLACE FUNCTION public.record_schedule_shift_lock_audit(
  p_workspace_id uuid,
  p_schedule_shift_id uuid,
  p_operation text,
  p_reason_code text,
  p_lock_mode text,
  p_is_enforced boolean,
  p_is_overridden_by_high_access boolean,
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
    is_overridden_by_high_access,
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
    p_is_overridden_by_high_access,
    auth.uid(),
    p_shift_date,
    p_start_time,
    p_old_row,
    p_new_row
  );
END;
$$;

COMMENT ON FUNCTION public.record_schedule_shift_lock_audit(uuid, uuid, text, text, text, boolean, boolean, date, time, jsonb, jsonb)
IS 'Writes temporal shift lock audit entries, including explicit high-access override marker.';

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
  v_high_access_override boolean := public.can_override_schedule_shift_lock(p_workspace_id);
  v_is_enforced boolean;
BEGIN
  IF v_mode = 'off' THEN
    RETURN;
  END IF;

  -- In enforce mode, high-access actors may explicitly override lock behavior.
  v_is_enforced := v_mode = 'enforce' AND NOT v_high_access_override;

  PERFORM public.record_schedule_shift_lock_audit(
    p_workspace_id,
    p_schedule_shift_id,
    p_operation,
    p_reason_code,
    v_mode,
    v_is_enforced,
    v_high_access_override,
    p_shift_date,
    p_start_time,
    p_old_row,
    p_new_row
  );

  IF v_is_enforced THEN
    RAISE EXCEPTION USING
      MESSAGE = 'SHIFT_LOCKED_MUTATION:' || p_reason_code,
      ERRCODE = 'P0001';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.handle_schedule_shift_lock_violation(uuid, uuid, text, text, date, time, jsonb, jsonb)
IS 'Applies temporal lock mode with high-access override support in enforce mode.';
