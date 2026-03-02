-- Add test_type enum and column to journey_test_run
CREATE TYPE journey_test_type AS ENUM ('automated', 'manual');

ALTER TABLE journey_test_run
  ADD COLUMN test_type journey_test_type NOT NULL DEFAULT 'automated';

COMMENT ON COLUMN journey_test_run.test_type IS 'Whether this test was run by agent (automated) or human-guided (manual)';
