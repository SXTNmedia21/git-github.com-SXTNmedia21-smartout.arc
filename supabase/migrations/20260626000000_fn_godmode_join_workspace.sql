-- Migration: fn_godmode_join_workspace
-- Created: 2026-06-25 (re-stamped 20260626000000 on cherry-pick into development
--                       from hotfix/admin-godmode-and-goto-workspace, where it
--                       lived at 20260625130000 — collides with
--                       channel_is_active_column on this branch.)
-- ADR: ADR-0410 — Godmode Workspace Auto-Join
--
-- Exposes an RPC that lets a godmode platform admin auto-join any workspace
-- as an admin profile. Idempotent: returns existing profile_id if already a
-- member. SECURITY DEFINER so the INSERT can bypass RLS on profile.
--
-- Security contract:
--   1. Asserts auth.uid() has is_godmode=true — raises exception if not.
--   2. Resolves display_name from user_identity.first_name (falls back to 'Godmode Admin').
--   3. Resolves company_id from workspace.company_id (nullable OK for profile insert).
--   4. Inserts activity_trail row for audit (ADR-0410 mandate).
--
-- Depends on: public.profile, public.user_identity, public.workspace,
--             public.activity_trail (all pre-existing).

-- ─── RPC ──────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_godmode_join_workspace(
  p_workspace_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id   uuid;
  v_is_godmode  boolean;
  v_first_name  text;
  v_display_name text;
  v_company_id  uuid;
  v_profile_id  uuid;
  v_was_existing boolean := false;
BEGIN
  -- 1. Resolve caller identity
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'fn_godmode_join_workspace: not authenticated';
  END IF;

  -- 2. Assert godmode (fail closed — no fallback)
  SELECT is_godmode, first_name
    INTO v_is_godmode, v_first_name
    FROM public.user_identity
   WHERE user_id = v_caller_id;

  IF NOT FOUND OR v_is_godmode IS NOT TRUE THEN
    RAISE EXCEPTION 'fn_godmode_join_workspace: caller is not a godmode user';
  END IF;

  -- 3. Resolve workspace → company_id for profile insert
  SELECT company_id
    INTO v_company_id
    FROM public.workspace
   WHERE workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fn_godmode_join_workspace: workspace % not found', p_workspace_id;
  END IF;

  v_display_name := COALESCE(NULLIF(TRIM(v_first_name), ''), 'Godmode Admin');

  -- 4. Idempotent — return existing profile_id if already a member
  SELECT profile_id
    INTO v_profile_id
    FROM public.profile
   WHERE user_id = v_caller_id
     AND workspace_id = p_workspace_id
   LIMIT 1;

  IF FOUND THEN
    v_was_existing := true;
  ELSE
    -- 5. Insert new admin profile
    INSERT INTO public.profile (
      user_id,
      workspace_id,
      company_id,
      profile_code,
      role,
      status,
      display_name,
      source,
      created_at,
      updated_at
    ) VALUES (
      v_caller_id,
      p_workspace_id,
      v_company_id,
      -- Short random code — same pattern as onboarding RPC
      substring(md5(random()::text) from 1 for 6),
      'admin',
      'active',
      v_display_name,
      'godmode',
      now(),
      now()
    )
    RETURNING profile_id INTO v_profile_id;
  END IF;

  -- 6. Audit trail insert (ADR-0410 mandate)
  --    actor_id is NULL because godmode users have no profile in the target workspace
  --    at the time of the access check (activity_trail.actor_id FK is nullable).
  INSERT INTO public.activity_trail (
    workspace_id,
    actor_id,
    actor_kind,
    event,
    action_verb,
    category,
    entity_type,
    entity_id,
    data
  ) VALUES (
    p_workspace_id,
    NULL,
    'godmode',
    'godmode.workspace_joined',
    CASE WHEN v_was_existing THEN 'accessed' ELSE 'created' END,
    'security',
    'profile',
    v_profile_id,
    jsonb_build_object(
      'godmode_user_id', v_caller_id::text,
      'workspace_id',    p_workspace_id::text,
      'profile_id',      v_profile_id::text,
      'was_existing',    v_was_existing,
      'display_name',    v_display_name
    )
  );

  RETURN v_profile_id;
END;
$$;

-- Grant execution to authenticated users only.
-- The SECURITY DEFINER body will reject non-godmode callers.
REVOKE EXECUTE ON FUNCTION public.fn_godmode_join_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_godmode_join_workspace(uuid) TO authenticated;

COMMENT ON FUNCTION public.fn_godmode_join_workspace(uuid) IS
  'ADR-0410: Godmode platform admin auto-join workspace as admin profile. '
  'Idempotent (returns existing profile_id). Asserts is_godmode=true on caller. '
  'Emits activity_trail row for every call.';
