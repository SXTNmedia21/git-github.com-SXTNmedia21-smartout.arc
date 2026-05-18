-- M6: Extend get_channel_messages RPC return shape with announcement_meta columns.
-- Additive-only: adds 5 nullable columns for announcement classification.
-- Non-announcement messages return NULL for these columns.
-- Mobile parity: apps/mobile/src/hooks/queries/use-channel-messages.ts
-- consumes the row shape — additive change is safe (ADR-0133).
-- PostgreSQL cannot change RETURNS TABLE shape with CREATE OR REPLACE;
-- must DROP + CREATE to extend the return type.
-- ADR-0369, ADR-0370, ADR-0371.

DROP FUNCTION IF EXISTS public.get_channel_messages(uuid, timestamptz, int);

CREATE OR REPLACE FUNCTION public.get_channel_messages(
  p_channel_id uuid,
  p_cursor timestamptz DEFAULT now(),
  p_limit int DEFAULT 50
) RETURNS TABLE (
  -- Original columns (unchanged — no renames, no removals per ADR-0371)
  message_id             uuid,
  channel_id             uuid,
  sender_id              uuid,
  sender_name            text,
  sender_avatar          text,
  sender_role            text,
  content                text,
  message_type           channel_message_type,
  origin_type            channel_origin_type,
  visibility_scope       channel_message_visibility,
  reply_to_id            uuid,
  reply_to_content       text,
  reply_to_sender_name   text,
  system_data            jsonb,
  is_pinned              boolean,
  edited_at              timestamptz,
  deleted_at             timestamptz,
  client_message_id      uuid,
  created_at             timestamptz,
  reactions              jsonb,
  attachments            jsonb,
  -- New announcement columns (NULL for non-announcement messages)
  announcement_kind      public.announcement_kind,
  announcement_tier      public.announcement_tier,
  announcement_tags      text[],
  announcement_link_type public.announcement_link_type,
  announcement_link_id   uuid
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    m.id AS message_id,
    m.channel_id,
    m.sender_id,
    sp.display_name AS sender_name,
    sp.avatar_url AS sender_avatar,
    sp.role::text AS sender_role,
    m.content,
    m.message_type,
    m.origin_type,
    m.visibility_scope,
    m.reply_to_id,
    rt.content AS reply_to_content,
    rtp.display_name AS reply_to_sender_name,
    m.system_data,
    m.is_pinned,
    m.edited_at,
    m.deleted_at,
    m.client_message_id,
    m.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('emoji', r.emoji, 'profile_id', r.profile_id))
      FROM channel_message_reaction r WHERE r.message_id = m.id
    ), '[]'::jsonb) AS reactions,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'file_type', a.file_type, 'url', a.url,
        'filename', a.filename, 'size_bytes', a.size_bytes
      ))
      FROM channel_message_attachment a WHERE a.message_id = m.id
    ), '[]'::jsonb) AS attachments,
    -- Announcement sidecar columns (NULL when no announcement_meta row exists)
    am.kind             AS announcement_kind,
    am.tier             AS announcement_tier,
    am.tags             AS announcement_tags,
    am.linked_entity_type AS announcement_link_type,
    am.linked_entity_id   AS announcement_link_id
  FROM channel_message m
  JOIN profile sp ON sp.profile_id = m.sender_id
  LEFT JOIN channel_message rt ON rt.id = m.reply_to_id
  LEFT JOIN profile rtp ON rtp.profile_id = rt.sender_id
  LEFT JOIN public.announcement_meta am ON am.message_id = m.id
  WHERE m.channel_id = p_channel_id
    AND m.created_at < p_cursor
    AND m.delivery_mode = 'timeline'
  ORDER BY m.created_at DESC
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.get_channel_messages(uuid, timestamptz, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_channel_messages(uuid, timestamptz, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_channel_messages IS
  'Cursor-based pagination with sender, reactions, attachments, and announcement metadata. Returns 5 nullable announcement columns (kind/tier/tags/link_type/link_id) via LEFT JOIN announcement_meta. NULL for non-announcement messages. Mobile safe — additive change (ADR-0133). ADR-0369, ADR-0371.';
