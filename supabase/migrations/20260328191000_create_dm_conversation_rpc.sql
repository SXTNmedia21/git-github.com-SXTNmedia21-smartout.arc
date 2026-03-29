-- RPC to create a DM conversation with both participants in a single transaction.
-- Needed because RLS read policy requires participation, but participation
-- can't exist before the conversation is created.
--
-- Security: SECURITY DEFINER with REVOKE FROM PUBLIC.
-- Validates caller owns the creator profile and both profiles belong to workspace.
-- Idempotent: returns existing DM if one already exists between the two profiles.

CREATE OR REPLACE FUNCTION public.create_dm_conversation(
  p_workspace_id UUID,
  p_creator_profile_id UUID,
  p_target_profile_id UUID,
  p_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_caller_uid UUID;
BEGIN
  -- Auth check: caller must be authenticated
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller owns the creator profile
  IF NOT EXISTS (
    SELECT 1 FROM profile
    WHERE profile_id = p_creator_profile_id
      AND user_id = v_caller_uid
      AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: creator profile does not belong to caller or workspace';
  END IF;

  -- Verify target profile exists in the same workspace and is active
  IF NOT EXISTS (
    SELECT 1 FROM profile
    WHERE profile_id = p_target_profile_id
      AND workspace_id = p_workspace_id
      AND status IN ('active', 'trainee')
  ) THEN
    RAISE EXCEPTION 'Target profile not found in workspace';
  END IF;

  -- Check for existing DM between these two profiles (idempotent)
  SELECT cc.id INTO v_conversation_id
  FROM chat_conversation cc
  WHERE cc.type = 'dm'
    AND cc.workspace_id = p_workspace_id
    AND EXISTS (
      SELECT 1 FROM chat_participant cp
      WHERE cp.conversation_id = cc.id
        AND cp.profile_id = p_creator_profile_id
        AND cp.left_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM chat_participant cp
      WHERE cp.conversation_id = cc.id
        AND cp.profile_id = p_target_profile_id
        AND cp.left_at IS NULL
    )
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  -- Create the conversation (source_type NULL for DMs per CHECK constraint)
  INSERT INTO chat_conversation (workspace_id, type, source_type, name, created_by)
  VALUES (p_workspace_id, 'dm', NULL, p_name, p_creator_profile_id)
  RETURNING id INTO v_conversation_id;

  -- Add both participants
  INSERT INTO chat_participant (conversation_id, profile_id)
  VALUES
    (v_conversation_id, p_creator_profile_id),
    (v_conversation_id, p_target_profile_id);

  RETURN v_conversation_id;
END;
$$;

-- Lock down access: only authenticated users can call this
REVOKE ALL ON FUNCTION public.create_dm_conversation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_dm_conversation TO authenticated;

COMMENT ON FUNCTION public.create_dm_conversation IS
  'Creates a DM conversation with both participants atomically. Idempotent — returns existing DM if found. Validates caller auth and workspace membership.';
