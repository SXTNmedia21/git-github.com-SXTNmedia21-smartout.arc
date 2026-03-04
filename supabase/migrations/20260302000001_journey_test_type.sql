SET search_path TO public, extensions;

-- Add test_type enum and column to journey_test_run
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journey_test_type') THEN
    CREATE TYPE journey_test_type AS ENUM ('automated', 'manual');
  END IF;
END $$;;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journey_test_run' AND column_name = 'test_type') THEN
    ALTER TABLE journey_test_run ADD COLUMN IF NOT EXISTS test_type public.journey_test_type NOT NULL DEFAULT 'automated';
  END IF;
END $$;

COMMENT ON COLUMN journey_test_run.test_type IS 'Whether this test was run by agent (automated) or human-guided (manual)';
