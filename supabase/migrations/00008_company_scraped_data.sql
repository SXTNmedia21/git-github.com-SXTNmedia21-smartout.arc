-- Add columns to store raw scraped data and onboarding status
ALTER TABLE public.company
ADD COLUMN raw_scraped_data JSONB,
ADD COLUMN onboarding_status TEXT DEFAULT 'pending';

-- Update the create_workspace_transaction function to accept raw_scraped_data
CREATE OR REPLACE FUNCTION public.create_workspace_transaction(
  p_user_id uuid,
  p_company_name text,
  p_locations jsonb,
  p_departments jsonb,
  p_policies jsonb,
  p_raw_scraped_data jsonb DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;
