-- Migration: 20260227120000_activate_workspace_multidept.sql
-- Description: Updates activate_workspace_v3 to support cross-department teams and handle season active toggles for departments.

CREATE OR REPLACE FUNCTION public.activate_workspace_v3(
  p_user_id uuid,
  p_data jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_workspace_id uuid;
  v_profile_id uuid;
  v_season_id uuid;
  v_loc jsonb;
  v_location_id uuid;
  v_dept jsonb;
  v_department_id uuid;
  v_team jsonb;
  v_proc jsonb;
  v_policy_id uuid;
  v_protocol_id uuid;
  v_company_name text;
BEGIN
  v_company_name := p_data->>'name';
  
  -- 1. Create Company
  INSERT INTO public.company (
    name, legal_name, org_number, industry, website, daglig_leder, nace_description
  ) VALUES (
    v_company_name, 
    v_company_name, 
    'PENDING-' || substring(md5(random()::text) from 1 for 6), 
    p_data->>'industry', 
    p_data->>'website', 
    p_data->>'ceo',
    p_data->>'industry'
  )
  RETURNING company_id INTO v_company_id;

  -- 2. Create Workspace
  INSERT INTO public.workspace (
    company_id, name, slug, brand_color, communication_tone, short_description
  ) VALUES (
    v_company_id, 
    v_company_name, 
    lower(regexp_replace(v_company_name, '[^a-zA-Z0-9]+', '-', 'g')),
    p_data->>'brandColor',
    p_data->>'communicationTone',
    p_data->>'concept'
  )
  RETURNING workspace_id INTO v_workspace_id;

  -- 3. Create Company Member
  INSERT INTO public.company_member (user_id, company_id, role)
  VALUES (p_user_id, v_company_id, 'owner');

  -- 4. Create Profile
  INSERT INTO public.profile (
    user_id, workspace_id, company_id, profile_code, role, status, display_name
  ) VALUES (
    p_user_id, v_workspace_id, v_company_id, substring(md5(random()::text) from 1 for 6),
    'admin', 'active', 'Workspace Owner'
  ) RETURNING profile_id INTO v_profile_id;

  -- 5. Create Season
  INSERT INTO public.season (
    workspace_id, name, slug, description, season_type, created_by
  ) VALUES (
    v_workspace_id,
    p_data->>'seasonName',
    lower(regexp_replace(p_data->>'seasonName', '[^a-zA-Z0-9]+', '-', 'g')),
    'Initial season created during onboarding',
    (p_data->>'seasonType')::public.season_type,
    v_profile_id
  ) RETURNING season_id INTO v_season_id;

  -- 6. Insert Locations
  IF p_data->'locations' IS NOT NULL THEN
    FOR v_loc IN SELECT * FROM jsonb_array_elements(p_data->'locations')
    LOOP
      INSERT INTO public.location (workspace_id, name, slug, description)
      VALUES (
        v_workspace_id, 
        v_loc->>'name', 
        lower(regexp_replace(v_loc->>'name', '[^a-zA-Z0-9]+', '-', 'g')),
        v_loc->>'description'
      ) RETURNING location_id INTO v_location_id;
    END LOOP;
  END IF;

  -- 7. Insert Departments and Teams
  IF p_data->'departments' IS NOT NULL THEN
    FOR v_dept IN SELECT * FROM jsonb_array_elements(p_data->'departments')
    LOOP
      INSERT INTO public.department (workspace_id, name, slug, description)
      VALUES (
        v_workspace_id,
        v_dept->>'name',
        lower(regexp_replace(v_dept->>'name', '[^a-zA-Z0-9]+', '-', 'g')),
        v_dept->>'description'
      ) RETURNING department_id INTO v_department_id;

      -- Use teams only if the department is marked as season-active or the property is missing (defaults to true implicitly)
      IF v_dept->'teams' IS NOT NULL AND (v_dept->>'isSeasonActive' IS NULL OR (v_dept->>'isSeasonActive')::boolean = true) THEN
        FOR v_team IN SELECT * FROM jsonb_array_elements(v_dept->'teams')
        LOOP
          INSERT INTO public.team (
            workspace_id, department_id, season_id, name, slug, description, team_type
          ) VALUES (
            v_workspace_id, 
            v_department_id, 
            v_season_id, 
            v_team->>'name', 
            lower(regexp_replace(v_team->>'name', '[^a-zA-Z0-9]+', '-', 'g')),
            v_team->>'description',
            'operational'
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 7.5 Insert Cross-Department Teams
  IF p_data->'multiDepartmentTeams' IS NOT NULL THEN
    FOR v_team IN SELECT * FROM jsonb_array_elements(p_data->'multiDepartmentTeams')
    LOOP
      INSERT INTO public.team (
        workspace_id, department_id, season_id, name, slug, description, team_type
      ) VALUES (
        v_workspace_id, 
        NULL, 
        v_season_id, 
        v_team->>'name', 
        lower(regexp_replace(v_team->>'name', '[^a-zA-Z0-9]+', '-', 'g')),
        v_team->>'description',
        'cross_department'
      );
    END LOOP;
  END IF;

  -- 8. Create Base Policy & Protocol for Procedures
  IF p_data->'procedures' IS NOT NULL AND jsonb_array_length(p_data->'procedures') > 0 THEN
    INSERT INTO public.policy (
      workspace_id, season_id, policy_type, policy_scope, name, statement, created_by
    ) VALUES (
      v_workspace_id, v_season_id, 'operational', 'workspace', 'Standard Operating Procedures', 'Base procedures for the season', v_profile_id
    ) RETURNING policy_id INTO v_policy_id;

    INSERT INTO public.protocol (
      policy_id, workspace_id, name, description, owner_profile_id, created_by
    ) VALUES (
      v_policy_id, v_workspace_id, 'Base Protocol', 'Operational procedures defined during onboarding', v_profile_id, v_profile_id
    ) RETURNING protocol_id INTO v_protocol_id;

    FOR v_proc IN SELECT * FROM jsonb_array_elements(p_data->'procedures')
    LOOP
      INSERT INTO public.procedure (
        protocol_id, name, description, procedure_type
      ) VALUES (
        v_protocol_id,
        v_proc->>'title',
        COALESCE(v_proc->>'description', 'Priority: ' || (v_proc->>'urgency')),
        'standard'
      );
    END LOOP;
  END IF;

  RETURN v_workspace_id;
END;
$$;
