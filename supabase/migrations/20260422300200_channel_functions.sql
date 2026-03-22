-- Channel Communications — Database Functions
-- create_channel() SECURITY DEFINER + read-model RPCs

--------------------------------------------------------------------------------
-- create_channel(): all user-created channels go through this function
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_channel(
  p_workspace_id uuid,
  p_channel_type public.comm_channel_type,
  p_name text DEFAULT NULL,
  p_created_by uuid DEFAULT NULL,
  p_member_profile_ids uuid[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = '' AS $$
DECLARE
  v_channel_id uuid;
  v_pair_hash text;
  v_pid uuid;
  v_creator_role text;
BEGIN
  -- Permission checks by type
  IF p_channel_type = 'custom' THEN
    SELECT role::text INTO v_creator_role FROM public.profile
      WHERE profile_id = p_created_by AND workspace_id = p_workspace_id;
    IF v_creator_role NOT IN ('manager', 'admin', 'owner') THEN
      RAISE EXCEPTION 'Only manager/admin/owner can create custom channels';
    END IF;

  ELSIF p_channel_type = 'direct' THEN
    -- Validate exactly 2 distinct members
    IF p_member_profile_ids IS NULL OR array_length(p_member_profile_ids, 1) != 2 THEN
      RAISE EXCEPTION 'Direct channels require exactly 2 members';
    END IF;
    IF p_member_profile_ids[1] = p_member_profile_ids[2] THEN
      RAISE EXCEPTION 'Direct channel members must be distinct';
    END IF;
    -- Caller must be one of the two members
    IF p_created_by != p_member_profile_ids[1] AND p_created_by != p_member_profile_ids[2] THEN
      RAISE EXCEPTION 'Caller must be a member of the direct channel';
    END IF;
    -- Both must belong to same workspace
    IF NOT EXISTS (
      SELECT 1 FROM public.profile WHERE profile_id = p_member_profile_ids[1] AND workspace_id = p_workspace_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.profile WHERE profile_id = p_member_profile_ids[2] AND workspace_id = p_workspace_id
    ) THEN
      RAISE EXCEPTION 'Both members must belong to the workspace';
    END IF;
    -- Compute pair hash (sorted for determinism)
    IF p_member_profile_ids[1]::text < p_member_profile_ids[2]::text THEN
      v_pair_hash := p_member_profile_ids[1]::text || ':' || p_member_profile_ids[2]::text;
    ELSE
      v_pair_hash := p_member_profile_ids[2]::text || ':' || p_member_profile_ids[1]::text;
    END IF;
    -- Idempotent: return existing (even if archived — reactivate)
    SELECT id INTO v_channel_id FROM public.channel
      WHERE workspace_id = p_workspace_id AND direct_pair_hash = v_pair_hash;
    IF v_channel_id IS NOT NULL THEN
      UPDATE public.channel SET is_archived = false, updated_at = now()
        WHERE id = v_channel_id AND is_archived = true;
      RETURN jsonb_build_object('channel_id', v_channel_id, 'created', false);
    END IF;

  ELSIF p_channel_type IN ('department', 'team', 'session', 'skill', 'news') THEN
    RAISE EXCEPTION 'Channel type % can only be created by system triggers or admin functions', p_channel_type;
  END IF;

  -- Insert channel
  INSERT INTO public.channel (workspace_id, channel_type, name, created_by, direct_pair_hash)
  VALUES (p_workspace_id, p_channel_type, p_name, p_created_by, v_pair_hash)
  RETURNING id INTO v_channel_id;

  -- Add creator as admin
  IF p_created_by IS NOT NULL THEN
    INSERT INTO public.channel_member (channel_id, workspace_id, profile_id, role)
    VALUES (v_channel_id, p_workspace_id, p_created_by, 'admin')
    ON CONFLICT (channel_id, profile_id) DO NOTHING;
  END IF;

  -- Add specified members
  IF p_member_profile_ids IS NOT NULL THEN
    FOREACH v_pid IN ARRAY p_member_profile_ids LOOP
      INSERT INTO public.channel_member (channel_id, workspace_id, profile_id, role)
      VALUES (v_channel_id, p_workspace_id, v_pid, 'member')
      ON CONFLICT (channel_id, profile_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('channel_id', v_channel_id, 'created', true);
END;
$$;

--------------------------------------------------------------------------------
-- Read-Model RPCs
--------------------------------------------------------------------------------

-- get_my_channels(): channel list for current user with last message preview + unread count
CREATE OR REPLACE FUNCTION get_my_channels(p_workspace_id uuid)
RETURNS TABLE (
  channel_id uuid,
  workspace_id uuid,
  channel_type comm_channel_type,
  name text,
  description text,
  avatar_url text,
  is_read_only boolean,
  is_archived boolean,
  audio_policy channel_audio_policy,
  video_policy channel_video_policy,
  member_count bigint,
  unread_count bigint,
  last_message_content text,
  last_message_at timestamptz,
  last_message_sender_name text,
  last_message_sender_avatar text
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH caller AS (
    SELECT profile_id FROM profile
    WHERE user_id = auth.uid() AND workspace_id = p_workspace_id
    LIMIT 1
  )
  SELECT
    c.id AS channel_id,
    c.workspace_id,
    c.channel_type,
    c.name,
    c.description,
    c.avatar_url,
    c.is_read_only,
    c.is_archived,
    c.audio_policy,
    c.video_policy,
    (SELECT count(*) FROM channel_member cm2
      WHERE cm2.channel_id = c.id AND cm2.left_at IS NULL) AS member_count,
    (SELECT count(*) FROM channel_message msg
      WHERE msg.channel_id = c.id
        AND msg.deleted_at IS NULL
        AND msg.delivery_mode = 'timeline'
        AND (cm.last_read_message_id IS NULL
          OR msg.created_at > (SELECT created_at FROM channel_message WHERE id = cm.last_read_message_id))
    ) AS unread_count,
    lm.content AS last_message_content,
    lm.created_at AS last_message_at,
    sp.display_name AS last_message_sender_name,
    sp.avatar_url AS last_message_sender_avatar
  FROM channel c
  JOIN channel_member cm ON cm.channel_id = c.id
    AND cm.profile_id = (SELECT profile_id FROM caller) AND cm.left_at IS NULL
  LEFT JOIN LATERAL (
    SELECT content, created_at, sender_id FROM channel_message
    WHERE channel_id = c.id AND deleted_at IS NULL AND delivery_mode = 'timeline'
    ORDER BY created_at DESC LIMIT 1
  ) lm ON true
  LEFT JOIN profile sp ON sp.profile_id = lm.sender_id
  WHERE c.is_archived = false
  ORDER BY COALESCE(lm.created_at, c.created_at) DESC;
$$;

-- get_channel_messages(): cursor-based pagination with sender, reactions, attachments
CREATE OR REPLACE FUNCTION get_channel_messages(
  p_channel_id uuid,
  p_cursor timestamptz DEFAULT now(),
  p_limit int DEFAULT 50
) RETURNS TABLE (
  message_id uuid,
  channel_id uuid,
  sender_id uuid,
  sender_name text,
  sender_avatar text,
  sender_role text,
  content text,
  message_type channel_message_type,
  origin_type channel_origin_type,
  visibility_scope channel_message_visibility,
  reply_to_id uuid,
  reply_to_content text,
  reply_to_sender_name text,
  system_data jsonb,
  is_pinned boolean,
  edited_at timestamptz,
  deleted_at timestamptz,
  client_message_id uuid,
  created_at timestamptz,
  reactions jsonb,
  attachments jsonb
) LANGUAGE sql STABLE SECURITY INVOKER AS $$
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
    ), '[]'::jsonb) AS attachments
  FROM channel_message m
  JOIN profile sp ON sp.profile_id = m.sender_id
  LEFT JOIN channel_message rt ON rt.id = m.reply_to_id
  LEFT JOIN profile rtp ON rtp.profile_id = rt.sender_id
  WHERE m.channel_id = p_channel_id
    AND m.created_at < p_cursor
    AND m.delivery_mode = 'timeline'
  ORDER BY m.created_at DESC
  LIMIT p_limit;
$$;

-- get_unread_counts(): unread counts per channel for current user
CREATE OR REPLACE FUNCTION get_unread_counts(p_workspace_id uuid)
RETURNS TABLE (channel_id uuid, unread_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH caller AS (
    SELECT profile_id FROM profile
    WHERE user_id = auth.uid() AND workspace_id = p_workspace_id
    LIMIT 1
  )
  SELECT
    cm.channel_id,
    count(msg.id) AS unread_count
  FROM channel_member cm
  JOIN channel c ON c.id = cm.channel_id AND c.is_archived = false
  LEFT JOIN channel_message msg ON msg.channel_id = cm.channel_id
    AND msg.deleted_at IS NULL
    AND msg.delivery_mode = 'timeline'
    AND (cm.last_read_message_id IS NULL
      OR msg.created_at > (SELECT created_at FROM channel_message WHERE id = cm.last_read_message_id))
  WHERE cm.profile_id = (SELECT profile_id FROM caller) AND cm.left_at IS NULL
  GROUP BY cm.channel_id
  HAVING count(msg.id) > 0;
$$;
