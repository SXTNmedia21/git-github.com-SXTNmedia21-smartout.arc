-- ADR-0077: Secure RPC for admin submission of employee PII.
-- Admins use this to submit identity, banking, or address data on behalf of employees.
-- All writes are audited and the employee is notified.

CREATE OR REPLACE FUNCTION public.admin_submit_employee_pii(
  p_profile_id UUID,
  p_field_group TEXT,
  p_values JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_uid UUID;
  v_actor_profile_id UUID;
  v_target_workspace_id UUID;
  v_actor_role TEXT;
BEGIN
  -- 1. Resolve actor from auth.uid()
  v_actor_uid := auth.uid();
  IF v_actor_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Resolve workspace from target profile
  SELECT workspace_id INTO v_target_workspace_id
  FROM public.profile
  WHERE profile_id = p_profile_id;

  IF v_target_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Target profile not found: %', p_profile_id;
  END IF;

  -- 3. Verify actor is admin/owner in the same workspace
  SELECT profile_id, role INTO v_actor_profile_id, v_actor_role
  FROM public.profile
  WHERE user_id = v_actor_uid
    AND workspace_id = v_target_workspace_id;

  IF v_actor_role IS NULL OR v_actor_role NOT IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Insufficient permissions: actor must be admin or owner in workspace';
  END IF;

  -- 4. Validate reason (minimum 10 characters)
  IF p_reason IS NULL OR length(trim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Reason must be at least 10 characters';
  END IF;

  -- 5. Validate field_group
  IF p_field_group NOT IN ('identity', 'banking', 'address') THEN
    RAISE EXCEPTION 'Invalid field_group: %. Must be identity, banking, or address.', p_field_group;
  END IF;

  -- 6. Update profile based on field_group
  CASE p_field_group
    WHEN 'identity' THEN
      UPDATE public.profile
      SET personal_number = p_values ->> 'personal_number',
          updated_at = now()
      WHERE profile_id = p_profile_id;

    WHEN 'banking' THEN
      UPDATE public.profile
      SET bank_account = p_values ->> 'bank_account',
          updated_at = now()
      WHERE profile_id = p_profile_id;

    WHEN 'address' THEN
      UPDATE public.profile
      SET address_line1 = p_values ->> 'address_line1',
          address_line2 = p_values ->> 'address_line2',
          postal_code = p_values ->> 'postal_code',
          city = p_values ->> 'city',
          updated_at = now()
      WHERE profile_id = p_profile_id;
  END CASE;

  -- 7. Insert audit trail row
  INSERT INTO public.activity_trail (
    workspace_id, actor_id, event, action_verb, category,
    entity_type, entity_id, data
  ) VALUES (
    v_target_workspace_id,
    v_actor_profile_id,
    'admin_pii_submission.' || p_field_group,
    'updated',
    'compliance',
    'profile',
    p_profile_id,
    jsonb_build_object(
      'field_group', p_field_group,
      'reason', p_reason,
      'submitted_by', v_actor_profile_id
      -- Note: actual PII values are NOT logged for security
    )
  );

  -- 8. Insert notification for the employee
  INSERT INTO public.notification (
    workspace_id, recipient_id, title, body, icon_type, metadata
  ) VALUES (
    v_target_workspace_id,
    p_profile_id,
    'Personal data updated',
    'An administrator has updated your ' || p_field_group || ' information.',
    'info',
    jsonb_build_object(
      'type', 'pii_update',
      'field_group', p_field_group,
      'updated_by', v_actor_profile_id
    )
  );

  -- 9. Return success
  RETURN jsonb_build_object(
    'success', true,
    'field_group', p_field_group
  );
END;
$$;

-- Grant execute to authenticated users (RPC enforces admin/owner check internally)
GRANT EXECUTE ON FUNCTION public.admin_submit_employee_pii(UUID, TEXT, JSONB, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.admin_submit_employee_pii(UUID, TEXT, JSONB, TEXT) IS
  'Secure admin RPC for submitting employee PII (identity, banking, address). Audited and notified (ADR-0077).';
