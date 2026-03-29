-- Migration: 20260328200100_update_finalize_rpc_professions.sql
-- Description: Extend finalize_onboarding_workspace to create positions
-- linked to professions when onboarding completes.
-- Positions are mapped to departments by matching profession name to department name.
-- Falls back to the first department in the workspace if no name match found.

CREATE OR REPLACE FUNCTION public.finalize_onboarding_workspace(
  p_workspace_id uuid,
  p_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_profile_id uuid;
  v_user_id uuid;
  v_season_id uuid;
  v_dept jsonb;
  v_department_id uuid;
  v_team jsonb;
  v_proc jsonb;
  v_proc_name text;
  v_policy_id uuid;
  v_protocol_id uuid;
  v_company_name text;
  v_loc jsonb;
  v_location_id uuid;
  v_zone jsonb;
  v_loc_type text;
  v_industry text;
  v_prof RECORD;
  v_pos RECORD;
  v_profession_id UUID;
  v_dept_id UUID;
BEGIN
  v_company_name := p_data->>'name';

  -- Resolve industry: empty/null -> 'restaurant' (most common default)
  v_industry := NULLIF(trim(p_data->>'industry'), '');
  IF v_industry IS NULL OR v_industry NOT IN (
    SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'industry'
  ) THEN
    v_industry := 'restaurant';
  END IF;

  -- 1. Get company_id and profile_id from workspace
  SELECT w.company_id INTO v_company_id
  FROM public.workspace w
  WHERE w.workspace_id = p_workspace_id;

  -- Check workspace actually exists (not just NULL company)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace % not found', p_workspace_id;
  END IF;

  SELECT p.profile_id, p.user_id INTO v_profile_id, v_user_id
  FROM public.profile p
  WHERE p.workspace_id = p_workspace_id
  LIMIT 1;

  -- 1b. Create company if workspace was provisioned without one
  IF v_company_id IS NULL THEN
    INSERT INTO public.company (
      name,
      legal_name,
      org_number,
      industry,
      website,
      daglig_leder,
      nace_description,
      nace_code
    ) VALUES (
      COALESCE(v_company_name, 'Unnamed Company'),
      COALESCE(p_data->>'legalName', v_company_name, 'Unnamed Company'),
      NULLIF(p_data->>'orgNumber', ''),
      v_industry::public.industry,
      p_data->>'website',
      p_data->>'ceo',
      COALESCE(NULLIF(p_data->>'industry', ''), v_industry),
      NULLIF(p_data->>'industryCode', '')
    ) RETURNING company_id INTO v_company_id;

    -- Link workspace to company
    UPDATE public.workspace SET company_id = v_company_id WHERE workspace_id = p_workspace_id;

    -- Create company_member for the owner
    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.company_member (company_id, user_id, role)
      VALUES (v_company_id, v_user_id, 'owner');
    END IF;
  ELSE
    -- 2. Update existing Company with full data
    UPDATE public.company SET
      name = COALESCE(v_company_name, name),
      legal_name = COALESCE(p_data->>'legalName', v_company_name, legal_name),
      org_number = COALESCE(NULLIF(p_data->>'orgNumber', ''), org_number),
      industry = v_industry::public.industry,
      website = COALESCE(p_data->>'website', website),
      daglig_leder = COALESCE(p_data->>'ceo', daglig_leder),
      nace_description = COALESCE(NULLIF(p_data->>'industry', ''), v_industry, nace_description),
      nace_code = COALESCE(NULLIF(p_data->>'industryCode', ''), nace_code)
    WHERE company_id = v_company_id;
  END IF;

  -- 3. Update Workspace — promote from onboarding
  UPDATE public.workspace SET
    name = COALESCE(v_company_name, name),
    contract_status = 'none',
    short_description = COALESCE(p_data->>'summary', short_description),
    brand_color = COALESCE(p_data->>'brandColor', brand_color),
    communication_tone = COALESCE(p_data->>'communicationTone', communication_tone)
  WHERE workspace_id = p_workspace_id;

  -- 4. Create Season (now with start_date and end_date)
  INSERT INTO public.season (
    workspace_id, name, slug, description, season_type,
    start_date, end_date, status, created_by
  ) VALUES (
    p_workspace_id,
    COALESCE(p_data->>'seasonName', 'Sesong 1'),
    lower(regexp_replace(COALESCE(p_data->>'seasonName', 'sesong-1'), '[^a-zA-Z0-9]+', '-', 'g')),
    'Initial season created during onboarding',
    COALESCE((p_data->>'seasonType')::public.season_type, 'default'),
    CASE WHEN p_data->>'seasonStartDate' IS NOT NULL AND p_data->>'seasonStartDate' != ''
         THEN (p_data->>'seasonStartDate')::date ELSE NULL END,
    CASE WHEN p_data->>'seasonEndDate' IS NOT NULL AND p_data->>'seasonEndDate' != ''
         THEN (p_data->>'seasonEndDate')::date ELSE NULL END,
    'active',
    v_profile_id
  ) RETURNING season_id INTO v_season_id;

  -- 5. Insert Departments and Teams
  IF p_data->'departments' IS NOT NULL THEN
    FOR v_dept IN SELECT * FROM jsonb_array_elements(p_data->'departments')
    LOOP
      INSERT INTO public.department (workspace_id, name, slug, description)
      VALUES (
        p_workspace_id,
        v_dept->>'name',
        lower(regexp_replace(v_dept->>'name', '[^a-zA-Z0-9]+', '-', 'g')),
        v_dept->>'description'
      ) RETURNING department_id INTO v_department_id;

      IF v_dept->'teams' IS NOT NULL THEN
        FOR v_team IN SELECT * FROM jsonb_array_elements(v_dept->'teams')
        LOOP
          INSERT INTO public.team (workspace_id, department_id, name, slug)
          VALUES (
            p_workspace_id,
            v_department_id,
            v_team->>'name',
            lower(regexp_replace(v_team->>'name', '[^a-zA-Z0-9]+', '-', 'g'))
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 6. Insert Positions (if provided)
  -- Positions are typically per-department, but may also be workspace-level
  -- The onboarding wizard may send positions at the department level

  -- 7. Create Locations and Zones
  IF p_data->'locations' IS NOT NULL THEN
    FOR v_loc IN SELECT * FROM jsonb_array_elements(p_data->'locations')
    LOOP
      v_loc_type := COALESCE(v_loc->>'type', 'main');
      IF v_loc_type = 'satellite' THEN
        v_loc_type := 'other';
      END IF;
      IF v_loc_type NOT IN ('main', 'outdoor', 'kitchen', 'event', 'storage', 'other') THEN
        v_loc_type := 'other';
      END IF;

      INSERT INTO public.location (
        workspace_id, name, slug, location_type
      ) VALUES (
        p_workspace_id,
        v_loc->>'name',
        lower(regexp_replace(v_loc->>'name', '[^a-zA-Z0-9]+', '-', 'g')),
        v_loc_type::public.location_type
      ) RETURNING location_id INTO v_location_id;

      IF v_loc->'zones' IS NOT NULL THEN
        FOR v_zone IN SELECT * FROM jsonb_array_elements(v_loc->'zones')
        LOOP
          IF jsonb_typeof(v_zone) = 'string' THEN
            INSERT INTO public.zone (workspace_id, location_id, name, slug)
            VALUES (
              p_workspace_id,
              v_location_id,
              trim(both '"' from v_zone::text),
              lower(regexp_replace(trim(both '"' from v_zone::text), '[^a-zA-Z0-9]+', '-', 'g'))
            );
          ELSE
            INSERT INTO public.zone (workspace_id, location_id, name, slug)
            VALUES (
              p_workspace_id,
              v_location_id,
              v_zone->>'name',
              lower(regexp_replace(v_zone->>'name', '[^a-zA-Z0-9]+', '-', 'g'))
            );
          END IF;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 8. Create Base Policy & Protocol for Procedures
  IF p_data->'procedures' IS NOT NULL AND jsonb_array_length(p_data->'procedures') > 0 THEN
    INSERT INTO public.policy (
      workspace_id, season_id, policy_type, policy_scope, name, statement, created_by
    ) VALUES (
      p_workspace_id, v_season_id, 'operational', 'workspace',
      'Standard Operating Procedures', 'Base procedures for the season', v_profile_id
    ) RETURNING policy_id INTO v_policy_id;

    INSERT INTO public.protocol (
      policy_id, workspace_id, name, description, owner_profile_id, created_by
    ) VALUES (
      v_policy_id, p_workspace_id, 'Base Protocol',
      'Operational procedures defined during onboarding', v_profile_id, v_profile_id
    ) RETURNING protocol_id INTO v_protocol_id;

    FOR v_proc IN SELECT * FROM jsonb_array_elements(p_data->'procedures')
    LOOP
      IF jsonb_typeof(v_proc) = 'string' THEN
        v_proc_name := trim(both '"' from v_proc::text);
      ELSE
        v_proc_name := COALESCE(v_proc->>'title', v_proc->>'name');
      END IF;

      IF v_proc_name IS NOT NULL AND v_proc_name != '' THEN
        INSERT INTO public.procedure (
          protocol_id, name, description, procedure_type
        ) VALUES (
          v_protocol_id,
          v_proc_name,
          CASE
            WHEN jsonb_typeof(v_proc) = 'object' THEN
              COALESCE(v_proc->>'description', 'Created during onboarding')
            ELSE 'Created during onboarding'
          END,
          'standard'
        );
      END IF;
    END LOOP;
  END IF;

  -- 9. Create positions linked to professions
  -- NOTE: authority_level lives on profile (per-person), NOT on position.
  -- Tries to match profession name to department name (e.g. "Kjøkken" → "Kjøkken" dept).
  -- Falls back to first department in workspace if no match found.
  IF p_data->'professions' IS NOT NULL THEN
    FOR v_prof IN SELECT * FROM jsonb_array_elements(p_data->'professions')
    LOOP
      v_profession_id := (v_prof.value->>'professionId')::UUID;

      IF v_prof.value->'positions' IS NOT NULL THEN
        FOR v_pos IN SELECT * FROM jsonb_array_elements(v_prof.value->'positions')
        LOOP
          -- Find matching department by profession name, fall back to first department
          SELECT d.department_id INTO v_dept_id
          FROM public.department d
          JOIN public.profession p ON p.profession_id = v_profession_id
          WHERE d.workspace_id = p_workspace_id
            AND lower(d.name) = lower(p.name)
          LIMIT 1;

          IF v_dept_id IS NULL THEN
            SELECT department_id INTO v_dept_id
            FROM public.department
            WHERE workspace_id = p_workspace_id
            ORDER BY created_at LIMIT 1;
          END IF;

          INSERT INTO public.position (
            workspace_id, department_id, name, slug, profession_id
          ) VALUES (
            p_workspace_id,
            v_dept_id,
            v_pos.value->>'name',
            COALESCE(
              v_pos.value->>'slug',
              lower(regexp_replace(v_pos.value->>'name', '[^a-zA-Z0-9]+', '-', 'g'))
            ),
            v_profession_id
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 10. Create default agent profile
  INSERT INTO public.agent_profile (workspace_id)
  VALUES (p_workspace_id)
  ON CONFLICT (workspace_id) DO NOTHING;

  RETURN p_workspace_id;
END;
$$;
