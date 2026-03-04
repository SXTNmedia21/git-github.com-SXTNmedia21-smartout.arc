SET search_path TO public, extensions;

-- Add tuning_notes to engine_stages: per-stage coaching hints
-- that shape agent behavior without changing core instructions.
-- Add system_prompt to engine_missions: base personality prompt
-- that wraps all stage-specific prompts (e.g. Lise's voice persona).

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'engine_stages' AND column_name = 'tuning_notes') THEN
    ALTER TABLE engine_stages ADD COLUMN IF NOT EXISTS tuning_notes TEXT;
  END IF;
END $$;

COMMENT ON COLUMN engine_stages.tuning_notes
  IS 'Coaching hints injected into the prompt. Shape tone/behavior without changing instructions.';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'engine_missions' AND column_name = 'system_prompt') THEN
    ALTER TABLE engine_missions ADD COLUMN IF NOT EXISTS system_prompt TEXT;
  END IF;
END $$;

COMMENT ON COLUMN engine_missions.system_prompt
  IS 'Base system prompt for the agent personality. Wraps stage-specific content.';
