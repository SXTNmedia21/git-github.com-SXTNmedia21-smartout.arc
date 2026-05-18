-- supabase/migrations/20260620120700_day_line_backfill.sql
-- ADR-0367 §7.1. One day_line per existing department_session using the first
-- department_location alphabetically. is_backfilled=true so admin can reseat
-- within 7-day window. schedule_day_booking.day_line_id stays NULL — free-text
-- `.location` column cannot auto-resolve. Manager re-pins via admin UI.

INSERT INTO public.day_line (
  workspace_id, department_session_id, department_id, location_id,
  business_date, planned_open, planned_close, is_backfilled
)
SELECT
  ds.workspace_id,
  ds.department_session_id,
  ds.department_id,
  (
    SELECT dl.location_id
    FROM public.department_location dl
    JOIN public.location l ON l.location_id = dl.location_id
    WHERE dl.department_id = ds.department_id
    ORDER BY l.name
    LIMIT 1
  ) AS location_id,
  ds.session_date,
  COALESCE(ds.planned_open, '00:00'::time),
  COALESCE(ds.planned_close, '23:59'::time),
  true
FROM public.department_session ds
WHERE NOT EXISTS (
  SELECT 1 FROM public.day_line dl
  WHERE dl.department_session_id = ds.department_session_id
)
AND EXISTS (
  -- Skip dept-sessions whose department has no location pairing yet.
  SELECT 1 FROM public.department_location dl WHERE dl.department_id = ds.department_id
);
