-- supabase/migrations/20260620130000_ensure_shift_session_trigger.sql
-- ADR-0367 §5.6. NULL-guards for ad-hoc/unassigned shifts. Does NOT create
-- department_session — that path stays with session-open capability.

CREATE OR REPLACE FUNCTION public.ensure_shift_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department_id    UUID;
  v_session_id       UUID;
  v_shift_session_id UUID;
BEGIN
  IF NEW.employee_id IS NULL
     OR NEW.location_id IS NULL
     OR NEW.shift_date IS NULL
  THEN
    RETURN NEW;
  END IF;

  v_department_id := COALESCE(
    NEW.department_id,
    (SELECT p.department_id FROM public.position p WHERE p.position_id = NEW.position_id)
  );
  IF v_department_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ds.department_session_id INTO v_session_id
  FROM public.department_session ds
  WHERE ds.workspace_id = NEW.workspace_id
    AND ds.department_id = v_department_id
    AND ds.session_date = NEW.shift_date
  LIMIT 1;
  IF v_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.shift_session (
    workspace_id, department_session_id, schedule_shift_id, employee_id,
    business_date, location_id, department_id, status, push_topic
  )
  VALUES (
    NEW.workspace_id,
    v_session_id,
    NEW.schedule_shift_id,
    NEW.employee_id,
    NEW.shift_date,
    NEW.location_id,
    v_department_id,
    'scheduled',
    'shift_session:' || gen_random_uuid()::text
  )
  ON CONFLICT (schedule_shift_id) DO NOTHING
  RETURNING shift_session_id INTO v_shift_session_id;

  IF v_shift_session_id IS NULL THEN
    SELECT shift_session_id INTO v_shift_session_id
    FROM public.shift_session
    WHERE schedule_shift_id = NEW.schedule_shift_id;
  END IF;

  INSERT INTO public.shift_session_day_line (shift_session_id, day_line_id)
  SELECT v_shift_session_id, dl.day_line_id
  FROM public.day_line dl
  WHERE dl.department_session_id = v_session_id
    AND dl.location_id = NEW.location_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_shift_session
  AFTER INSERT OR UPDATE OF location_id, position_id, department_id, employee_id, shift_date
    ON public.schedule_shift
  FOR EACH ROW EXECUTE FUNCTION public.ensure_shift_session();
