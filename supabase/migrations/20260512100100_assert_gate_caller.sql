-- assert_gate_caller — verify caller identity before SECURITY DEFINER gate writes
-- ADR-0091 WP2 prerequisite. Raises SQLSTATE 42501 on mismatch.
--
-- Contract:
--   - JWT-authenticated caller: p_actor_profile_id MUST belong to auth.uid().
--     (Caller claims an identity that is not theirs → 42501.)
--   - service_role caller: p_actor_profile_id MUST be non-null (service scripts
--     acting on behalf of a user must supply the user's profile id).
--     (Service role bypass requires explicit actor attribution → 42501 if null.)
--
-- Profile join column: `public.profile.user_id` → `public.user_identity.user_id`
-- (which is the same UUID as `auth.users.id`). See 00001_identity_tables.sql.

CREATE OR REPLACE FUNCTION public.assert_gate_caller(p_actor_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_service_role BOOLEAN;
  v_caller_uid      UUID;
  v_profile_user_id UUID;
BEGIN
  v_is_service_role := COALESCE(current_setting('request.jwt.claim.role', true), '') = 'service_role';
  v_caller_uid      := auth.uid();

  IF v_is_service_role THEN
    -- Service role MUST supply an actor (no anonymous writes to gate tables)
    IF p_actor_profile_id IS NULL THEN
      RAISE EXCEPTION 'service_role gate call requires p_actor_profile_id'
        USING ERRCODE = '42501';
    END IF;
    RETURN;
  END IF;

  -- Authenticated user path: actor must map back to auth.uid()
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'gate call requires authenticated caller or service_role'
      USING ERRCODE = '42501';
  END IF;

  IF p_actor_profile_id IS NULL THEN
    RAISE EXCEPTION 'gate call requires p_actor_profile_id'
      USING ERRCODE = '42501';
  END IF;

  SELECT user_id INTO v_profile_user_id
    FROM public.profile
   WHERE profile_id = p_actor_profile_id;

  IF v_profile_user_id IS NULL THEN
    RAISE EXCEPTION 'p_actor_profile_id does not match any profile'
      USING ERRCODE = '42501';
  END IF;

  IF v_profile_user_id != v_caller_uid THEN
    RAISE EXCEPTION 'p_actor_profile_id does not belong to caller'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_gate_caller(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.assert_gate_caller(UUID) IS
  'ADR-0091 WP2: verify SECURITY DEFINER gate caller identity. Raises SQLSTATE '
  '42501 on mismatch or missing actor. Required before any gate_evaluation / '
  'change_proposal write. Joins profile.profile_id → profile.user_id → auth.uid().';
