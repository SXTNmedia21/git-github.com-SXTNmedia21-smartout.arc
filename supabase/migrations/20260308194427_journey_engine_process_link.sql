SET search_path TO public, extensions;

-- Link journey PM table to engine runtime
ALTER TABLE journey ADD COLUMN IF NOT EXISTS engine_process_id TEXT REFERENCES engine_process(id);

-- Compile metadata — used by compile function to generate engine_process + triggers
ALTER TABLE journey ADD COLUMN IF NOT EXISTS trigger_event TEXT;      -- e.g. "signup.completed"
ALTER TABLE journey ADD COLUMN IF NOT EXISTS step_event_type TEXT;    -- e.g. "onboarding.step_completed"
ALTER TABLE journey ADD COLUMN IF NOT EXISTS entity_type TEXT;        -- e.g. "user_identity"

-- Index for join queries in Journey Portal
CREATE INDEX IF NOT EXISTS idx_journey_engine_process ON journey(engine_process_id)
  WHERE engine_process_id IS NOT NULL;

COMMENT ON COLUMN journey.engine_process_id IS 'FK to engine_process. Set by compile. NULL = not yet compiled.';
COMMENT ON COLUMN journey.trigger_event IS 'Engine event_type that starts this journey (dot notation). Used by compile.';
COMMENT ON COLUMN journey.step_event_type IS 'Default event_type for wait_for_event steps (dot notation). Used by compile.';
COMMENT ON COLUMN journey.entity_type IS 'Entity type for engine_state tracking. Used by compile.';
