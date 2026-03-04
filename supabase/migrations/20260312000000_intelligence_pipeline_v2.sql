SET search_path TO public, extensions;

-- Migration: 20260312000000_intelligence_pipeline_v2.sql
-- Description: Intelligence Pipeline v2 — early workspace creation, Google Places data columns,
--              provision_onboarding_workspace and finalize_onboarding_workspace RPCs.

-- ── 1a. New workspace columns for Google Places data ────────────────────────

ALTER TABLE public.workspace
  ADD COLUMN IF NOT EXISTS intelligence_data jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS google_maps_url text,
  ADD COLUMN IF NOT EXISTS google_rating numeric(2,1),
  ADD COLUMN IF NOT EXISTS google_rating_count integer,
  ADD COLUMN IF NOT EXISTS google_price_level text,
  ADD COLUMN IF NOT EXISTS google_place_id text;


-- ── 1b. RPC: provision_onboarding_workspace ─────────────────────────────────
-- Creates a minimal workspace during onboarding so intelligence data has a permanent home.
-- Sets contract_status = 'onboarding'. No season, department, team, or policy creation.

CREATE OR REPLACE FUNCTION public.provision_onboarding_workspace(
  p_user_id uuid,
  p_company_name text,
  p_intelligence_data jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_workspace_id uuid;
  v_slug text;
  v_slug_attempt text;
  v_collision_count integer;
BEGIN
  -- 1. Create Company (minimal)
  INSERT INTO public.company (name, legal_name)
  VALUES (p_company_name, p_company_name)
  RETURNING company_id INTO v_company_id;

  -- 2. Generate slug with collision handling
  v_slug := lower(regexp_replace(p_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  -- Truncate to reasonable length
  v_slug := left(v_slug, 40);

  v_slug_attempt := v_slug;
  v_collision_count := 0;

  LOOP
    -- Check for collision
    IF NOT EXISTS (SELECT 1 FROM public.workspace WHERE slug = v_slug_attempt) THEN
      EXIT;
    END IF;
    v_collision_count := v_collision_count + 1;
    v_slug_attempt := v_slug || '-' || substring(md5(random()::text) from 1 for 4);
    -- Safety exit
    IF v_collision_count > 10 THEN
      v_slug_attempt := v_slug || '-' || substring(md5(random()::text) from 1 for 8);
      EXIT;
    END IF;
  END LOOP;

  -- 3. Create Workspace with onboarding status
  INSERT INTO public.workspace (
    company_id, name, slug, contract_status, intelligence_data
  ) VALUES (
    v_company_id,
    p_company_name,
    v_slug_attempt,
    'onboarding',
    p_intelligence_data
  )
  RETURNING workspace_id INTO v_workspace_id;

  -- 4. Create Company Member
  INSERT INTO public.company_member (user_id, company_id, role)
  VALUES (p_user_id, v_company_id, 'owner');

  -- 5. Create Profile
  INSERT INTO public.profile (
    user_id, workspace_id, company_id, profile_code, role, status, display_name
  ) VALUES (
    p_user_id, v_workspace_id, v_company_id,
    substring(md5(random()::text) from 1 for 6),
    'admin', 'active', 'Workspace Owner'
  );

  RETURN v_workspace_id;
END;
$$;


-- ── 1c. RPC: finalize_onboarding_workspace ──────────────────────────────────
-- Promotes an onboarding workspace to a full workspace.
-- Updates company with full data, creates season, departments, teams.

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
  v_season_id uuid;
  v_dept jsonb;
  v_department_id uuid;
  v_team jsonb;
  v_proc jsonb;
  v_policy_id uuid;
  v_protocol_id uuid;
  v_company_name text;
BEGIN
  v_company_name := p_data->>'name';

  -- 1. Get company_id and profile_id from workspace
  SELECT w.company_id INTO v_company_id
  FROM public.workspace w
  WHERE w.workspace_id = p_workspace_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Workspace % not found', p_workspace_id;
  END IF;

  SELECT p.profile_id INTO v_profile_id
  FROM public.profile p
  WHERE p.workspace_id = p_workspace_id
  LIMIT 1;

  -- 2. Update Company with full data
  UPDATE public.company SET
    name = COALESCE(v_company_name, name),
    legal_name = COALESCE(p_data->>'legalName', v_company_name, legal_name),
    org_number = COALESCE(NULLIF(p_data->>'orgNumber', ''), org_number),
    industry = COALESCE(p_data->>'industry', industry),
    website = COALESCE(p_data->>'website', website),
    daglig_leder = COALESCE(p_data->>'ceo', daglig_leder),
    nace_description = COALESCE(p_data->>'industry', nace_description),
    nace_code = COALESCE(NULLIF(p_data->>'industryCode', ''), nace_code)
  WHERE company_id = v_company_id;

  -- 3. Update Workspace — promote from onboarding
  UPDATE public.workspace SET
    name = COALESCE(v_company_name, name),
    contract_status = 'none',
    short_description = COALESCE(p_data->>'summary', short_description),
    brand_color = COALESCE(p_data->>'brandColor', brand_color),
    communication_tone = COALESCE(p_data->>'communicationTone', communication_tone)
  WHERE workspace_id = p_workspace_id;

  -- 4. Create Season
  INSERT INTO public.season (
    workspace_id, name, slug, description, season_type, created_by
  ) VALUES (
    p_workspace_id,
    COALESCE(p_data->>'seasonName', 'Sesong 1'),
    lower(regexp_replace(COALESCE(p_data->>'seasonName', 'sesong-1'), '[^a-zA-Z0-9]+', '-', 'g')),
    'Initial season created during onboarding',
    COALESCE((p_data->>'seasonType')::public.season_type, 'default'),
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

      IF v_dept->'teams' IS NOT NULL AND (v_dept->>'isSeasonActive' IS NULL OR (v_dept->>'isSeasonActive')::boolean = true) THEN
        FOR v_team IN SELECT * FROM jsonb_array_elements(v_dept->'teams')
        LOOP
          INSERT INTO public.team (
            workspace_id, department_id, season_id, name, slug, description, team_type
          ) VALUES (
            p_workspace_id,
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

  -- 6. Cross-Department Teams
  IF p_data->'multiDepartmentTeams' IS NOT NULL THEN
    FOR v_team IN SELECT * FROM jsonb_array_elements(p_data->'multiDepartmentTeams')
    LOOP
      INSERT INTO public.team (
        workspace_id, department_id, season_id, name, slug, description, team_type
      ) VALUES (
        p_workspace_id,
        NULL,
        v_season_id,
        v_team->>'name',
        lower(regexp_replace(v_team->>'name', '[^a-zA-Z0-9]+', '-', 'g')),
        v_team->>'description',
        'cross_department'
      );
    END LOOP;
  END IF;

  -- 7. Create Base Policy & Protocol for Procedures
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

  -- 8. Create default agent profile
  INSERT INTO public.agent_profile (workspace_id)
  VALUES (p_workspace_id)
  ON CONFLICT (workspace_id) DO NOTHING;

  RETURN p_workspace_id;
END;
$$;
