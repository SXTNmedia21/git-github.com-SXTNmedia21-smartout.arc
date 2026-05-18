-- M4: publish_announcement_atomic RPC — atomic announcement publish.
-- Inserts channel_message + announcement_meta + notification fan-out in one transaction.
-- No SET CONSTRAINTS ALL DEFERRED — plain AFTER INSERT trigger guarded via M5.
-- ADR-0369 (Option B), ADR-0370 (extend communication capability), ADR-0371 (preserve {title,body} API).

CREATE OR REPLACE FUNCTION public.publish_announcement_atomic(
  p_workspace_id        uuid,
  p_actor_profile_id    uuid,
  p_channel_id          uuid,
  p_content             text,                                         -- pre-concatenated: title + "\n" + body (ADR-0371)
  p_visibility_scope    public.channel_message_visibility DEFAULT 'all_members',
  p_target_profile_ids  uuid[]                            DEFAULT NULL,
  p_system_data         jsonb                             DEFAULT '{}',
  p_kind                public.announcement_kind          DEFAULT 'general',
  p_tier                public.announcement_tier          DEFAULT 'work',
  p_tags                text[]                            DEFAULT '{}',
  p_linked_entity_type  public.announcement_link_type     DEFAULT NULL,
  p_linked_entity_id    uuid                              DEFAULT NULL,
  p_tier_overridden     boolean                           DEFAULT false,
  p_client_message_id   uuid                              DEFAULT gen_random_uuid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id      uuid;
  v_is_service_role boolean;
BEGIN
  -- L-0177 fail-fast: channel must belong to this workspace before any mutation.
  -- Prevents cross-workspace channel injection via a forged p_channel_id.
  IF NOT EXISTS (
    SELECT 1 FROM public.channel
    WHERE id = p_channel_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'CHANNEL_WORKSPACE_MISMATCH: channel % not in workspace %',
      p_channel_id, p_workspace_id;
  END IF;

  -- Detect service-role bypass (agent server-side actor resolution per ADR-0151).
  v_is_service_role := COALESCE(
    current_setting('request.jwt.claim.role', true) = 'service_role',
    false
  );

  -- Anti-spoof: in user-JWT context, actor must equal auth.uid().
  -- Service-role bypass exists for server actions resolving actor_id server-side (ADR-0151).
  IF NOT v_is_service_role AND p_actor_profile_id <> auth.uid() THEN
    RAISE EXCEPTION 'IDENTITY_MISMATCH — actor_profile_id must equal auth.uid() in user JWT context';
  END IF;

  -- Defense-in-depth: caller already gated by capability layer (ADR-0370).
  -- RPC re-checks manager+ in workspace (is_manager_in_workspace from M0).
  IF NOT public.is_manager_in_workspace(p_actor_profile_id, p_workspace_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED — actor must be manager+ in workspace to publish announcements';
  END IF;

  -- Step 1: Insert parent channel_message.
  -- sender_id column verified (NOT sender_profile_id) — database.types.ts confirms column name.
  INSERT INTO public.channel_message (
    channel_id,
    workspace_id,
    sender_id,
    content,
    message_type,
    visibility_scope,
    target_profile_ids,
    system_data,
    client_message_id
  ) VALUES (
    p_channel_id,
    p_workspace_id,
    p_actor_profile_id,
    p_content,
    'announcement',
    p_visibility_scope,
    p_target_profile_ids,
    p_system_data,
    p_client_message_id
  )
  RETURNING id INTO v_message_id;

  -- Step 2: Insert sidecar (same transaction — ADR-0369 atomicity guarantee).
  -- announcement_meta exists before notification fan-out fires below.
  INSERT INTO public.announcement_meta (
    message_id,
    workspace_id,
    kind,
    tier,
    tags,
    linked_entity_type,
    linked_entity_id,
    tier_overridden
  ) VALUES (
    v_message_id,
    p_workspace_id,
    p_kind,
    p_tier,
    p_tags,
    p_linked_entity_type,
    p_linked_entity_id,
    p_tier_overridden
  );

  -- Step 3: Inline fan-out.
  -- The existing AFTER INSERT trigger is guarded to skip announcements (migration M5).
  -- Fan-out for announcements lives ONLY here via fn_publish_announcement_notifications.
  PERFORM public.fn_publish_announcement_notifications(
    v_message_id,
    p_channel_id,
    p_workspace_id,
    p_actor_profile_id,
    p_content,
    p_tier,
    p_visibility_scope,
    COALESCE(p_target_profile_ids, ARRAY[]::uuid[])
  );

  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_announcement_atomic(
  uuid, uuid, uuid, text,
  public.channel_message_visibility, uuid[], jsonb,
  public.announcement_kind, public.announcement_tier, text[],
  public.announcement_link_type, uuid, boolean, uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.publish_announcement_atomic(
  uuid, uuid, uuid, text,
  public.channel_message_visibility, uuid[], jsonb,
  public.announcement_kind, public.announcement_tier, text[],
  public.announcement_link_type, uuid, boolean, uuid
) TO authenticated, service_role;

COMMENT ON FUNCTION public.publish_announcement_atomic IS
  'Atomic announcement publish RPC (ADR-0369). Inserts channel_message + announcement_meta sidecar + notification fan-out in a single PostgreSQL transaction. Capability key: communication / actionType: publish_announcement_atomic (ADR-0370). Content is pre-concatenated title+"\n"+body per ADR-0371. IDENTITY_MISMATCH + PERMISSION_DENIED guards per ADR-0151.';
