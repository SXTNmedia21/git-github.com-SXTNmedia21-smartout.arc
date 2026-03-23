-- Channel Communications — Botsson System Profile Seed
-- Adds 'system' to profile_role enum and creates Botsson profile per workspace

-- Add system role to profile_role enum
ALTER TYPE profile_role ADD VALUE IF NOT EXISTS 'system';

-- Seed Botsson profile in each workspace that doesn't have one yet
-- No unique constraint on profile(workspace_id, user_id), so use guard query
DO $$
DECLARE
  ws RECORD;
  v_botsson_user_id uuid;
BEGIN
  -- Look up existing Botsson service user (created during infra setup)
  SELECT id INTO v_botsson_user_id FROM auth.users
    WHERE email = 'botsson@system.smartout.ai' LIMIT 1;

  IF v_botsson_user_id IS NULL THEN
    RAISE NOTICE 'Botsson service user not found in auth.users. Create it via admin API first. Skipping seed.';
    RETURN;
  END IF;

  FOR ws IN SELECT workspace_id FROM workspace LOOP
    -- Guard: only insert if no profile exists for this user+workspace
    IF NOT EXISTS (
      SELECT 1 FROM profile
      WHERE workspace_id = ws.workspace_id AND user_id = v_botsson_user_id
    ) THEN
      INSERT INTO profile (workspace_id, user_id, full_name, display_name, role, is_active)
      VALUES (ws.workspace_id, v_botsson_user_id, 'Mr. Botsson', 'Mr. Botsson', 'system', true);
    END IF;
  END LOOP;
END $$;
