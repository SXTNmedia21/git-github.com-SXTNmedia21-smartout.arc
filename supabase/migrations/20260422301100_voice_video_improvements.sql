-- Voice/Video improvements: video columns, better indexes, other_member_profile_id in RPC
-- Branch: feat/livekit-webhook-deployment

--------------------------------------------------------------------------------
-- S1: Add video-specific columns to channel_call_participant
--------------------------------------------------------------------------------

ALTER TABLE channel_call_participant
  ADD COLUMN IF NOT EXISTS is_camera_on boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_screen_sharing boolean NOT NULL DEFAULT false;

-- Partial index: "who is screen sharing in this call right now"
CREATE INDEX IF NOT EXISTS idx_call_participant_screen_active
  ON channel_call_participant(call_session_id)
  WHERE is_screen_sharing = true AND left_at IS NULL;

--------------------------------------------------------------------------------
-- S2: Better composite index for webhook queries
-- Replaces: idx_call_session_active ON (channel_id) WHERE status = 'active'
-- New: includes workspace_id and started_at DESC for the exact query pattern
--------------------------------------------------------------------------------

DROP INDEX IF EXISTS idx_call_session_active;

CREATE INDEX idx_call_session_active
  ON channel_call_session(channel_id, workspace_id, started_at DESC)
  WHERE status = 'active';

--------------------------------------------------------------------------------
-- C1: Add other_member_profile_id to get_my_channels RPC
-- Must DROP first because return type changes (added column)
--------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS get_my_channels(uuid);

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
  last_message_sender_avatar text,
  other_member_profile_id uuid,
  other_member_name text,
  other_member_avatar text
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH caller AS (
    SELECT profile_id FROM profile
    WHERE user_id = auth.uid() AND workspace_id = p_workspace_id
    LIMIT 1
  ),
  my_channels AS (
    SELECT cm.channel_id, cm.last_read_message_id
    FROM channel_member cm
    WHERE cm.profile_id = (SELECT profile_id FROM caller)
      AND cm.left_at IS NULL
  ),
  member_counts AS (
    SELECT channel_id, count(*) AS cnt
    FROM channel_member
    WHERE left_at IS NULL
      AND channel_id IN (SELECT channel_id FROM my_channels)
    GROUP BY channel_id
  ),
  unread AS (
    SELECT mc.channel_id, count(msg.id) AS cnt
    FROM my_channels mc
    JOIN channel_message msg ON msg.channel_id = mc.channel_id
      AND msg.deleted_at IS NULL
      AND msg.delivery_mode = 'timeline'
      AND (mc.last_read_message_id IS NULL
        OR msg.created_at > (
          SELECT created_at FROM channel_message WHERE id = mc.last_read_message_id
        ))
    GROUP BY mc.channel_id
  ),
  last_msgs AS (
    SELECT DISTINCT ON (m.channel_id)
      m.channel_id, m.content, m.created_at, m.sender_id
    FROM channel_message m
    WHERE m.deleted_at IS NULL
      AND m.delivery_mode = 'timeline'
      AND m.channel_id IN (SELECT channel_id FROM my_channels)
    ORDER BY m.channel_id, m.created_at DESC
  ),
  dm_other AS (
    SELECT DISTINCT ON (cm.channel_id)
      cm.channel_id, p.profile_id, p.display_name, p.avatar_url
    FROM channel_member cm
    JOIN channel c ON c.id = cm.channel_id AND c.channel_type = 'direct'
    JOIN profile p ON p.profile_id = cm.profile_id
    WHERE cm.channel_id IN (SELECT channel_id FROM my_channels)
      AND cm.profile_id != (SELECT profile_id FROM caller)
      AND cm.left_at IS NULL
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
    COALESCE(mc2.cnt, 0) AS member_count,
    COALESCE(u.cnt, 0) AS unread_count,
    lm.content AS last_message_content,
    lm.created_at AS last_message_at,
    sp.display_name AS last_message_sender_name,
    sp.avatar_url AS last_message_sender_avatar,
    dmo.profile_id AS other_member_profile_id,
    dmo.display_name AS other_member_name,
    dmo.avatar_url AS other_member_avatar
  FROM channel c
  JOIN my_channels mc ON mc.channel_id = c.id
  LEFT JOIN member_counts mc2 ON mc2.channel_id = c.id
  LEFT JOIN unread u ON u.channel_id = c.id
  LEFT JOIN last_msgs lm ON lm.channel_id = c.id
  LEFT JOIN profile sp ON sp.profile_id = lm.sender_id
  LEFT JOIN dm_other dmo ON dmo.channel_id = c.id
  WHERE c.is_archived = false
  ORDER BY COALESCE(lm.created_at, c.created_at) DESC;
$$;
