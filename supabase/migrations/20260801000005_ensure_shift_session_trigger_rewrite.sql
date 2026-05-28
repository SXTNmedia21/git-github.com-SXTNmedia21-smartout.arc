-- Migration 20260801000005: ensure_shift_session trigger rewrite
-- ADR-0430 Phase b / PLAN-4b §4b.2.
--
-- Problem (PLAN-0 AC-0.8 finding): old trigger body reads NEW.location_id directly
-- from schedule_shift. M4 (migration 20260801000006) drops that column.
-- Pre-M4 rewrite: resolve location_id from day_line (via department_session_id + shift_date)
-- instead of from the source shift row, so the trigger is column-drop safe.
--
-- MF-Prior-1 (council mandate): DROP TRIGGER + CREATE TRIGGER (not just OR REPLACE on function).
-- New trigger MUST NOT include `OF location_id` in the UPDATE column watch list.

BEGIN;

-- ── Step 1: DROP the existing trigger ────────────────────────────────────────
-- Cannot ALTER a trigger's column watch list — must drop and recreate.
DROP TRIGGER IF EXISTS trg_ensure_shift_session ON public.schedule_shift;

-- ── Step 2: Rewrite the function body ────────────────────────────────────────
-- New location_id resolution path:
--   department_session (by department_id + shift_date) → day_line (by location_id filter)
-- This mirrors the original logic but without reading NEW.location_id.
-- Picks the FIRST day_line for the department_session on that date; if multiple
-- day_lines exist (multi-location), the first one is used as the shift_session anchor.
-- (The shift_zone M:N table holds all zone assignments — shift_session.location_id
--  is a session anchor, not an exhaustive list of zones.)
--
-- ADR-0367 §5.6 invariant preserved: NULL-guards for ad-hoc/unassigned shifts.
CREATE OR REPLACE FUNCTION public.ensure_shift_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_department_id    UUID;
  v_session_id       UUID;
  v_location_id      UUID;
  v_shift_session_id UUID;
BEGIN
  -- NULL-guard: skip if shift is not fully assigned (ADR-0367 §5.6)
  IF NEW.employee_id IS NULL
     OR NEW.shift_date IS NULL
  THEN
    RETURN NEW;
  END IF;

  -- Resolve department_id: prefer shift.department_id, fall back through position
  v_department_id := COALESCE(
    NEW.department_id,
    (SELECT p.department_id FROM public.position p WHERE p.position_id = NEW.position_id)
  );
  IF v_department_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the department_session for this (department, date)
  SELECT ds.department_session_id INTO v_session_id
  FROM public.department_session ds
  WHERE ds.workspace_id = NEW.workspace_id
    AND ds.department_id = v_department_id
    AND ds.session_date = NEW.shift_date
  LIMIT 1;

  IF v_session_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve location_id from day_line (ADR-0430: NOT from schedule_shift.location_id)
  -- Pick the first active day_line for this department_session.
  SELECT dl.location_id INTO v_location_id
  FROM public.day_line dl
  WHERE dl.department_session_id = v_session_id
    AND dl.cancelled_at IS NULL
  ORDER BY dl.created_at
  LIMIT 1;

  IF v_location_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Upsert shift_session; conflict on schedule_shift_id (unique per ADR-0367)
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
    v_location_id,
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

  -- Attach day_line rows for all active day_lines in this session
  -- (multi-location aware: creates one shift_session_day_line per location)
  INSERT INTO public.shift_session_day_line (shift_session_id, day_line_id)
  SELECT v_shift_session_id, dl.day_line_id
  FROM public.day_line dl
  WHERE dl.department_session_id = v_session_id
    AND dl.cancelled_at IS NULL
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── Step 3: Recreate trigger WITHOUT OF location_id clause ───────────────────
-- location_id is dropped by M4 (20260801000006) — cannot watch a non-existent column.
-- Watches: position_id, department_id, employee_id, shift_date (all retained post-M4).
CREATE TRIGGER trg_ensure_shift_session
  AFTER INSERT OR UPDATE OF position_id, department_id, employee_id, shift_date
    ON public.schedule_shift
  FOR EACH ROW EXECUTE FUNCTION public.ensure_shift_session();

COMMIT;
