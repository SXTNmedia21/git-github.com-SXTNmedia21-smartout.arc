-- Admin-on-behalf PII submission: admin/owner fills in employee data.
-- Companion to submit_own_pii (self-service, 20260503120000).
-- Enforces ADR-0077 admin-fill amendment, ADR-0151 cross-workspace fail-fast,
-- L-0172 (SECURITY DEFINER + locked search_path), L-0177 (silent ws-mismatch).
-- Never logs field values — only field_group + field_count in audit.

CREATE OR REPLACE FUNCTION public.admin_submit_employee_pii(
  p_workspace_id          UUID,
  p_target_profile_id     UUID,
  p_field_group           TEXT,    -- 'identity' | 'banking' | 'address' | 'employment' (reserved)
  p_values                JSONB,
  p_high_pii_acknowledged BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor_uid        UUID;
  v_actor_profile_id UUID;
BEGIN
  -- Step 1: Auth check
  v_actor_uid := auth.uid();
  IF v_actor_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Step 2: Resolve admin profile in workspace (single query with role check)
  -- uid first, wid second — per is_admin_in_workspace(uid, wid) signature verified
  -- in 00004_rls_policies.sql:33 + fix-migration 20260515170100.
  SELECT profile_id INTO v_actor_profile_id
  FROM public.profile
  WHERE user_id       = v_actor_uid
    AND workspace_id  = p_workspace_id
    AND role          IN ('admin', 'owner')
    AND is_active     = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Caller is not admin/owner in workspace %', p_workspace_id;
  END IF;

  -- Step 3: Cross-workspace fail-fast (ADR-0151, L-0177)
  -- Must confirm target profile belongs to THIS workspace before any write.
  PERFORM 1
  FROM public.profile
  WHERE profile_id = p_target_profile_id
    AND workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target profile % not in workspace % — cross-workspace blocked',
      p_target_profile_id, p_workspace_id;
  END IF;

  -- Step 4: Høy-PII acknowledgement gate (ADR-0077 amendment §tier-table)
  -- 'identity' (personal_number) and 'banking' (bank_account) are Høy-tier.
  -- Caller MUST explicitly pass p_high_pii_acknowledged = true for these groups.
  IF p_field_group IN ('identity', 'banking')
     AND NOT COALESCE(p_high_pii_acknowledged, false) THEN
    RAISE EXCEPTION 'High-PII group % requires p_high_pii_acknowledged = true — UI confirmation mandatory (ADR-0077)',
      p_field_group;
  END IF;

  -- Step 5: Validate field_group (fail-fast before write)
  IF p_field_group NOT IN ('identity', 'banking', 'address', 'employment') THEN
    RAISE EXCEPTION 'Invalid field_group: %. Must be identity, banking, address, or employment.',
      p_field_group;
  END IF;

  -- Step 6: Write per field_group
  CASE p_field_group
    WHEN 'identity' THEN
      UPDATE public.profile
      SET personal_number = p_values ->> 'personal_number',
          updated_at      = now()
      WHERE profile_id = p_target_profile_id;

    WHEN 'banking' THEN
      UPDATE public.profile
      SET bank_account = p_values ->> 'bank_account',
          updated_at   = now()
      WHERE profile_id = p_target_profile_id;

    WHEN 'address' THEN
      UPDATE public.profile
      SET address_line_1 = p_values ->> 'address_line_1',
          address_line_2 = p_values ->> 'address_line_2',
          postal_code    = p_values ->> 'postal_code',
          city           = p_values ->> 'city',
          updated_at     = now()
      WHERE profile_id = p_target_profile_id;

    WHEN 'employment' THEN
      RAISE EXCEPTION 'employment group is not yet implemented — separate sortie (SMA-306)';
  END CASE;

  -- Step 7: Audit trail — NEVER log field values, only group + count (ADR-0077)
  INSERT INTO public.activity_trail (
    workspace_id,
    actor_id,
    event,
    action_verb,
    category,
    entity_type,
    entity_id,
    data
  ) VALUES (
    p_workspace_id,
    v_actor_profile_id,
    'payroll.admin_filled_pii',
    'admin_action',
    'compliance',
    'profile',
    p_target_profile_id,
    jsonb_build_object(
      'field_group',            p_field_group,
      'field_count',            jsonb_object_length(p_values),
      'high_pii_acknowledged',  COALESCE(p_high_pii_acknowledged, false),
      'admin_profile_id',       v_actor_profile_id
      -- NOTE: p_values intentionally excluded — no PII in audit data (ADR-0077)
    )
  );

  RETURN jsonb_build_object(
    'success',            true,
    'field_group',        p_field_group,
    'target_profile_id',  p_target_profile_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_submit_employee_pii(UUID, UUID, TEXT, JSONB, BOOLEAN)
  TO authenticated;

COMMENT ON FUNCTION public.admin_submit_employee_pii(UUID, UUID, TEXT, JSONB, BOOLEAN) IS
  'Admin-on-behalf PII submission. Caller must be admin/owner in workspace. '
  'Target must be in same workspace (cross-workspace blocked per ADR-0151). '
  'Høy-PII groups (identity, banking) require p_high_pii_acknowledged = true. '
  'Audit logs field_group + field_count only — never field values (ADR-0077).';
