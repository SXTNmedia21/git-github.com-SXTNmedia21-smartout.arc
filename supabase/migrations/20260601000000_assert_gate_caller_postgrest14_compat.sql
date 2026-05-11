-- assert_gate_caller — PostgREST 14 compat fix
--
-- Original migration (20260512100100_assert_gate_caller.sql) reads
-- `request.jwt.claim.role` as an individual GUC. That GUC is set by
-- PostgREST ≤ 11. Supabase CLI 2.98.2 (PostgREST 14) sets the composite
-- GUC `request.jwt.claims` (a JSONB blob) and stops setting the per-claim
-- legacy GUCs. Service-role calls hit the auth-mismatch branch and raise
-- "gate call requires authenticated caller or service_role" — every gate
-- write fails.
--
-- This migration replaces the function with a JWT claims reader that:
--   1. Tries the PostgREST 14 composite GUC first (`request.jwt.claims`)
--   2. Falls back to the per-claim legacy GUC for older PostgREST runtimes
--
-- Contract is unchanged. Only the source of `role` differs.
--
-- Refs:
--   - HANDOFF-botsson-harness-e2e-test.md §8 (debt discovery 2026-05-11)
--   - PostgREST changelog: composite claims introduced in v9, legacy GUCs
--     removed in v12+. Supabase CLI bundles v14 as of 2.98.2.

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
  v_jwt_claims_raw  TEXT;
  v_jwt_role        TEXT;
BEGIN
  -- PostgREST 14: read composite `request.jwt.claims` (JSONB blob)
  -- Fallback to legacy per-claim GUC for older PostgREST
  v_jwt_claims_raw := current_setting('request.jwt.claims', true);
  IF v_jwt_claims_raw IS NOT NULL AND v_jwt_claims_raw <> '' THEN
    v_jwt_role := (v_jwt_claims_raw::jsonb) ->> 'role';
  ELSE
    v_jwt_role := current_setting('request.jwt.claim.role', true);
  END IF;

  v_is_service_role := (v_jwt_role = 'service_role');
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

COMMENT ON FUNCTION public.assert_gate_caller(UUID) IS
  'Verify caller identity for SECURITY DEFINER gate writes. PostgREST 14 compat: reads request.jwt.claims (JSONB) first, falls back to request.jwt.claim.role (legacy). Refs ADR-0091 WP2; debt closed in HANDOFF-botsson-harness-e2e-test.md §8.';
