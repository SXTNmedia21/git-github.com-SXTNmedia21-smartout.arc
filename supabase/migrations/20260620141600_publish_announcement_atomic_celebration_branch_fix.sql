-- 20260620141600_publish_announcement_atomic_celebration_branch_fix.sql
--
-- WHY: V2 council Blocker 1 (P0 silent data loss).
--
-- Migration 141300 inserted celebration_publication with:
--   profile_id = p_actor_profile_id   ← the bot/system actor
--
-- UNIQUE constraint is (workspace_id, profile_id, celebration_kind, celebration_date).
-- Under cron processing N employees same day, employee #1 publishes successfully.
-- Employees #2..N each collide on (workspace_id, BOT_profile_id, 'birthday', today) and
-- get the ON CONFLICT DO NOTHING path — the RPC returns NULL → "already published" skip.
-- Only employee #1 ever gets celebrated. P0 silent data loss.
--
-- FIX: celebration_publication.profile_id = p_linked_entity_id (the celebrated person,
-- per ADR-0372 §Q9 design intent). The UNIQUE constraint now correctly tracks
-- one-celebration-per-person-per-day, not one-celebration-per-bot-per-day.
--
-- EF call shape (supabase/functions/publish-birthday-celebrations/index.ts) already passes:
--   p_actor_profile_id = actorProfileId   (the bot/system profile)
--   p_linked_entity_id = member.profile_id (the celebrated person)
-- No EF changes needed — only the RPC body changes here.
--
-- ADR-0372 §Q9 (idempotency design intent), ADR-0369 (RPC atomicity), ADR-0151 (actor identity).
-- V2 council REJECT Blocker 1 (2026-05-18).

CREATE OR REPLACE FUNCTION public.publish_announcement_atomic(
  p_workspace_id        uuid,
  p_actor_profile_id    uuid,
  p_channel_id          uuid,
  p_content             text,
  p_visibility_scope    public.channel_message_visibility DEFAULT 'all_members',
  p_target_profile_ids  uuid[]                            DEFAULT NULL,
  p_system_data         jsonb                             DEFAULT '{}',
  p_kind                public.announcement_kind          DEFAULT 'general',
  p_tier                public.announcement_tier          DEFAULT 'work',
  p_tags                text[]                            DEFAULT '{}',
  p_linked_entity_type  public.announcement_link_type     DEFAULT NULL,
  p_linked_entity_id    uuid                              DEFAULT NULL,
  p_tier_overridden     boolean                           DEFAULT false,
  p_client_message_id   uuid                              DEFAULT gen_random_uuid(),
  -- Celebration-branch parameters (ignored for non-celebration kinds).
  p_celebration_kind    text                              DEFAULT NULL,
  p_celebration_date    date                              DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message_id              uuid;
  v_is_service_role         boolean;
  v_celebration_pub_id      uuid;
  v_auto_celebrate          boolean;
  v_skip_publish            boolean := false;
BEGIN
  -- L-0177 fail-fast: channel must belong to this workspace before any mutation.
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
  IF NOT v_is_service_role AND p_actor_profile_id <> auth.uid() THEN
    RAISE EXCEPTION 'IDENTITY_MISMATCH — actor_profile_id must equal auth.uid() in user JWT context';
  END IF;

  -- ── Celebration branch (service-role only) ────────────────────────────────
  IF p_kind = 'celebration' THEN
    -- Celebration path is cron-only. JWT callers cannot initiate celebrations.
    IF NOT v_is_service_role THEN
      RAISE EXCEPTION 'CELEBRATION_SERVICE_ROLE_ONLY: kind=celebration requires service_role caller (ADR-0372 §Agent Impact)';
    END IF;

    -- L-0177: config row must exist (backfill migration seeds all existing workspaces).
    SELECT auto_celebrate_birthdays
    INTO v_auto_celebrate
    FROM public.workspace_celebration_config
    WHERE workspace_id = p_workspace_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'CELEBRATION_CONFIG_MISSING: workspace_celebration_config row not found for workspace %. '
        'Run backfill migration 20260620141400.', p_workspace_id;
    END IF;

    -- Per-workspace opt-out check.
    IF NOT v_auto_celebrate THEN
      -- Log skip to activity_trail for audit symmetry.
      INSERT INTO public.activity_trail (
        event, action_verb, category, entity_type, entity_id, entity_label,
        actor_id, workspace_id, source, data
      ) VALUES (
        'celebration.skipped_workspace_disabled',
        'skipped',
        'communication',
        'workspace_celebration_config',
        p_workspace_id,
        'Workspace celebration disabled',
        p_actor_profile_id,
        p_workspace_id,
        'rpc',
        jsonb_build_object(
          'workspace_id',       p_workspace_id,
          'actor_profile_id',   p_actor_profile_id,
          'celebrated_profile', p_linked_entity_id,
          'celebration_kind',   p_celebration_kind,
          'celebration_date',   p_celebration_date
        )
      );
      RETURN NULL;
    END IF;

    -- Idempotency guard: insert celebration_publication for the CELEBRATED PERSON
    -- (p_linked_entity_id), NOT the actor/bot (p_actor_profile_id).
    --
    -- V2 council Blocker 1 fix: UNIQUE constraint is
    -- (workspace_id, profile_id, celebration_kind, celebration_date).
    -- profile_id must be the celebrated person so each person gets exactly one
    -- celebration per day, regardless of how many bot profiles exist per workspace.
    -- Using p_actor_profile_id here caused all employees #2..N to collide on the
    -- bot's profile_id and be silently skipped — only employee #1 ever celebrated.
    INSERT INTO public.celebration_publication (
      workspace_id, profile_id, celebration_kind, celebration_date
    )
    SELECT
      p_workspace_id,
      p_linked_entity_id,                              -- ← celebrated person, NOT bot
      COALESCE(p_celebration_kind, 'birthday'),
      COALESCE(p_celebration_date, CURRENT_DATE)
    ON CONFLICT (workspace_id, profile_id, celebration_kind, celebration_date)
    DO NOTHING
    RETURNING id INTO v_celebration_pub_id;

    IF v_celebration_pub_id IS NULL THEN
      -- Already published today — idempotency skip.
      INSERT INTO public.activity_trail (
        event, action_verb, category, entity_type, entity_id, entity_label,
        actor_id, workspace_id, source, data
      ) VALUES (
        'celebration.skipped_already_published',
        'skipped',
        'communication',
        'celebration_publication',
        p_workspace_id,
        'Birthday already published today',
        p_actor_profile_id,
        p_workspace_id,
        'rpc',
        jsonb_build_object(
          'workspace_id',       p_workspace_id,
          'actor_profile_id',   p_actor_profile_id,
          'celebrated_profile', p_linked_entity_id,
          'celebration_kind',   p_celebration_kind,
          'celebration_date',   p_celebration_date
        )
      );
      RETURN NULL;
    END IF;

    -- Celebration is new for today. Continue to publish path below
    -- (skip the manager gate — service-role celebration path bypasses it).
    v_skip_publish := false; -- flag: we DO want to publish, just skip manager check

  ELSE
    -- ── Standard path (non-celebration) ────────────────────────────────────

    -- Defense-in-depth: re-check manager+ in workspace.
    IF NOT public.is_manager_in_workspace(p_actor_profile_id, p_workspace_id) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED — actor must be manager+ in workspace to publish announcements';
    END IF;

  END IF;

  -- ── Shared publish path ───────────────────────────────────────────────────
  -- Reached by: (a) non-celebration after manager check, (b) celebration after idempotency check.

  -- Step 1: Insert parent channel_message.
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

  -- Step 3: Update celebration_publication.message_id now that we have v_message_id.
  IF v_celebration_pub_id IS NOT NULL THEN
    UPDATE public.celebration_publication
    SET message_id = v_message_id
    WHERE id = v_celebration_pub_id;
  END IF;

  -- Step 4: Inline fan-out.
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
  public.announcement_link_type, uuid, boolean, uuid,
  text, date
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.publish_announcement_atomic(
  uuid, uuid, uuid, text,
  public.channel_message_visibility, uuid[], jsonb,
  public.announcement_kind, public.announcement_tier, text[],
  public.announcement_link_type, uuid, boolean, uuid,
  text, date
) TO authenticated, service_role;

-- Also update grants for the original 14-parameter signature (backward compat).
GRANT EXECUTE ON FUNCTION public.publish_announcement_atomic(
  uuid, uuid, uuid, text,
  public.channel_message_visibility, uuid[], jsonb,
  public.announcement_kind, public.announcement_tier, text[],
  public.announcement_link_type, uuid, boolean, uuid
) TO authenticated, service_role;

COMMENT ON FUNCTION public.publish_announcement_atomic(
  uuid, uuid, uuid, text,
  public.channel_message_visibility, uuid[], jsonb,
  public.announcement_kind, public.announcement_tier, text[],
  public.announcement_link_type, uuid, boolean, uuid,
  text, date
) IS
  'Atomic announcement publish RPC (ADR-0369 + ADR-0372 celebration branch). '
  'For kind=celebration: service-role only, verifies workspace config, idempotency via '
  'celebration_publication UNIQUE (workspace_id, profile_id=celebrated_person, kind, date). '
  'profile_id is the CELEBRATED PERSON (p_linked_entity_id), NOT the actor/bot — '
  'fixes V2 council Blocker 1 where bot profile_id caused all but employee #1 to be skipped. '
  'Returns NULL to signal skip (already published / disabled). '
  'For all other kinds: manager+ JWT required (defense-in-depth). '
  'Inserts channel_message + announcement_meta sidecar + notification fan-out in a single transaction.';
