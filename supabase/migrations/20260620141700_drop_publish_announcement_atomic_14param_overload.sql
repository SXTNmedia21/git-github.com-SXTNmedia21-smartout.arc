-- 20260620141700_drop_publish_announcement_atomic_14param_overload.sql
-- =======================================================================
-- Drop the obsolete 14-param overload of publish_announcement_atomic.
--
-- Migration 140400 (M4) created publish_announcement_atomic with 14 params.
-- Migration 141300 (M13) added the celebration branch via a NEW function
-- with 16 params (added p_celebration_kind + p_celebration_date). M16's
-- CREATE OR REPLACE only touched the 16-param signature, leaving M4's
-- 14-param overload orphaned.
--
-- Result: PostgREST PGRST203 (ambiguous overload) on every 14-param call —
-- both overloads match the JSON body, PostgREST cannot pick.
--
-- Surfaced by V2 council fixup integration tests (3/4 failing).
-- The 16-param overload is canonical (handles all cases including
-- celebration with NULL defaults for celebration_kind + celebration_date).
-- =======================================================================

DROP FUNCTION IF EXISTS public.publish_announcement_atomic(
  uuid,                                  -- p_workspace_id
  uuid,                                  -- p_actor_profile_id
  uuid,                                  -- p_channel_id
  text,                                  -- p_content
  public.channel_message_visibility,     -- p_visibility_scope
  uuid[],                                -- p_target_profile_ids
  jsonb,                                 -- p_system_data
  public.announcement_kind,              -- p_kind
  public.announcement_tier,              -- p_tier
  text[],                                -- p_tags
  public.announcement_link_type,         -- p_linked_entity_type
  uuid,                                  -- p_linked_entity_id
  boolean,                               -- p_tier_overridden
  uuid                                   -- p_client_message_id
);

-- The 16-param overload from M13 remains as the sole canonical signature.
-- COMMENT preserved on that overload (set in M13/M16).
