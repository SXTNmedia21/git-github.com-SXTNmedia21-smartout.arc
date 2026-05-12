-- T7.4: Server-side punch rounding on time_entry INSERT/UPDATE.
--
-- Reads punch_rounding_direction + punch_rounding_minutes from
-- payroll.workspace_settings for the row's workspace. Applies rounding
-- to punch_in on INSERT and to punch_out on UPDATE (when not null).
--
-- Directions:
--   none    → no-op
--   nearest → round to nearest multiple of punch_rounding_minutes
--   up      → ceiling to next multiple
--   down    → floor to previous multiple
--
-- A rounding_minutes value of 0 is treated as none (no-op guard).
--
-- ADR-0259: workspace_settings.punch_rounding_* defaults shipped in Phase 1.

CREATE OR REPLACE FUNCTION timesheet.apply_punch_rounding()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = timesheet, payroll, public
AS $$
DECLARE
  v_direction TEXT;
  v_minutes   INTEGER;
  v_interval  INTERVAL;
BEGIN
  -- Read workspace rounding config (no row = no-op)
  SELECT
    punch_rounding_direction,
    punch_rounding_minutes
  INTO v_direction, v_minutes
  FROM payroll.workspace_settings
  WHERE workspace_id = NEW.workspace_id;

  -- Guard: missing config, direction none, or 0-minute window → pass through
  IF v_direction IS NULL OR v_direction = 'none' OR COALESCE(v_minutes, 0) = 0 THEN
    RETURN NEW;
  END IF;

  v_interval := (v_minutes || ' minutes')::INTERVAL;

  -- Round punch_in on INSERT (or when explicitly updated)
  IF NEW.punch_in IS NOT NULL THEN
    NEW.punch_in := timesheet.round_timestamp(NEW.punch_in, v_direction, v_interval);
  END IF;

  -- Round punch_out on UPDATE when newly set
  IF NEW.punch_out IS NOT NULL AND (TG_OP = 'UPDATE') THEN
    IF OLD.punch_out IS DISTINCT FROM NEW.punch_out THEN
      NEW.punch_out := timesheet.round_timestamp(NEW.punch_out, v_direction, v_interval);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Helper: round a timestamptz to a minute-interval bucket ────────────────

CREATE OR REPLACE FUNCTION timesheet.round_timestamp(
  p_ts        TIMESTAMPTZ,
  p_direction TEXT,
  p_interval  INTERVAL
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  epoch_secs   DOUBLE PRECISION;
  bucket_secs  DOUBLE PRECISION;
  remainder    DOUBLE PRECISION;
  result_epoch DOUBLE PRECISION;
BEGIN
  epoch_secs  := EXTRACT(EPOCH FROM p_ts);
  bucket_secs := EXTRACT(EPOCH FROM p_interval);

  IF bucket_secs = 0 THEN
    RETURN p_ts;
  END IF;

  remainder := MOD(epoch_secs::NUMERIC, bucket_secs::NUMERIC)::DOUBLE PRECISION;

  CASE p_direction
    WHEN 'nearest' THEN
      IF remainder >= bucket_secs / 2 THEN
        result_epoch := epoch_secs - remainder + bucket_secs;
      ELSE
        result_epoch := epoch_secs - remainder;
      END IF;
    WHEN 'up' THEN
      IF remainder = 0 THEN
        result_epoch := epoch_secs;
      ELSE
        result_epoch := epoch_secs - remainder + bucket_secs;
      END IF;
    WHEN 'down' THEN
      result_epoch := epoch_secs - remainder;
    ELSE
      RETURN p_ts;
  END CASE;

  RETURN TO_TIMESTAMP(result_epoch) AT TIME ZONE 'UTC';
END;
$$;

-- ─── Attach trigger ──────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_punch_rounding ON timesheet.time_entry;

CREATE TRIGGER trg_punch_rounding
  BEFORE INSERT OR UPDATE OF punch_in, punch_out
  ON timesheet.time_entry
  FOR EACH ROW
  EXECUTE FUNCTION timesheet.apply_punch_rounding();
