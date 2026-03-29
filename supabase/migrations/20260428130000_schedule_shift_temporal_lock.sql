SET search_path TO public, extensions;

-- ============================================
-- 20260428130000_schedule_shift_temporal_lock.sql
-- Enforces temporal immutability on schedule_shift planning fields.
-- Rule: once shift has started OR shift date has passed (workspace timezone),
-- planning mutations are blocked.
-- ============================================

-- Why this exists:
-- - schedule_shift writes happen from multiple channels (web, voice, MCP, mobile)
-- - RLS is permission-based and does not express temporal immutability
-- - service-role channels can bypass RLS, but cannot bypass table triggers

CREATE OR REPLACE FUNCTION public.schedule_shift_is_temporally_locked(
  p_workspace_id uuid,
  p_shift_date date,
  p_start_time time
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_timezone text := 'Europe/Oslo';
  v_local_now timestamp;
  v_shift_start_local timestamp;
BEGIN
  SELECT timezone
  INTO v_timezone
  FROM public.workspace
  WHERE workspace_id = p_workspace_id;

  IF v_timezone IS NULL OR v_timezone = '' THEN
    v_timezone := 'Europe/Oslo';
  END IF;

  v_local_now := timezone(v_timezone, now());
  v_shift_start_local := p_shift_date::timestamp + p_start_time;

  -- Locked if date is already in the past, or this shift has started.
  RETURN p_shift_date < v_local_now::date OR v_shift_start_local <= v_local_now;
END;
$$;

COMMENT ON FUNCTION public.schedule_shift_is_temporally_locked(uuid, date, time)
IS 'Returns true when a shift is in immutable window using workspace timezone.';

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
      RAISE EXCEPTION USING
        MESSAGE = 'SHIFT_LOCKED_MUTATION:cannot_delete_started_or_past_shift',
        ERRCODE = 'P0001';
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
    RAISE EXCEPTION USING
      MESSAGE = 'SHIFT_LOCKED_MUTATION:planning_fields_immutable_after_start_or_past_date',
      ERRCODE = 'P0001';
  END IF;

  v_status_changed := OLD.status IS DISTINCT FROM NEW.status;

  IF v_status_changed THEN
    -- Allowed status transitions in locked window:
    -- published -> active, active -> completed
    IF NOT (
      (OLD.status = 'published' AND NEW.status = 'active')
      OR (OLD.status = 'active' AND NEW.status = 'completed')
    ) THEN
      RAISE EXCEPTION USING
        MESSAGE = 'SHIFT_LOCKED_MUTATION:invalid_status_transition_for_locked_shift',
        ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_schedule_shift_temporal_lock()
IS 'Blocks schedule planning mutations after shift start/past date; keeps narrow operational exceptions.';

DROP TRIGGER IF EXISTS trg_schedule_shift_temporal_lock ON public.schedule_shift;
CREATE TRIGGER trg_schedule_shift_temporal_lock
  BEFORE UPDATE OR DELETE ON public.schedule_shift
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_schedule_shift_temporal_lock();
