-- Link missions to journeys, stages to steps.
-- A mission references a journey (the user's path).
-- A stage references a journey step (what the user does at that point).

ALTER TABLE engine_missions
  ADD COLUMN journey_id uuid REFERENCES journey(journey_id) ON DELETE SET NULL;

ALTER TABLE engine_stages
  ADD COLUMN journey_step_id uuid REFERENCES journey_step(journey_step_id) ON DELETE SET NULL;

COMMENT ON COLUMN engine_missions.journey_id IS 'The user journey this mission follows. Agent loads journey steps as its roadmap.';
COMMENT ON COLUMN engine_stages.journey_step_id IS 'The journey step this stage corresponds to. Gives agent screen, component, action, expects.';

-- Index for lookup
CREATE INDEX idx_engine_missions_journey ON engine_missions(journey_id) WHERE journey_id IS NOT NULL;
CREATE INDEX idx_engine_stages_journey_step ON engine_stages(journey_step_id) WHERE journey_step_id IS NOT NULL;
