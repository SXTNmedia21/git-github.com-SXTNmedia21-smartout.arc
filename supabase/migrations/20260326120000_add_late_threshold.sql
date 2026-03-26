-- Add configurable lateness threshold to shift_clock_config
ALTER TABLE shift_clock_config
ADD COLUMN late_threshold_minutes integer NOT NULL DEFAULT 10;

COMMENT ON COLUMN shift_clock_config.late_threshold_minutes
IS 'Minutes after shift start before lateness alert fires. Default 10.';
