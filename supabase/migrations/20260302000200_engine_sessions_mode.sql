SET search_path TO public, extensions;

-- 20260302000200_engine_sessions_mode.sql
-- Adds mode column to engine_sessions to distinguish mission vs agent sessions.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'engine_sessions' AND column_name = 'mode') THEN
    ALTER TABLE engine_sessions ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'mission'
    CHECK (mode IN ('mission', 'agent'));
  END IF;
END $$;

DO $$ BEGIN
  ALTER TABLE engine_sessions ALTER COLUMN mission_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_mission_mode_requires_mission') THEN
    ALTER TABLE engine_sessions ADD CONSTRAINT chk_mission_mode_requires_mission CHECK (mode = 'agent' OR mission_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_engine_sessions_agent_profile
  ON engine_sessions (workspace_id, profile_id, created_at DESC)
  WHERE mode = 'agent';
