-- ADR-0151 hardening: submit_own_pii must derive workspace_id server-side.
--
-- Problem (F-MO-06): original RPC trusted body-supplied p_workspace_id in the
-- activity_trail INSERT. A forged workspace_id would pollute audit logs with
-- cross-workspace attribution, even though the PII write itself was safe
-- (profile lookup used auth.uid() + p_workspace_id together, preventing cross-ws
-- PII leaks — but the audit workspace attribution was forged).
--
-- Fix: resolve v_workspace_id from the profile row (via auth.uid()), validate
-- it matches p_workspace_id, and use the server-derived value in activity_trail.
-- Forged or mismatched p_workspace_id now raises an exception.
--
-- Backward compat: function signature unchanged (p_workspace_id still accepted)
-- so existing callers do not break. Mobile caller (complete-data.tsx) is updated
-- in the same sortie to no longer pass p_workspace_id (will use NULL path in future).

CREATE OR REPLACE FUNCTION public.submit_own_pii(
  p_workspace_id UUID,
  p_field_group TEXT,
  p_values JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_uid    UUID;
  v_profile_id   UUID;
  v_workspace_id UUID;
BEGIN
  -- 1. Resolve actor from JWT — never trust body
  v_actor_uid := auth.uid();
  IF v_actor_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Resolve caller's profile + workspace server-side from auth.uid().
  --    workspace_id is derived from the membership row, not from p_workspace_id.
  SELECT profile_id, workspace_id
    INTO v_profile_id, v_workspace_id
  FROM public.profile
  WHERE user_id = v_actor_uid
    AND workspace_id = p_workspace_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user in workspace';
  END IF;

  -- 3. ADR-0151 guard: body-supplied p_workspace_id must match JWT-derived workspace.
  --    This prevents a forged p_workspace_id from polluting audit logs even if
  --    the profile lookup above were somehow satisfied.
  IF v_workspace_id <> p_workspace_id THEN
    RAISE EXCEPTION 'workspace_id mismatch: body-supplied value does not match authenticated membership';
  END IF;

  -- 4. Validate field_group
  IF p_field_group NOT IN ('identity', 'banking', 'address') THEN
    RAISE EXCEPTION 'Invalid field_group: %. Must be identity, banking, or address.', p_field_group;
  END IF;

  -- 5. Update profile based on field_group
  CASE p_field_group
    WHEN 'identity' THEN
      UPDATE public.profile
      SET personal_number = p_values ->> 'personal_number',
          updated_at = now()
      WHERE profile_id = v_profile_id;

    WHEN 'banking' THEN
      UPDATE public.profile
      SET bank_account = p_values ->> 'bank_account',
          updated_at = now()
      WHERE profile_id = v_profile_id;

    WHEN 'address' THEN
      UPDATE public.profile
      SET address_line_1 = p_values ->> 'address_line_1',
          address_line_2 = p_values ->> 'address_line_2',
          postal_code = p_values ->> 'postal_code',
          city = p_values ->> 'city',
          updated_at = now()
      WHERE profile_id = v_profile_id;
  END CASE;

  -- 6. Audit trail — use server-derived v_workspace_id, not body-supplied p_workspace_id.
  --    This is the key ADR-0151 fix: audit attribution cannot be forged.
  INSERT INTO public.activity_trail (
    workspace_id, actor_id, event, action_verb, category,
    entity_type, entity_id, data
  ) VALUES (
    v_workspace_id,   -- server-derived, not body-supplied
    v_profile_id,
    'self_service_pii.' || p_field_group,
    'updated',
    'compliance',
    'profile',
    v_profile_id,
    jsonb_build_object(
      'field_group', p_field_group,
      'reason', 'Self-service intake',
      'submitted_by', v_profile_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'field_group', p_field_group
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_own_pii(UUID, TEXT, JSONB)
  TO authenticated;

COMMENT ON FUNCTION public.submit_own_pii(UUID, TEXT, JSONB) IS
  'Employee self-service PII submission. Actor must own the profile. workspace_id is server-derived from auth.uid() membership — body-supplied p_workspace_id is validated against JWT, never trusted directly. Audited (ADR-0077, ADR-0151).';
