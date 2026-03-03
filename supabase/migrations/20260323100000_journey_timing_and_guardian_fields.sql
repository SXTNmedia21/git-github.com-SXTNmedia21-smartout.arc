-- Add timing fields to journey_step
ALTER TABLE journey_step
  ADD COLUMN min_duration_seconds integer,
  ADD COLUMN max_duration_seconds integer,
  ADD COLUMN required_confirmation boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN journey_step.min_duration_seconds IS 'Minimum seconds before Guardian auto-advances';
COMMENT ON COLUMN journey_step.max_duration_seconds IS 'Guardian nudges/timeouts after this many seconds';
COMMENT ON COLUMN journey_step.required_confirmation IS 'Explicit user confirmation needed before advancing';

-- Add journey tracking to engine_sessions
ALTER TABLE engine_sessions
  ADD COLUMN journey_id uuid REFERENCES journey(journey_id) ON DELETE SET NULL,
  ADD COLUMN stage_started_at timestamptz,
  ADD COLUMN guardian_whisper_count integer NOT NULL DEFAULT 0;

CREATE INDEX idx_engine_sessions_journey ON engine_sessions(journey_id) WHERE journey_id IS NOT NULL;

COMMENT ON COLUMN engine_sessions.journey_id IS 'Journey driving this session (copied from mission at creation)';
COMMENT ON COLUMN engine_sessions.stage_started_at IS 'When current stage began (for Guardian timing)';
COMMENT ON COLUMN engine_sessions.guardian_whisper_count IS 'Number of Guardian whispers sent this session';
