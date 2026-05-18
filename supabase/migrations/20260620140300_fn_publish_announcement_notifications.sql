-- M3: Fan-out helper for announcement notifications.
-- Called inline by publish_announcement_atomic RPC (ADR-0369).
-- Fan-out failure MUST NOT roll back the published message (EXCEPTION handler).
-- ADR-0369, ADR-0370, ADR-0371.

CREATE OR REPLACE FUNCTION public.fn_publish_announcement_notifications(
  p_message_id         uuid,
  p_channel_id         uuid,
  p_workspace_id       uuid,
  p_sender_id          uuid,
  p_content            text,
  p_tier               public.announcement_tier,
  p_visibility_scope   public.channel_message_visibility,
  p_target_profile_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_priority   smallint;
  v_mode       notification_mode;
  v_channels   notification_channel[];
BEGIN
  -- Tier → (mode, priority, channels) mapping per V2 spec §4.1.
  -- Uses ONLY existing notification_mode values: community/work (no 'social' or 'elevated' added).
  -- external tier reuses 'work' mode + priority=2 + email channel (ADR-0369 §4.1).
  CASE p_tier
    WHEN 'social'   THEN
      v_priority := 0;
      v_mode     := 'community';
      v_channels := ARRAY['push']::notification_channel[];
    WHEN 'work'     THEN
      v_priority := 1;
      v_mode     := 'work';
      v_channels := ARRAY['push']::notification_channel[];
    WHEN 'external' THEN
      v_priority := 2;
      v_mode     := 'work';
      v_channels := ARRAY['push', 'email']::notification_channel[];
    ELSE
      -- Safe default: work mode if new tier value added in future without updating this function.
      v_priority := 1;
      v_mode     := 'work';
      v_channels := ARRAY['push']::notification_channel[];
  END CASE;

  INSERT INTO public.notification_outbox (
    workspace_id,
    recipient_id,
    mode,
    priority,
    title,
    body,
    action_url,
    metadata,
    allowed_channels
    -- status defaults to 'pending'; scheduled_for defaults to now()
  )
  SELECT
    p_workspace_id,
    cmem.profile_id,                                            -- recipient_id (verified: notification_outbox.recipient_id column, 00006_notification_engine.sql:31-67)
    v_mode,
    v_priority,
    LEFT(SPLIT_PART(p_content, E'\n', 1), 140),                -- title: first line of content, max 140 chars
    LEFT(p_content, 500),                                       -- body: full content preview, max 500 chars
    '/dashboard/komm/nyheter#m-' || p_message_id::text,
    jsonb_build_object(
      'event_key',           'announcement.published',
      'entity_type',         'channel_message',
      'entity_id',           p_message_id,
      'channel_id',          p_channel_id,
      'announcement_tier',   p_tier::text
    ),
    v_channels
  FROM public.channel_member cmem
  WHERE cmem.channel_id = p_channel_id
    AND cmem.left_at IS NULL
    AND cmem.profile_id <> p_sender_id                          -- exclude sender from notifications
    AND NOT cmem.is_muted                                       -- is_muted verified 2026-05-16: column exists on channel_member
    AND (
      p_visibility_scope = 'all_members'
      OR p_target_profile_ids @> ARRAY[cmem.profile_id]
    );

EXCEPTION WHEN OTHERS THEN
  -- Fan-out failure MUST NOT roll back the published message.
  -- Notification delivery is a best-effort side-effect; message atomicity is non-negotiable.
  -- Delivery failures are retryable; message publish is not.
  RAISE WARNING 'fn_publish_announcement_notifications failed for message %: %', p_message_id, SQLERRM;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_publish_announcement_notifications(uuid, uuid, uuid, uuid, text, public.announcement_tier, public.channel_message_visibility, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_publish_announcement_notifications(uuid, uuid, uuid, uuid, text, public.announcement_tier, public.channel_message_visibility, uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_publish_announcement_notifications IS
  'Fan-out helper for publish_announcement_atomic RPC (ADR-0369). Maps announcement tier to notification priority/mode/channels and inserts into notification_outbox for all eligible channel members. EXCEPTION handler ensures fan-out failure never rolls back the parent message.';
