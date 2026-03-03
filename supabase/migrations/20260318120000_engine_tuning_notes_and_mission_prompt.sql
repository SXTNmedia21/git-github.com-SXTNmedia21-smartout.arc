-- Add tuning_notes to engine_stages: per-stage coaching hints
-- that shape agent behavior without changing core instructions.
-- Add system_prompt to engine_missions: base personality prompt
-- that wraps all stage-specific prompts (e.g. Lise's voice persona).

ALTER TABLE engine_stages
  ADD COLUMN tuning_notes TEXT;

COMMENT ON COLUMN engine_stages.tuning_notes
  IS 'Coaching hints injected into the prompt. Shape tone/behavior without changing instructions.';

ALTER TABLE engine_missions
  ADD COLUMN system_prompt TEXT;

COMMENT ON COLUMN engine_missions.system_prompt
  IS 'Base system prompt for the agent personality. Wraps stage-specific content.';
