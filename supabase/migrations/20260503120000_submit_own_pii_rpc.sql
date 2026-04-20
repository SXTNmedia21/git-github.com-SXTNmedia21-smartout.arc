-- Self-service PII submission: employee fills in their own data.
-- Companion to admin_submit_employee_pii (ADR-0077).
-- No admin/owner role required — actor MUST be the profile owner.

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
  v_actor_uid UUID;
  v_profile_id UUID;
BEGIN
  -- 1. Resolve actor
  v_actor_uid := auth.uid();
  IF v_actor_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Resolve caller's profile in this workspace
  SELECT profile_id INTO v_profile_id
  FROM public.profile
  WHERE user_id = v_actor_uid
    AND workspace_id = p_workspace_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user in workspace';
  END IF;

  -- 3. Validate field_group
  IF p_field_group NOT IN ('identity', 'banking', 'address') THEN
    RAISE EXCEPTION 'Invalid field_group: %. Must be identity, banking, or address.', p_field_group;
  END IF;

  -- 4. Update profile based on field_group
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

  -- 5. Audit trail
  INSERT INTO public.activity_trail (
    workspace_id, actor_id, event, action_verb, category,
    entity_type, entity_id, data
  ) VALUES (
    p_workspace_id,
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
  'Employee self-service PII submission. Actor must own the profile. Audited (ADR-0077).';
