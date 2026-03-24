-- Migration: 20260322190000_finalize_write_full_business_data.sql
-- Description: Add field_sources JSONB to company_details for source tracking,
-- and extend finalize_onboarding_workspace to upsert company_details,
-- company contact info, and company_social_media.

-- 1. Add field_sources column to company_details
ALTER TABLE company_details ADD COLUMN IF NOT EXISTS
  field_sources jsonb DEFAULT '{}';
COMMENT ON COLUMN company_details.field_sources IS
  'Source tracking per field: scrape, brreg, ai_generated, user_input, user_confirmed, document_extraction';

-- 2. Extend finalize_onboarding_workspace RPC
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
      nace_code,
      phone,
      email
    ) VALUES (
      COALESCE(v_company_name, 'Unnamed Company'),
      COALESCE(p_data->>'legalName', v_company_name, 'Unnamed Company'),
      NULLIF(p_data->>'orgNumber', ''),
      v_industry::public.industry,
      p_data->>'website',
      p_data->>'ceo',
      COALESCE(NULLIF(p_data->>'industry', ''), v_industry),
      NULLIF(p_data->>'industryCode', ''),
      NULLIF(p_data->>'phone', ''),
      NULLIF(p_data->>'email', '')
    ) RETURNING company_id INTO v_company_id;

    UPDATE public.workspace SET company_id = v_company_id WHERE workspace_id = p_workspace_id;

    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.company_member (company_id, user_id, role)
      VALUES (v_company_id, v_user_id, 'owner');
    END IF;
  ELSE
    -- 2. Update existing Company with full data (including contact info)
    UPDATE public.company SET
      name = COALESCE(v_company_name, name),
      legal_name = COALESCE(p_data->>'legalName', v_company_name, legal_name),
      org_number = COALESCE(NULLIF(p_data->>'orgNumber', ''), org_number),
      industry = v_industry::public.industry,
      website = COALESCE(p_data->>'website', website),
      daglig_leder = COALESCE(p_data->>'ceo', daglig_leder),
      nace_description = COALESCE(NULLIF(p_data->>'industry', ''), v_industry, nace_description),
      nace_code = COALESCE(NULLIF(p_data->>'industryCode', ''), nace_code),
      phone = COALESCE(NULLIF(p_data->>'phone', ''), phone),
      email = COALESCE(NULLIF(p_data->>'email', ''), email)
    WHERE company_id = v_company_id;
  END IF;

  -- 2b. Upsert company_details with business narrative + menu data
  INSERT INTO company_details (
    workspace_id, about_us, our_history, our_concept,
    restaurant_type, cuisine_types, price_category, menu_description,
    employee_count, field_sources
  ) VALUES (
    p_workspace_id,
    NULLIF(p_data->>'aboutUs', ''),
    NULLIF(p_data->>'ourHistory', ''),
    NULLIF(p_data->>'ourConcept', ''),
    NULLIF(p_data->>'restaurantType', ''),
    COALESCE((SELECT array_agg(x::text) FROM jsonb_array_elements_text(p_data->'cuisineTypes') x), '{}'),
    NULLIF(p_data->>'priceCategory', ''),
    NULLIF(p_data->>'menuDescription', ''),
    NULLIF(p_data->>'employeeCount', ''),
    COALESCE(p_data->'fieldSources', '{}')
  )
  ON CONFLICT (workspace_id) DO UPDATE SET
    about_us = COALESCE(EXCLUDED.about_us, company_details.about_us),
    our_history = COALESCE(EXCLUDED.our_history, company_details.our_history),
    our_concept = COALESCE(EXCLUDED.our_concept, company_details.our_concept),
    restaurant_type = COALESCE(EXCLUDED.restaurant_type, company_details.restaurant_type),
    cuisine_types = CASE WHEN array_length(EXCLUDED.cuisine_types, 1) > 0
                         THEN EXCLUDED.cuisine_types
                         ELSE company_details.cuisine_types END,
    price_category = COALESCE(EXCLUDED.price_category, company_details.price_category),
    menu_description = COALESCE(EXCLUDED.menu_description, company_details.menu_description),
    employee_count = COALESCE(EXCLUDED.employee_count, company_details.employee_count),
    field_sources = company_details.field_sources || COALESCE(EXCLUDED.field_sources, '{}'),
    updated_at = now();

  -- 2c. Upsert social media links
  IF p_data->'socialLinks' IS NOT NULL AND jsonb_typeof(p_data->'socialLinks') = 'object' THEN
    INSERT INTO company_social_media (workspace_id, platform, url)
    SELECT p_workspace_id, key, value
    FROM jsonb_each_text(p_data->'socialLinks')
    WHERE value IS NOT NULL AND value != ''
    ON CONFLICT (workspace_id, platform) DO UPDATE SET
      url = EXCLUDED.url, updated_at = now();
  END IF;

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

  -- 9. Create default agent profile
  INSERT INTO public.agent_profile (workspace_id)
  VALUES (p_workspace_id)
  ON CONFLICT (workspace_id) DO NOTHING;

  RETURN p_workspace_id;
END;
$$;
