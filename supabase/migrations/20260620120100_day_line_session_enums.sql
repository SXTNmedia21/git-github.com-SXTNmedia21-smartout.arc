-- supabase/migrations/20260620120100_day_line_session_enums.sql
--
-- ADR-0367. shift_session_status only. day_line_status DROPPED per
-- Council Phase 5 — derive from parent department_session + daily_reconciliation
-- + day_line.cancelled_at at read time (apps/web/src/lib/cascade/derive-day-line-status.ts).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_session_status') THEN
    CREATE TYPE shift_session_status AS ENUM (
      'scheduled',
      'clocked_in',
      'clocked_out',
      'cancelled'
    );
  END IF;
END$$;

COMMENT ON TYPE shift_session_status IS 'ADR-0367. Lifecycle of per-employee shift runtime. NULL day_line_status by design.';
