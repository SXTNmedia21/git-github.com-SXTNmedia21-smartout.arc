-- supabase/migrations/20260620130100_day_line_back_populate_trigger.sql
-- ADR-0367 §5.6 counterpart. When day_line is INSERTed, back-populate
-- shift_session_day_line for any already-active shift_sessions at that
-- (department_session_id, location_id).

CREATE OR REPLACE FUNCTION public.back_populate_shift_session_day_line()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.shift_session_day_line (shift_session_id, day_line_id)
  SELECT ss.shift_session_id, NEW.day_line_id
  FROM public.shift_session ss
  WHERE ss.department_session_id = NEW.department_session_id
    AND ss.location_id = NEW.location_id
    AND ss.status IN ('scheduled', 'clocked_in')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_day_line_back_populate
  AFTER INSERT ON public.day_line
  FOR EACH ROW EXECUTE FUNCTION public.back_populate_shift_session_day_line();
