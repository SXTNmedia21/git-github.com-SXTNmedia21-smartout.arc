-- Atomic conversation turn append for engine_sessions.
-- Avoids read-modify-write race conditions when concurrent messages arrive.
-- Called by Stage Engine's appendConversationTurn() in agent-session.ts.

CREATE OR REPLACE FUNCTION append_conversation_turn(
  p_session_id UUID,
  p_turn JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE engine_sessions
  SET
    collected_data = jsonb_set(
      COALESCE(collected_data, '{}'::jsonb),
      '{conversation}',
      COALESCE(collected_data -> 'conversation', '[]'::jsonb) || p_turn
    ),
    updated_at = now()
  WHERE id = p_session_id;

  IF NOT FOUND THEN
    RAISE WARNING 'append_conversation_turn: session % not found', p_session_id;
  END IF;
END;
$$;

-- Only service_role can call this (Stage Engine uses service role key)
REVOKE ALL ON FUNCTION append_conversation_turn(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION append_conversation_turn(UUID, JSONB) TO service_role;
