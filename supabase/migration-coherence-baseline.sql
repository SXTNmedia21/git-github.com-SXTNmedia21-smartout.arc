drop view if exists "public"."v_current_plan_preview";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.anonymize_user(target_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  -- 1. Overwrite operational references
  UPDATE public.profile 
  SET 
    display_name = 'Anonymized User', 
    avatar_url = NULL, 
    employee_number = NULL,
    is_active = false
  WHERE user_id = target_user_id;

  -- 2. Destroy PII in the vault
  UPDATE public.user_identity
  SET
    email = 'anonymized_' || target_user_id || '@deleted.smartout.local',
    first_name = 'Anonymized',
    last_name = 'User',
    phone = NULL,
    personal_email = NULL,
    date_of_birth = NULL,
    emergency_contact_name = NULL,
    emergency_contact_phone = NULL,
    emergency_contact_relation = NULL,
    is_active = false
  WHERE user_id = target_user_id;

  -- Ensure they can never auth again
  UPDATE auth.users 
  SET email = 'anonymized_' || target_user_id || '@deleted.smartout.local', raw_user_meta_data = '{}'::jsonb
  WHERE id = target_user_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.compute_platform_metrics()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
INSERT INTO platform_metrics_daily (
  date,
  total_users,
  total_companies,
  total_workspaces,
  total_profiles,
  new_users_today,
  new_workspaces_today,
  subscriptions_trial,
  subscriptions_active,
  subscriptions_paused,
  subscriptions_past_due,
  subscriptions_cancelled,
  active_workspaces_24h,
  mrr_nok
)
SELECT
  CURRENT_DATE,
  (SELECT count(*) FROM user_identity),
  (SELECT count(*) FROM company),
  (SELECT count(*) FROM workspace),
  (SELECT count(*) FROM profile WHERE status = 'active'),
  (SELECT count(*) FROM user_identity WHERE created_at >= CURRENT_DATE),
  (SELECT count(*) FROM workspace WHERE created_at >= CURRENT_DATE),
  (SELECT count(*) FROM company WHERE subscription_status = 'trial'),
  (SELECT count(*) FROM company WHERE subscription_status = 'active'),
  (SELECT count(*) FROM company WHERE subscription_status = 'paused'),
  (SELECT count(*) FROM company WHERE subscription_status = 'past_due'),
  (SELECT count(*) FROM company WHERE subscription_status = 'cancelled'),
  (SELECT count(DISTINCT workspace_id) FROM profile WHERE updated_at >= now() - interval '24 hours'),
  0 -- MRR placeholder — real values come from Stripe API in production
ON CONFLICT (date) DO UPDATE SET
  total_users = EXCLUDED.total_users,
  total_companies = EXCLUDED.total_companies,
  total_workspaces = EXCLUDED.total_workspaces,
  total_profiles = EXCLUDED.total_profiles,
  new_users_today = EXCLUDED.new_users_today,
  new_workspaces_today = EXCLUDED.new_workspaces_today,
  subscriptions_trial = EXCLUDED.subscriptions_trial,
  subscriptions_active = EXCLUDED.subscriptions_active,
  subscriptions_paused = EXCLUDED.subscriptions_paused,
  subscriptions_past_due = EXCLUDED.subscriptions_past_due,
  subscriptions_cancelled = EXCLUDED.subscriptions_cancelled,
  active_workspaces_24h = EXCLUDED.active_workspaces_24h,
  mrr_nok = EXCLUDED.mrr_nok,
  computed_at = now();
$function$
;

CREATE OR REPLACE FUNCTION public.count_dangling_company_members()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::integer
  FROM public.company_member cm
  LEFT JOIN public.user_identity ui ON cm.user_id = ui.user_id
  WHERE ui.user_id IS NULL;
$function$
;

CREATE OR REPLACE FUNCTION public.count_empty_workspaces()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::integer
  FROM public.workspace w
  WHERE NOT EXISTS (
    SELECT 1 FROM public.profile p WHERE p.workspace_id = w.workspace_id
  );
$function$
;

CREATE OR REPLACE FUNCTION public.create_workspace_transaction(p_user_id uuid, p_company_name text, p_locations jsonb, p_departments jsonb, p_policies jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_company_id uuid;
  v_workspace_id uuid;
  v_profile_id uuid;
  v_loc jsonb;
  v_dept jsonb;
  v_pol jsonb;
  v_role text;
  v_department_id uuid;
  v_location_id uuid;
BEGIN
  -- 1. Create Company
  -- org_number is required by schema, using a placeholder until integrated fully
  INSERT INTO public.company (name, org_number, industry)
  VALUES (p_company_name, 'PENDING-' || substring(md5(random()::text) from 1 for 6), 'restaurant')
  RETURNING company_id INTO v_company_id;

  -- 2. Create Workspace
  INSERT INTO public.workspace (company_id, name, slug)
  VALUES (v_company_id, p_company_name, lower(regexp_replace(p_company_name, '[^a-zA-Z0-9]+', '-', 'g')))
  RETURNING workspace_id INTO v_workspace_id;

  -- 3. Create Company Member (Owner)
  -- assuming 'owner' is a valid company_member_role, based on typical structure.
  INSERT INTO public.company_member (user_id, company_id, role)
  VALUES (p_user_id, v_company_id, 'owner');

  -- 4. Create Profile for the user
  INSERT INTO public.profile (
    user_id, workspace_id, company_id, profile_code, role, status, display_name
  ) VALUES (
    p_user_id, v_workspace_id, v_company_id, substring(md5(random()::text) from 1 for 6),
    'admin', 'active', 'Workspace Owner'
  ) RETURNING profile_id INTO v_profile_id;

  -- 5. Insert Locations
  FOR v_loc IN SELECT * FROM jsonb_array_elements(p_locations)
  LOOP
    INSERT INTO public.location (workspace_id, name, slug, location_type, description)
    VALUES (
      v_workspace_id, 
      v_loc->>'name', 
      lower(regexp_replace(v_loc->>'name', '[^a-zA-Z0-9]+', '-', 'g')),
      -- Default to 'main' if the passed type isn't a valid enum value or is missing
      COALESCE(
        CASE WHEN v_loc->>'type' IN ('main', 'outdoor', 'kitchen', 'event', 'storage', 'other') 
             THEN (v_loc->>'type')::public.location_type 
             ELSE 'main'::public.location_type 
        END, 
        'main'::public.location_type
      ),
      v_loc->>'function'
    ) RETURNING location_id INTO v_location_id;
  END LOOP;

  -- 6. Insert Departments & Roles (Positions)
  FOR v_dept IN SELECT * FROM jsonb_array_elements(p_departments)
  LOOP
    INSERT INTO public.department (workspace_id, name, slug, description)
    VALUES (
      v_workspace_id,
      v_dept->>'name',
      lower(regexp_replace(v_dept->>'name', '[^a-zA-Z0-9]+', '-', 'g')),
      v_dept->>'description'
    ) RETURNING department_id INTO v_department_id;

    -- Positions within department
    IF v_dept->'roles' IS NOT NULL THEN
      FOR v_role IN SELECT * FROM jsonb_array_elements_text(v_dept->'roles')
      LOOP
        INSERT INTO public.position (
          workspace_id, department_id, title, description
        )
        VALUES (
          v_workspace_id, v_department_id, v_role, 'Auto-generated position via onboarding.'
        );
      END LOOP;
    END IF;
  END LOOP;

  -- 7. Insert Policies
  FOR v_pol IN SELECT * FROM jsonb_array_elements(p_policies)
  LOOP
    INSERT INTO public.policy (
      workspace_id, 
      policy_type, 
      policy_scope, 
      name, 
      statement, 
      description,
      created_by
    )
    VALUES (
      v_workspace_id,
      'operational',
      'workspace',
      v_pol->>'title',
      v_pol->>'summary',
      v_pol->>'summary',
      v_profile_id
    );
  END LOOP;

  RETURN v_workspace_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_workspace_transaction(p_user_id uuid, p_company_name text, p_locations jsonb, p_departments jsonb, p_policies jsonb, p_raw_scraped_data jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_company_id uuid;
  v_workspace_id uuid;
  v_profile_id uuid;
  v_loc jsonb;
  v_dept jsonb;
  v_pol jsonb;
  v_role text;
  v_department_id uuid;
  v_location_id uuid;
BEGIN
  -- 1. Create Company
  -- org_number is required by schema, using a placeholder until integrated fully
  INSERT INTO public.company (name, org_number, industry, raw_scraped_data, onboarding_status)
  VALUES (p_company_name, 'PENDING-' || substring(md5(random()::text) from 1 for 6), 'restaurant', p_raw_scraped_data, 'pending')
  RETURNING company_id INTO v_company_id;

  -- 2. Create Workspace
  INSERT INTO public.workspace (company_id, name, slug)
  VALUES (v_company_id, p_company_name, lower(regexp_replace(p_company_name, '[^a-zA-Z0-9]+', '-', 'g')))
  RETURNING workspace_id INTO v_workspace_id;

  -- 3. Create Company Member (Owner)
  INSERT INTO public.company_member (user_id, company_id, role)
  VALUES (p_user_id, v_company_id, 'owner');

  -- 4. Create Profile for the user
  INSERT INTO public.profile (
    user_id, workspace_id, company_id, profile_code, role, status, display_name
  ) VALUES (
    p_user_id, v_workspace_id, v_company_id, substring(md5(random()::text) from 1 for 6),
    'admin', 'active', 'Workspace Owner'
  ) RETURNING profile_id INTO v_profile_id;

  -- 5. Insert Locations
  IF p_locations IS NOT NULL THEN
    FOR v_loc IN SELECT * FROM jsonb_array_elements(p_locations)
    LOOP
      INSERT INTO public.location (workspace_id, name, slug, location_type, description)
      VALUES (
        v_workspace_id, 
        v_loc->>'name', 
        lower(regexp_replace(v_loc->>'name', '[^a-zA-Z0-9]+', '-', 'g')),
        COALESCE(
          CASE WHEN v_loc->>'type' IN ('main', 'outdoor', 'kitchen', 'event', 'storage', 'other') 
              THEN (v_loc->>'type')::public.location_type 
              ELSE 'main'::public.location_type 
          END, 
          'main'::public.location_type
        ),
        v_loc->>'function'
      ) RETURNING location_id INTO v_location_id;
    END LOOP;
  END IF;

  -- 6. Insert Departments & Roles (Positions)
  IF p_departments IS NOT NULL THEN
    FOR v_dept IN SELECT * FROM jsonb_array_elements(p_departments)
    LOOP
      INSERT INTO public.department (workspace_id, name, slug, description)
      VALUES (
        v_workspace_id,
        v_dept->>'name',
        lower(regexp_replace(v_dept->>'name', '[^a-zA-Z0-9]+', '-', 'g')),
        v_dept->>'description'
      ) RETURNING department_id INTO v_department_id;

      -- Positions within department
      IF v_dept->'roles' IS NOT NULL THEN
        FOR v_role IN SELECT * FROM jsonb_array_elements_text(v_dept->'roles')
        LOOP
          INSERT INTO public.position (
            workspace_id, department_id, title, description
          )
          VALUES (
            v_workspace_id, v_department_id, v_role, 'Auto-generated position via onboarding.'
          );
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  -- 7. Insert Policies
  IF p_policies IS NOT NULL THEN
    FOR v_pol IN SELECT * FROM jsonb_array_elements(p_policies)
    LOOP
      INSERT INTO public.policy (
        workspace_id, 
        policy_type, 
        policy_scope, 
        name, 
        statement, 
        description,
        created_by
      )
      VALUES (
        v_workspace_id,
        'operational',
        'workspace',
        v_pol->>'title',
        v_pol->>'summary',
        v_pol->>'summary',
        v_profile_id
      );
    END LOOP;
  END IF;

  RETURN v_workspace_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.finalize_onboarding_workspace(p_workspace_id uuid, p_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
      nace_code,
      phone,
      email,
      address_line_1,
      postal_code,
      city,
      logo_url
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
      NULLIF(p_data->>'email', ''),
      NULLIF(p_data->>'addressLine1', ''),
      NULLIF(p_data->>'postalCode', ''),
      NULLIF(p_data->>'city', ''),
      NULLIF(p_data->>'logoUrl', '')
    ) RETURNING company_id INTO v_company_id;

    -- Link workspace to company
    UPDATE public.workspace SET company_id = v_company_id WHERE workspace_id = p_workspace_id;

    -- Create company_member for the owner
    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.company_member (company_id, user_id, role)
      VALUES (v_company_id, v_user_id, 'owner');
    END IF;
  ELSE
    -- 2. Update existing Company with full data (including contact + address)
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
      email = COALESCE(NULLIF(p_data->>'email', ''), email),
      address_line_1 = COALESCE(NULLIF(p_data->>'addressLine1', ''), address_line_1),
      postal_code = COALESCE(NULLIF(p_data->>'postalCode', ''), postal_code),
      city = COALESCE(NULLIF(p_data->>'city', ''), city),
      logo_url = COALESCE(NULLIF(p_data->>'logoUrl', ''), logo_url)
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
  --    Includes: core fields + onboarding_completed + address + Google Places data
  UPDATE public.workspace SET
    name = COALESCE(v_company_name, name),
    contract_status = 'none',
    onboarding_completed = true,
    short_description = COALESCE(p_data->>'summary', short_description),
    brand_color = COALESCE(p_data->>'brandColor', brand_color),
    communication_tone = COALESCE(p_data->>'communicationTone', communication_tone),
    address_line_1 = COALESCE(NULLIF(p_data->>'addressLine1', ''), address_line_1),
    postal_code = COALESCE(NULLIF(p_data->>'postalCode', ''), postal_code),
    city = COALESCE(NULLIF(p_data->>'city', ''), city),
    logo_url = COALESCE(NULLIF(p_data->>'logoUrl', ''), logo_url),
    phone = COALESCE(NULLIF(p_data->>'phone', ''), phone),
    email = COALESCE(NULLIF(p_data->>'email', ''), email),
    google_rating = COALESCE((p_data->>'googleRating')::numeric, google_rating),
    google_rating_count = COALESCE((p_data->>'googleRatingCount')::integer, google_rating_count),
    google_maps_url = COALESCE(NULLIF(p_data->>'googleMapsUrl', ''), google_maps_url),
    google_place_id = COALESCE(NULLIF(p_data->>'googlePlaceId', ''), google_place_id),
    latitude = COALESCE((p_data->>'latitude')::double precision, latitude),
    longitude = COALESCE((p_data->>'longitude')::double precision, longitude),
    google_price_level = COALESCE(NULLIF(p_data->>'googlePriceLevel', ''), google_price_level)
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
  -- Tries to match profession name to department name (e.g. "Kjokken" -> "Kjokken" dept).
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
$function$
;

CREATE OR REPLACE FUNCTION public.get_workspace_ids_for_user(uid uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT workspace_id FROM public.profile WHERE user_id = uid AND is_active = true;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.user_identity (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_admin_in_workspace(uid uuid, wid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profile 
    WHERE user_id = uid 
      AND workspace_id = wid 
      AND role IN ('admin', 'owner') 
      AND is_active = true
  );
$function$
;

CREATE OR REPLACE FUNCTION public.match_workspace_docs(p_workspace_id uuid, query_embedding public.vector, match_count integer DEFAULT 5, match_threshold double precision DEFAULT 0.5)
 RETURNS TABLE(chunk_id uuid, source_type text, source_path text, title text, content text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT w.chunk_id, w.source_type, w.source_path, w.title, w.content, 1 - (w.embedding <=> query_embedding) as similarity
  FROM workspace_doc_chunk w
  WHERE w.workspace_id = p_workspace_id AND w.embedding IS NOT NULL AND 1 - (w.embedding <=> query_embedding) >= match_threshold
  ORDER BY w.embedding <=> query_embedding LIMIT match_count
$function$
;

CREATE OR REPLACE FUNCTION public.notify_swap_result()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT;
  v_old_status TEXT;
  v_requester_user_id UUID;
  v_target_user_id UUID;
  v_requester_name TEXT;
  v_target_name TEXT;
  v_workspace_id UUID;
  v_date TEXT;
BEGIN
  -- Only trigger on shift_swap process state changes
  IF NEW.process_id != 'shift_swap' THEN
    RETURN NEW;
  END IF;

  v_status := NEW.context->>'status';
  v_old_status := OLD.context->>'status';

  -- Skip if status didn't change
  IF v_status = v_old_status THEN
    RETURN NEW;
  END IF;

  v_workspace_id := NEW.workspace_id;
  v_date := COALESCE(NEW.context->>'shift_date', '');

  -- Resolve user IDs and names
  SELECT p.user_id, p.display_name INTO v_requester_user_id, v_requester_name
  FROM profile p WHERE p.profile_id = (NEW.context->>'requester_profile_id')::UUID;

  SELECT p.user_id, p.display_name INTO v_target_user_id, v_target_name
  FROM profile p WHERE p.profile_id = (NEW.context->>'target_profile_id')::UUID;

  -- FIXED 2026-04-17: condition matches the actual state machine.
  -- approve_shift_swap writes context.status='executed' (migration
  -- 20260413123343:295 + 20260413132826:135) transitioning from
  -- 'pending_manager'. Prior gate 'approved' AND 'pending_requester_confirm'
  -- was unreachable — neither value is ever written.
  IF v_status = 'executed' AND v_old_status = 'pending_manager' THEN
    -- Notify requester that swap is approved
    IF v_requester_user_id IS NOT NULL THEN
      PERFORM dispatch_swap_notification(
        v_workspace_id, v_requester_user_id,
        'shift.swap_approved',
        'Vaktbytte godkjent',
        'Vakten din er byttet med ' || COALESCE(v_target_name, 'kollega'),
        jsonb_build_object('swap_id', NEW.id, 'other_name', v_target_name, 'date', v_date)
      );
    END IF;
    -- Notify target
    IF v_target_user_id IS NOT NULL THEN
      PERFORM dispatch_swap_notification(
        v_workspace_id, v_target_user_id,
        'shift.swap_approved',
        'Vaktbytte godkjent',
        'Vakten din er byttet med ' || COALESCE(v_requester_name, 'kollega'),
        jsonb_build_object('swap_id', NEW.id, 'other_name', v_requester_name, 'date', v_date)
      );
    END IF;

  ELSIF v_status = 'rejected' THEN
    -- Notify requester that swap was rejected
    IF v_requester_user_id IS NOT NULL THEN
      PERFORM dispatch_swap_notification(
        v_workspace_id, v_requester_user_id,
        'shift.swap_rejected',
        'Vaktbytte avslått',
        'Byttforespørselen din ble avslått',
        jsonb_build_object('swap_id', NEW.id, 'date', v_date)
      );
    END IF;

  ELSIF v_status = 'cancelled' THEN
    -- Notify target that swap was cancelled
    IF v_target_user_id IS NOT NULL THEN
      PERFORM dispatch_swap_notification(
        v_workspace_id, v_target_user_id,
        'shift.swap_cancelled',
        'Vaktbytte kansellert',
        COALESCE(v_requester_name, 'Kollega') || ' kansellerte byttforespørselen',
        jsonb_build_object('swap_id', NEW.id, 'requester_name', v_requester_name, 'date', v_date)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.provision_onboarding_workspace(p_user_id uuid, p_company_name text, p_intelligence_data jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_workspace_id uuid; v_slug text; v_slug_attempt text; v_collision_count integer;
BEGIN
  v_slug := lower(regexp_replace(p_company_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);
  v_slug := left(v_slug, 40);
  v_slug_attempt := v_slug;
  v_collision_count := 0;
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.workspace WHERE slug = v_slug_attempt) THEN EXIT; END IF;
    v_collision_count := v_collision_count + 1;
    v_slug_attempt := v_slug || '-' || substring(md5(random()::text) from 1 for 4);
    IF v_collision_count > 10 THEN
      v_slug_attempt := v_slug || '-' || substring(md5(random()::text) from 1 for 8);
      EXIT;
    END IF;
  END LOOP;
  INSERT INTO public.workspace (name, slug, contract_status, intelligence_data)
  VALUES (p_company_name, v_slug_attempt, 'onboarding', p_intelligence_data)
  RETURNING workspace_id INTO v_workspace_id;
  INSERT INTO public.profile (user_id, workspace_id, profile_code, role, status, display_name)
  VALUES (p_user_id, v_workspace_id, substring(md5(random()::text) from 1 for 6), 'admin', 'active', 'Workspace Owner');
  RETURN v_workspace_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.resolve_cascade_tasks(p_workspace_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH
  -- D1: Departments
  dept_all AS (
    SELECT department_id, name
    FROM department
    WHERE workspace_id = p_workspace_id AND is_active = true
  ),
  workspace_hours_check AS (
    SELECT count(*) AS cnt
    FROM workspace_operating_hours
    WHERE workspace_id = p_workspace_id
  ),
  dept_with_hours AS (
    SELECT DISTINCT d.department_id
    FROM dept_all d
    WHERE EXISTS (
      SELECT 1 FROM department_operating_hours doh
      WHERE doh.department_id = d.department_id
    )
    OR (SELECT cnt FROM workspace_hours_check) > 0
  ),
  dept_tasks AS (
    SELECT jsonb_build_object(
      'id', 'departments.missing_hours.' || d.department_id,
      'group', 'departments',
      'dimension', 'D1',
      'title_key', 'dashboard.todo.dept_missing_hours',
      'title_params', jsonb_build_object('name', d.name),
      'description_key', 'dashboard.todo.desc.dept_missing_hours',
      'description_params', jsonb_build_object('name', d.name),
      'urgency', 'critical',
      'href', '/dashboard/settings',
      'entity_type', 'department',
      'entity_id', d.department_id::text
    ) AS task
    FROM dept_all d
    LEFT JOIN dept_with_hours dh ON dh.department_id = d.department_id
    WHERE dh.department_id IS NULL
  ),
  dept_no_positions AS (
    SELECT jsonb_build_object(
      'id', 'departments.missing_positions.' || d.department_id,
      'group', 'departments',
      'dimension', 'D1',
      'title_key', 'dashboard.todo.dept_missing_positions',
      'title_params', jsonb_build_object('name', d.name),
      'description_key', 'dashboard.todo.desc.dept_missing_positions',
      'description_params', jsonb_build_object('name', d.name),
      'urgency', 'can_wait',
      'href', '/dashboard/organization/departments/' || d.department_id,
      'entity_type', 'department',
      'entity_id', d.department_id::text
    ) AS task
    FROM dept_all d
    LEFT JOIN position p ON p.department_id = d.department_id
    WHERE p.position_id IS NULL
  ),
  location_check AS (
    SELECT count(*) AS loc_count
    FROM location
    WHERE workspace_id = p_workspace_id
  ),
  dept_no_location_task AS (
    SELECT jsonb_build_object(
      'id', 'departments.no_locations',
      'group', 'departments',
      'dimension', 'D1',
      'title_key', 'dashboard.todo.dept_no_locations',
      'description_key', 'dashboard.todo.desc.dept_no_locations',
      'urgency', 'should',
      'href', '/dashboard/organization'
    ) AS task
    FROM location_check
    WHERE loc_count = 0
  ),
  dept_none_task AS (
    SELECT jsonb_build_object(
      'id', 'departments.none_exist',
      'group', 'departments',
      'dimension', 'D1',
      'title_key', 'dashboard.todo.dept_none_exist',
      'description_key', 'dashboard.todo.desc.dept_none_exist',
      'urgency', 'critical',
      'href', '/dashboard/organization'
    ) AS task
    WHERE (SELECT count(*) FROM dept_all) = 0
  ),
  workspace_hours_task AS (
    SELECT jsonb_build_object(
      'id', 'workspace.missing_base_hours',
      'group', 'departments',
      'dimension', 'D1',
      'title_key', 'dashboard.todo.workspace_missing_hours',
      'description_key', 'dashboard.todo.desc.workspace_missing_hours',
      'urgency', 'critical',
      'href', '/dashboard/settings'
    ) AS task
    WHERE (SELECT cnt FROM workspace_hours_check) = 0
  ),
  all_dept_tasks AS (
    SELECT task FROM dept_tasks
    UNION ALL SELECT task FROM dept_no_positions
    UNION ALL SELECT task FROM dept_no_location_task
    UNION ALL SELECT task FROM dept_none_task
    UNION ALL SELECT task FROM workspace_hours_task
  ),
  dept_summary AS (
    SELECT jsonb_build_object(
      'group', 'departments',
      'dimension', 'D1',
      'label_key', 'dashboard.todo.group.departments',
      'icon', 'Building2',
      'done', (
        CASE WHEN (SELECT count(*) FROM dept_all) > 0 THEN 1 ELSE 0 END
        + CASE WHEN (SELECT cnt FROM workspace_hours_check) > 0 THEN 1 ELSE 0 END
        + CASE WHEN (SELECT count(*) FROM dept_all d LEFT JOIN dept_with_hours dh ON dh.department_id = d.department_id WHERE dh.department_id IS NULL) = 0 THEN 1 ELSE 0 END
        + CASE WHEN (SELECT loc_count FROM location_check) > 0 THEN 1 ELSE 0 END
        + CASE WHEN (SELECT count(*) FROM dept_no_positions) = 0 THEN 1 ELSE 0 END
      ),
      'total', 5,
      'tasks', COALESCE((SELECT jsonb_agg(task) FROM all_dept_tasks), '[]'::jsonb)
    ) AS summary
  ),

  -- D2: Staff
  active_profiles AS (
    SELECT profile_id, display_name, user_id,
           bank_account, personal_number, address_line_1
    FROM profile
    WHERE workspace_id = p_workspace_id AND is_active = true
  ),
  profiles_without_contract AS (
    SELECT p.profile_id, p.display_name AS name
    FROM active_profiles p
    LEFT JOIN employment_contract ec
      ON ec.profile_id = p.profile_id
      AND ec.status = 'signed'
    WHERE ec.contract_id IS NULL
  ),
  profiles_without_payroll AS (
    SELECT p.profile_id, p.display_name AS name
    FROM active_profiles p
    LEFT JOIN employee_payroll_profile epp
      ON epp.profile_id = p.profile_id
    WHERE epp.id IS NULL
  ),
  profiles_incomplete AS (
    SELECT p.profile_id, p.display_name AS name
    FROM active_profiles p
    WHERE p.bank_account IS NULL
       OR p.personal_number IS NULL
       OR p.address_line_1 IS NULL
  ),
  profiles_no_team AS (
    SELECT p.profile_id, p.display_name AS name
    FROM active_profiles p
    LEFT JOIN team_member tm ON tm.profile_id = p.profile_id
    WHERE tm.team_member_id IS NULL
  ),
  staff_tasks AS (
    SELECT jsonb_build_object(
      'id', 'staff.missing_contract.' || profile_id,
      'group', 'staff', 'dimension', 'D2',
      'title_key', 'dashboard.todo.staff_missing_contract',
      'title_params', jsonb_build_object('name', name),
      'description_key', 'dashboard.todo.desc.staff_missing_contract',
      'description_params', jsonb_build_object('name', name),
      'urgency', 'critical',
      'href', '/dashboard/people',
      'entity_type', 'profile', 'entity_id', profile_id::text
    ) AS task FROM profiles_without_contract
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'staff.missing_payroll.' || profile_id,
      'group', 'staff', 'dimension', 'D2',
      'title_key', 'dashboard.todo.staff_missing_payroll',
      'title_params', jsonb_build_object('name', name),
      'description_key', 'dashboard.todo.desc.staff_missing_payroll',
      'description_params', jsonb_build_object('name', name),
      'urgency', 'should',
      'href', '/dashboard/people',
      'entity_type', 'profile', 'entity_id', profile_id::text
    ) AS task FROM profiles_without_payroll
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'staff.incomplete_profile.' || profile_id,
      'group', 'staff', 'dimension', 'D2',
      'title_key', 'dashboard.todo.staff_incomplete_profile',
      'title_params', jsonb_build_object('name', name),
      'description_key', 'dashboard.todo.desc.staff_incomplete_profile',
      'description_params', jsonb_build_object('name', name),
      'urgency', 'can_wait',
      'href', '/dashboard/people',
      'entity_type', 'profile', 'entity_id', profile_id::text
    ) AS task FROM profiles_incomplete
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'staff.no_team.' || profile_id,
      'group', 'staff', 'dimension', 'D2',
      'title_key', 'dashboard.todo.staff_no_team',
      'title_params', jsonb_build_object('name', name),
      'description_key', 'dashboard.todo.desc.staff_no_team',
      'description_params', jsonb_build_object('name', name),
      'urgency', 'can_wait',
      'href', '/dashboard/people',
      'entity_type', 'profile', 'entity_id', profile_id::text
    ) AS task FROM profiles_no_team
  ),
  staff_done AS (
    SELECT count(*) AS cnt FROM active_profiles p
    WHERE EXISTS (
      SELECT 1 FROM employment_contract ec
      WHERE ec.profile_id = p.profile_id AND ec.status = 'signed'
    )
    AND EXISTS (
      SELECT 1 FROM employee_payroll_profile epp
      WHERE epp.profile_id = p.profile_id
    )
  ),
  staff_summary AS (
    SELECT jsonb_build_object(
      'group', 'staff', 'dimension', 'D2',
      'label_key', 'dashboard.todo.group.staff',
      'icon', 'Users',
      'done', (SELECT cnt FROM staff_done),
      'total', (SELECT count(*) FROM active_profiles),
      'tasks', COALESCE((SELECT jsonb_agg(task) FROM staff_tasks), '[]'::jsonb)
    ) AS summary
  ),

  -- D3: Framework
  fw_binding AS (
    SELECT count(*) AS cnt
    FROM workspace_framework_binding
    WHERE workspace_id = p_workspace_id
  ),
  fw_tariffs AS (
    SELECT count(*) AS cnt
    FROM tariff_rate_table
    WHERE workspace_id = p_workspace_id OR workspace_id IS NULL
  ),
  fw_holidays AS (
    SELECT count(*) AS cnt
    FROM public_holiday
    WHERE extract(year FROM holiday_date) = extract(year FROM current_date)
  ),
  framework_tasks AS (
    SELECT jsonb_build_object(
      'id', 'framework.no_binding', 'group', 'framework',
      'dimension', 'D3',
      'title_key', 'dashboard.todo.framework_no_binding',
      'description_key', 'dashboard.todo.desc.framework_no_binding',
      'urgency', 'critical',
      'href', '/dashboard/settings'
    ) AS task WHERE (SELECT cnt FROM fw_binding) = 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'framework.no_tariffs', 'group', 'framework',
      'dimension', 'D3',
      'title_key', 'dashboard.todo.framework_no_tariffs',
      'description_key', 'dashboard.todo.desc.framework_no_tariffs',
      'urgency', 'critical',
      'href', '/dashboard/settings'
    ) AS task WHERE (SELECT cnt FROM fw_tariffs) = 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'framework.no_holidays', 'group', 'framework',
      'dimension', 'D3',
      'title_key', 'dashboard.todo.framework_no_holidays',
      'title_params', jsonb_build_object(
        'year', extract(year FROM current_date)::text
      ),
      'description_key', 'dashboard.todo.desc.framework_no_holidays',
      'description_params', jsonb_build_object(
        'year', extract(year FROM current_date)::text
      ),
      'urgency', 'should',
      'href', '/dashboard/settings'
    ) AS task WHERE (SELECT cnt FROM fw_holidays) = 0
  ),
  framework_summary AS (
    SELECT jsonb_build_object(
      'group', 'framework', 'dimension', 'D3',
      'label_key', 'dashboard.todo.group.framework',
      'icon', 'Scale',
      'done', (
        CASE WHEN (SELECT cnt FROM fw_binding) > 0 THEN 1 ELSE 0 END +
        CASE WHEN (SELECT cnt FROM fw_tariffs) > 0 THEN 1 ELSE 0 END +
        CASE WHEN (SELECT cnt FROM fw_holidays) > 0 THEN 1 ELSE 0 END
      ),
      'total', 3,
      'tasks', COALESCE(
        (SELECT jsonb_agg(task) FROM framework_tasks), '[]'::jsonb
      )
    ) AS summary
  ),

  -- D4: Budget & Season — hrefs redirected to /dashboard/season/<id>?tab=<key>
  active_season AS (
    SELECT season_id FROM season
    WHERE workspace_id = p_workspace_id AND status = 'active'
    LIMIT 1
  ),
  season_budget_check AS (
    SELECT count(*) AS cnt FROM season_budget
    WHERE season_id = (SELECT season_id FROM active_season)
  ),
  day_factor_check AS (
    SELECT count(*) AS cnt FROM day_factor
    WHERE season_budget_id IN (
      SELECT season_budget_id FROM season_budget
      WHERE season_id = (SELECT season_id FROM active_season)
    )
  ),
  hour_factor_check AS (
    SELECT count(*) AS cnt FROM hour_factor
    WHERE season_budget_id IN (
      SELECT season_budget_id FROM season_budget
      WHERE season_id = (SELECT season_id FROM active_season)
    )
  ),
  budget_tasks AS (
    -- no_season: no active season exists → fall back to year-wheel where user creates one.
    SELECT jsonb_build_object(
      'id', 'budget.no_season', 'group', 'budget',
      'dimension', 'D4',
      'title_key', 'dashboard.todo.budget_no_season',
      'description_key', 'dashboard.todo.desc.budget_no_season',
      'urgency', 'critical',
      'href', '/dashboard/year-wheel'
    ) AS task WHERE (SELECT season_id FROM active_season) IS NULL
    UNION ALL
    -- no_budget: active season exists, deep-link to budget tab.
    SELECT jsonb_build_object(
      'id', 'budget.no_budget', 'group', 'budget',
      'dimension', 'D4',
      'title_key', 'dashboard.todo.budget_no_budget',
      'description_key', 'dashboard.todo.desc.budget_no_budget',
      'urgency', 'should',
      'href', '/dashboard/season/'
        || (SELECT season_id FROM active_season)::text
        || '?tab=budget'
    ) AS task
    WHERE (SELECT season_id FROM active_season) IS NOT NULL
      AND (SELECT cnt FROM season_budget_check) = 0
    UNION ALL
    -- no_day_factors: deep-link to day-factor tab.
    SELECT jsonb_build_object(
      'id', 'budget.no_day_factors', 'group', 'budget',
      'dimension', 'D4',
      'title_key', 'dashboard.todo.budget_no_day_factors',
      'description_key', 'dashboard.todo.desc.budget_no_day_factors',
      'urgency', 'should',
      'href', '/dashboard/season/'
        || (SELECT season_id FROM active_season)::text
        || '?tab=day'
    ) AS task
    WHERE (SELECT cnt FROM season_budget_check) > 0
      AND (SELECT cnt FROM day_factor_check) = 0
    UNION ALL
    -- no_hour_factors: deep-link to hour-factor tab.
    SELECT jsonb_build_object(
      'id', 'budget.no_hour_factors', 'group', 'budget',
      'dimension', 'D4',
      'title_key', 'dashboard.todo.budget_no_hour_factors',
      'description_key', 'dashboard.todo.desc.budget_no_hour_factors',
      'urgency', 'can_wait',
      'href', '/dashboard/season/'
        || (SELECT season_id FROM active_season)::text
        || '?tab=hour'
    ) AS task
    WHERE (SELECT cnt FROM season_budget_check) > 0
      AND (SELECT cnt FROM hour_factor_check) = 0
  ),
  budget_summary AS (
    SELECT jsonb_build_object(
      'group', 'budget', 'dimension', 'D4',
      'label_key', 'dashboard.todo.group.budget',
      'icon', 'TrendingUp',
      'done', (
        CASE WHEN (SELECT season_id FROM active_season) IS NOT NULL THEN 1 ELSE 0 END +
        CASE WHEN (SELECT cnt FROM season_budget_check) > 0 THEN 1 ELSE 0 END +
        CASE WHEN (SELECT cnt FROM day_factor_check) > 0 THEN 1 ELSE 0 END +
        CASE WHEN (SELECT cnt FROM hour_factor_check) > 0 THEN 1 ELSE 0 END
      ),
      'total', 4,
      'tasks', COALESCE(
        (SELECT jsonb_agg(task) FROM budget_tasks), '[]'::jsonb
      )
    ) AS summary
  ),

  -- C4: Governance
  policy_count AS (
    SELECT count(*) AS cnt FROM policy
    WHERE workspace_id = p_workspace_id
  ),
  profiles_without_assignment AS (
    SELECT count(*) AS cnt FROM active_profiles p
    LEFT JOIN protocol_assignment pa ON pa.profile_id = p.profile_id
    WHERE pa.assignment_id IS NULL
  ),
  incomplete_training AS (
    SELECT count(DISTINCT pa.profile_id) AS cnt
    FROM protocol_assignment pa
    JOIN profile pr ON pr.profile_id = pa.profile_id
      AND pr.workspace_id = p_workspace_id AND pr.is_active = true
    WHERE pa.status != 'completed'
      AND pa.completed_at IS NULL
  ),
  governance_tasks AS (
    SELECT jsonb_build_object(
      'id', 'governance.few_policies', 'group', 'governance',
      'dimension', 'C4',
      'title_key', 'dashboard.todo.gov_few_policies',
      'description_key', 'dashboard.todo.desc.gov_few_policies',
      'urgency', 'critical',
      'href', '/dashboard/governance'
    ) AS task WHERE (SELECT cnt FROM policy_count) < 3
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'governance.unassigned', 'group', 'governance',
      'dimension', 'C4',
      'title_key', 'dashboard.todo.gov_unassigned_profiles',
      'title_params', jsonb_build_object(
        'count', (SELECT cnt FROM profiles_without_assignment)::text
      ),
      'description_key', 'dashboard.todo.desc.gov_unassigned_profiles',
      'urgency', 'should',
      'href', '/dashboard/governance'
    ) AS task WHERE (SELECT cnt FROM profiles_without_assignment) > 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'governance.incomplete_training', 'group', 'governance',
      'dimension', 'C4',
      'title_key', 'dashboard.todo.gov_incomplete_training',
      'title_params', jsonb_build_object(
        'count', (SELECT cnt FROM incomplete_training)::text
      ),
      'description_key', 'dashboard.todo.desc.gov_incomplete_training',
      'urgency', 'should',
      'href', '/dashboard/governance'
    ) AS task WHERE (SELECT cnt FROM incomplete_training) > 0
  ),
  governance_summary AS (
    SELECT jsonb_build_object(
      'group', 'governance', 'dimension', 'C4',
      'label_key', 'dashboard.todo.group.governance',
      'icon', 'ShieldCheck',
      'done', CASE WHEN (SELECT cnt FROM policy_count) >= 3 THEN 1 ELSE 0 END
        + CASE WHEN (SELECT cnt FROM profiles_without_assignment) = 0 THEN 1 ELSE 0 END
        + CASE WHEN (SELECT cnt FROM incomplete_training) = 0 THEN 1 ELSE 0 END,
      'total', 3,
      'tasks', COALESCE(
        (SELECT jsonb_agg(task) FROM governance_tasks), '[]'::jsonb
      )
    ) AS summary
  ),

  -- D6: Schedule
  shift_count AS (
    SELECT count(*) AS cnt FROM schedule_shift
    WHERE workspace_id = p_workspace_id
  ),
  unmanned_shifts AS (
    SELECT count(*) AS cnt FROM schedule_shift
    WHERE workspace_id = p_workspace_id
      AND employee_id IS NULL
      AND shift_date >= current_date
      AND shift_date < current_date + 7
  ),
  template_count AS (
    SELECT count(*) AS cnt FROM schedule_template
    WHERE workspace_id = p_workspace_id
  ),
  upcoming_shifts AS (
    SELECT count(*) AS total_cnt,
      count(*) FILTER (WHERE employee_id IS NOT NULL) AS assigned_cnt
    FROM schedule_shift
    WHERE workspace_id = p_workspace_id
      AND shift_date >= current_date
      AND shift_date < current_date + 7
  ),
  schedule_tasks AS (
    SELECT jsonb_build_object(
      'id', 'schedule.no_shifts', 'group', 'schedule',
      'dimension', 'D6',
      'title_key', 'dashboard.todo.schedule_no_shifts',
      'description_key', 'dashboard.todo.desc.schedule_no_shifts',
      'urgency', 'critical',
      'href', '/dashboard/schedule'
    ) AS task WHERE (SELECT cnt FROM shift_count) = 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'schedule.unmanned', 'group', 'schedule',
      'dimension', 'D6',
      'title_key', 'dashboard.todo.schedule_unmanned',
      'title_params', jsonb_build_object(
        'count', (SELECT cnt FROM unmanned_shifts)::text
      ),
      'description_key', 'dashboard.todo.desc.schedule_unmanned',
      'urgency', 'should',
      'href', '/dashboard/schedule'
    ) AS task WHERE (SELECT cnt FROM unmanned_shifts) > 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'schedule.no_templates', 'group', 'schedule',
      'dimension', 'D6',
      'title_key', 'dashboard.todo.schedule_no_templates',
      'description_key', 'dashboard.todo.desc.schedule_no_templates',
      'urgency', 'can_wait',
      'href', '/dashboard/schedule'
    ) AS task WHERE (SELECT cnt FROM template_count) = 0
  ),
  schedule_summary AS (
    SELECT jsonb_build_object(
      'group', 'schedule', 'dimension', 'D6',
      'label_key', 'dashboard.todo.group.schedule',
      'icon', 'CalendarDays',
      'done', (SELECT assigned_cnt FROM upcoming_shifts),
      'total', (SELECT total_cnt FROM upcoming_shifts),
      'tasks', COALESCE(
        (SELECT jsonb_agg(task) FROM schedule_tasks), '[]'::jsonb
      )
    ) AS summary
  ),

  -- D2 sub: Contracts
  unsigned_contracts AS (
    SELECT count(*) AS cnt FROM employment_contract
    WHERE workspace_id = p_workspace_id
      AND status = 'sent'
  ),
  expiring_contracts AS (
    SELECT count(*) AS cnt FROM employment_contract
    WHERE workspace_id = p_workspace_id
      AND status = 'signed'
      AND end_date IS NOT NULL
      AND end_date < now() + interval '30 days'
  ),
  total_contracts AS (
    SELECT count(*) AS cnt FROM employment_contract
    WHERE workspace_id = p_workspace_id
  ),
  active_contracts AS (
    SELECT count(*) AS cnt FROM employment_contract
    WHERE workspace_id = p_workspace_id
      AND status = 'signed'
  ),
  contract_tasks AS (
    SELECT jsonb_build_object(
      'id', 'contracts.unsigned', 'group', 'contracts',
      'dimension', 'D2',
      'title_key', 'dashboard.todo.contracts_unsigned',
      'title_params', jsonb_build_object(
        'count', (SELECT cnt FROM unsigned_contracts)::text
      ),
      'description_key', 'dashboard.todo.desc.contracts_unsigned',
      'urgency', 'should',
      'href', '/dashboard/people'
    ) AS task WHERE (SELECT cnt FROM unsigned_contracts) > 0
    UNION ALL
    SELECT jsonb_build_object(
      'id', 'contracts.expiring', 'group', 'contracts',
      'dimension', 'D2',
      'title_key', 'dashboard.todo.contracts_expiring',
      'title_params', jsonb_build_object(
        'count', (SELECT cnt FROM expiring_contracts)::text
      ),
      'description_key', 'dashboard.todo.desc.contracts_expiring',
      'urgency', 'should',
      'href', '/dashboard/people'
    ) AS task WHERE (SELECT cnt FROM expiring_contracts) > 0
  ),
  contracts_summary AS (
    SELECT jsonb_build_object(
      'group', 'contracts', 'dimension', 'D2',
      'label_key', 'dashboard.todo.group.contracts',
      'icon', 'FileText',
      'done', (SELECT cnt FROM active_contracts),
      'total', (SELECT cnt FROM total_contracts),
      'tasks', COALESCE(
        (SELECT jsonb_agg(task) FROM contract_tasks), '[]'::jsonb
      )
    ) AS summary
  ),

  -- C2: Messages
  pending_proposals AS (
    SELECT count(*) AS cnt FROM change_proposal
    WHERE workspace_id = p_workspace_id
      AND status = 'pending'
  ),
  messages_tasks AS (
    SELECT jsonb_build_object(
      'id', 'messages.pending_decisions', 'group', 'messages',
      'dimension', 'C4',
      'title_key', 'dashboard.todo.messages_pending_decisions',
      'title_params', jsonb_build_object(
        'count', (SELECT cnt FROM pending_proposals)::text
      ),
      'description_key', 'dashboard.todo.desc.messages_pending_decisions',
      'urgency', 'should',
      'href', '/dashboard/notifications'
    ) AS task WHERE (SELECT cnt FROM pending_proposals) > 0
  ),
  messages_summary AS (
    SELECT jsonb_build_object(
      'group', 'messages', 'dimension', 'C4',
      'label_key', 'dashboard.todo.group.messages',
      'icon', 'MessageSquare',
      'done', CASE WHEN (SELECT cnt FROM pending_proposals) = 0 THEN 1 ELSE 0 END,
      'total', 1,
      'tasks', COALESCE(
        (SELECT jsonb_agg(task) FROM messages_tasks), '[]'::jsonb
      )
    ) AS summary
  ),

  -- Assemble
  all_groups AS (
    SELECT summary FROM dept_summary
    UNION ALL SELECT summary FROM staff_summary
    UNION ALL SELECT summary FROM framework_summary
    UNION ALL SELECT summary FROM budget_summary
    UNION ALL SELECT summary FROM governance_summary
    UNION ALL SELECT summary FROM schedule_summary
    UNION ALL SELECT summary FROM contracts_summary
    UNION ALL SELECT summary FROM messages_summary
  ),
  all_tasks AS (
    SELECT task FROM all_dept_tasks
    UNION ALL SELECT task FROM staff_tasks
    UNION ALL SELECT task FROM framework_tasks
    UNION ALL SELECT task FROM budget_tasks
    UNION ALL SELECT task FROM governance_tasks
    UNION ALL SELECT task FROM schedule_tasks
    UNION ALL SELECT task FROM contract_tasks
    UNION ALL SELECT task FROM messages_tasks
  )
  SELECT jsonb_build_object(
    'groups', COALESCE((SELECT jsonb_agg(summary) FROM all_groups), '[]'::jsonb),
    'total_tasks', (SELECT count(*) FROM all_tasks),
    'critical_count', (
      SELECT count(*) FROM all_tasks WHERE task->>'urgency' = 'critical'
    ),
    'should_count', (
      SELECT count(*) FROM all_tasks WHERE task->>'urgency' = 'should'
    )
  ) INTO result;

  RETURN result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.search_dependency_graph(p_workspace_id uuid, p_query text, p_limit integer DEFAULT 5)
 RETURNS TABLE(policy_id uuid, policy_name text, protocol_id uuid, protocol_name text, procedure_id uuid, procedure_name text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT pol.policy_id, pol.name, pr.protocol_id, pr.name, pc.procedure_id, pc.name
  FROM policy pol LEFT JOIN protocol pr ON pr.policy_id = pol.policy_id LEFT JOIN procedure pc ON pc.protocol_id = pr.protocol_id
  WHERE pol.workspace_id = p_workspace_id AND (pol.name ilike ('%' || p_query || '%') OR pr.name ilike ('%' || p_query || '%') OR pc.name ilike ('%' || p_query || '%'))
  LIMIT p_limit
$function$
;

CREATE OR REPLACE FUNCTION public.search_instance(p_workspace_id uuid, p_query text, p_limit integer DEFAULT 5)
 RETURNS TABLE(group_name text, result_id text, title text, subtitle text, deep_link text, relevance double precision)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT 'people', p.profile_id::text, coalesce(p.display_name,''), coalesce(p.role::text,''), '/dashboard/people/' || p.profile_id::text, 0.9
  FROM profile p WHERE p.workspace_id = p_workspace_id AND p.display_name ilike ('%' || p_query || '%') LIMIT p_limit
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

create or replace view "public"."v_current_plan_preview" as  SELECT c.company_id,
    c.name AS company_name,
    w.workspace_id,
    w.name AS workspace_name,
    pt.pricing_terms_id,
    pt.monthly_cost,
    pt.price_per_employee,
    pt.free_users,
    pt.overage_price_per_user,
    pt.billing_interval,
    pt.delivery_channel,
    pt.invoice_format,
    ( SELECT count(DISTINCT schedule_shift.employee_id) AS count
           FROM public.schedule_shift
          WHERE ((schedule_shift.workspace_id = w.workspace_id) AND (schedule_shift.status = 'completed'::public.shift_status) AND (schedule_shift.employee_id IS NOT NULL) AND (schedule_shift.shift_date >= (date_trunc('month'::text, now()))::date) AND (schedule_shift.shift_date < ((date_trunc('month'::text, now()) + '1 mon'::interval))::date))) AS active_users_current_month
   FROM ((public.company c
     JOIN public.workspace w ON ((w.company_id = c.company_id)))
     LEFT JOIN public.pricing_terms pt ON (((pt.company_id = c.company_id) AND ((pt.effective_until IS NULL) OR (pt.effective_until >= CURRENT_DATE)) AND (pt.effective_from <= CURRENT_DATE))));



