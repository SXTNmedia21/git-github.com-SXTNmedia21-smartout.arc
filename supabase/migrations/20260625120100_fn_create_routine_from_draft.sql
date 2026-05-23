-- 20260625120100_fn_create_routine_from_draft.sql
-- Re-timestamped from 20260623101000 to post-governance_status type definition
-- (20260624130000_routine_brownfield_governance.sql) per L-0042 dep-order fix.
-- Atomic commit RPC for photo-extracted routine drafts (Procedure Engine 2B).
-- Single-txn: optional in-txn location create → procedure → routine →
--   N procedure_steps → routine_team → session_hooks.
-- SECURITY DEFINER, service_role-only. Workspace fail-fast on every supplied id.
--
-- Step 0 deviations vs spec template (verified against live DB \d, not just migration files):
--   - location: live DB has no 'city' column (present in migration source but not live).
--     Has slug NOT NULL (generated from name), no country_code column.
--     Has 'source' column NOT NULL with CHECK (operational|bubble_migration|v3_engine);
--     Botsson-created locations use source='v3_engine'. Removed city, added slug+source.
--   - procedure: workspace_id column present (added by 20260623100000 brownfield migration).
--     protocol_id nullable since same migration. workspace_id added to INSERT.
--   - routine_team: has workspace_id NOT NULL (added 20260622100000). Added to INSERT.
--   - session_hook_type enum: 'scheduled' + 'open' both confirmed valid members.
--   - session_hook UNIQUE: (workspace_id, department_id, hook_type) confirmed.
--   - trigger_type enum: 'scheduled' + 'event' confirmed.

CREATE OR REPLACE FUNCTION public.fn_create_routine_from_draft(
  p_workspace_id      uuid,
  p_actor_profile_id  uuid,
  p_routine_name      text,
  p_trigger_type      public.trigger_type,
  p_trigger_config    jsonb,
  p_steps             jsonb,
  p_source_reference  text,
  p_location_id       uuid    DEFAULT NULL,
  p_new_location      jsonb   DEFAULT NULL,
  p_team_ids          uuid[]  DEFAULT '{}',
  p_protocol_id       uuid    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_location_id   uuid := p_location_id;
  v_procedure_id  uuid;
  v_routine_id    uuid;
  v_gov           public.governance_status;
  v_hook_type     public.session_hook_type;
  v_step          jsonb;
  v_order         int := 0;
  v_team          uuid;
  v_dept          uuid;
BEGIN
  -- 0. Actor workspace membership guard.
  IF NOT EXISTS (SELECT 1 FROM public.profile
                 WHERE profile_id = p_actor_profile_id AND workspace_id = p_workspace_id) THEN
    RAISE EXCEPTION 'actor_wrong_workspace';
  END IF;

  -- 1. Protocol integrity check (optional; if supplied must belong to workspace).
  IF p_protocol_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.protocol
                   WHERE protocol_id = p_protocol_id AND workspace_id = p_workspace_id) THEN
      RAISE EXCEPTION 'protocol_wrong_workspace';
    END IF;
    v_gov := 'attached';
  ELSE
    v_gov := 'unassigned';
  END IF;

  -- 2. Location resolution: existing (validated) or inline create.
  IF v_location_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.location
                   WHERE location_id = v_location_id AND workspace_id = p_workspace_id) THEN
      RAISE EXCEPTION 'location_wrong_workspace';
    END IF;
  ELSIF p_new_location IS NOT NULL THEN
    IF (p_new_location->>'name') IS NULL THEN
      RAISE EXCEPTION 'new_location_missing_name';
    END IF;
    -- Slug: lowercase-kebab from name (mirrors onboarding RPC pattern).
    -- source='v3_engine' satisfies CHECK(operational|bubble_migration|v3_engine).
    INSERT INTO public.location (workspace_id, name, slug, address, is_active, source)
    VALUES (
      p_workspace_id,
      p_new_location->>'name',
      lower(regexp_replace(p_new_location->>'name', '[^a-zA-Z0-9]+', '-', 'g')),
      p_new_location->>'address',    -- nullable
      true,
      'v3_engine'
    )
    RETURNING location_id INTO v_location_id;
  ELSE
    RAISE EXCEPTION 'location_required';
  END IF;

  -- 3. Map trigger_type → session_hook_type.
  v_hook_type := CASE WHEN p_trigger_type = 'scheduled' THEN 'scheduled'::public.session_hook_type
                      ELSE 'open'::public.session_hook_type END;

  -- 4. Create procedure (workspace_id required because protocol_id may be NULL).
  INSERT INTO public.procedure (protocol_id, workspace_id, name, description, procedure_type)
  VALUES (p_protocol_id, p_workspace_id, p_routine_name, 'Opprettet fra bilde (Botsson).', 'standard')
  RETURNING procedure_id INTO v_procedure_id;

  -- 5. Create routine.
  INSERT INTO public.routine (
    protocol_id, procedure_id, workspace_id, name,
    trigger_type, trigger_config, executor_type,
    location_id, assigned_to_type, assigned_to_ref,
    control_frequency, governance_status, created_via, source_reference
  )
  VALUES (
    p_protocol_id, v_procedure_id, p_workspace_id, p_routine_name,
    p_trigger_type, p_trigger_config, 'human',
    v_location_id, 'profile', p_actor_profile_id,
    'never', v_gov, 'image', p_source_reference
  )
  RETURNING routine_id INTO v_routine_id;

  -- 6. Create procedure steps.
  FOR v_step IN SELECT * FROM jsonb_array_elements(p_steps) LOOP
    v_order := v_order + 1;
    INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes)
    VALUES (
      v_procedure_id,
      v_step->>'title',
      COALESCE(v_step->>'description', ''),
      v_order,
      COALESCE((v_step->>'is_required')::boolean, true),
      NULLIF(v_step->>'estimated_minutes', '')::int
    );
  END LOOP;

  -- 7. Attach teams (workspace integrity check per team).
  FOREACH v_team IN ARRAY p_team_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM public.team WHERE team_id = v_team AND workspace_id = p_workspace_id) THEN
      RAISE EXCEPTION 'team_wrong_workspace';
    END IF;
    INSERT INTO public.routine_team (routine_id, team_id, workspace_id)
    VALUES (v_routine_id, v_team, p_workspace_id) ON CONFLICT DO NOTHING;
  END LOOP;

  -- 8. Wire session_hooks for every department that uses this location.
  FOR v_dept IN
    SELECT department_id FROM public.department_location
    WHERE location_id = v_location_id AND workspace_id = p_workspace_id
  LOOP
    INSERT INTO public.session_hook (workspace_id, department_id, hook_type, linked_routine_id)
    VALUES (p_workspace_id, v_dept, v_hook_type, v_routine_id)
    ON CONFLICT (workspace_id, department_id, hook_type)
    DO UPDATE SET linked_routine_id = EXCLUDED.linked_routine_id;
  END LOOP;

  RETURN jsonb_build_object(
    'ok', true,
    'routine_id', v_routine_id,
    'procedure_id', v_procedure_id,
    'location_id', v_location_id,
    'governance_status', v_gov
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_create_routine_from_draft(
  uuid,uuid,text,public.trigger_type,jsonb,jsonb,text,uuid,jsonb,uuid[],uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_routine_from_draft(
  uuid,uuid,text,public.trigger_type,jsonb,jsonb,text,uuid,jsonb,uuid[],uuid) TO service_role;
