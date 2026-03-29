SET search_path TO public, extensions;

-- ============================================
-- botsson-session: Standard mission for all Botsson voice sessions.
-- No stages. Free mode. The persona engine on the client side
-- controls who the agent IS via context.persona_prompt.
-- This mission is the blank canvas — personality comes from the frontend.
-- ============================================

INSERT INTO engine_missions (id, name, description, mode, workspace_id, is_active)
VALUES (
  'botsson-session',
  'Botsson Session',
  'Standard free-form voice session for the Botsson agent. Personality and identity are injected via context.persona_prompt from the client.',
  'free',
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;
