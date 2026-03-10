-- Template: Restaurant Employees
-- Industry:   restaurant (NACE 56.101)
-- Employees:  50
-- Types:      25 norskspråklig, 10 ikke-norskspråklig, 5 mindreårig, 4 pensjonist, 6 frilanser
-- Depends:    departments.sql (departments must exist)
-- Usage:      SELECT template_restaurant_employees(p_workspace_id);

CREATE OR REPLACE FUNCTION template_restaurant_employees(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id   uuid;
  v_dept_kjokken uuid;
  v_dept_restaurant uuid;
  v_dept_bar     uuid;
  v_dept_catering uuid;
  v_dept_renhold uuid;
  v_dept_levering uuid;
  v_dept_event   uuid;
  v_user_id      uuid;
  v_instance_id  uuid := '00000000-0000-0000-0000-000000000000';
  v_password     text;
BEGIN
  -- ─── Look up company_id from workspace ────────────────────────────
  SELECT company_id INTO v_company_id
    FROM public.workspace
   WHERE workspace_id = p_workspace_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Workspace % not found', p_workspace_id;
  END IF;

  -- ─── Look up department IDs ───────────────────────────────────────
  SELECT department_id INTO v_dept_kjokken
    FROM public.department WHERE workspace_id = p_workspace_id AND name = 'Kjøkken';
  SELECT department_id INTO v_dept_restaurant
    FROM public.department WHERE workspace_id = p_workspace_id AND name = 'Restaurant';
  SELECT department_id INTO v_dept_bar
    FROM public.department WHERE workspace_id = p_workspace_id AND name = 'Bar';
  SELECT department_id INTO v_dept_catering
    FROM public.department WHERE workspace_id = p_workspace_id AND name = 'Catering';
  SELECT department_id INTO v_dept_renhold
    FROM public.department WHERE workspace_id = p_workspace_id AND name = 'Renhold';
  SELECT department_id INTO v_dept_levering
    FROM public.department WHERE workspace_id = p_workspace_id AND name = 'Levering';
  SELECT department_id INTO v_dept_event
    FROM public.department WHERE workspace_id = p_workspace_id AND name = 'Event';

  -- Pre-compute password hash once
  v_password := crypt('password123', gen_salt('bf'));

  -- ═════════════════════════════════════════════════════════════════
  -- GROUP 1: Native Norwegian adults (25)
  -- ═════════════════════════════════════════════════════════════════

  -- 1. Lars Hansen - Kjøkken - manager - Kokk
  v_user_id := md5(p_workspace_id::text || '-emp-1')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'lars.hansen@template.smartout.local', v_password, now(),
    '{"first_name": "Lars", "last_name": "Hansen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T001', v_user_id, p_workspace_id, v_company_id,
    'manager', 'active', v_dept_kjokken, 'Lars Hansen', 'Kokk'
  ) ON CONFLICT DO NOTHING;

  -- 2. Ingrid Johansen - Kjøkken - employee - Sous Chef
  v_user_id := md5(p_workspace_id::text || '-emp-2')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'ingrid.johansen@template.smartout.local', v_password, now(),
    '{"first_name": "Ingrid", "last_name": "Johansen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T002', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_kjokken, 'Ingrid Johansen', 'Sous Chef'
  ) ON CONFLICT DO NOTHING;

  -- 3. Thomas Berg - Kjøkken - employee - Kokk
  v_user_id := md5(p_workspace_id::text || '-emp-3')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'thomas.berg@template.smartout.local', v_password, now(),
    '{"first_name": "Thomas", "last_name": "Berg"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T003', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_kjokken, 'Thomas Berg', 'Kokk'
  ) ON CONFLICT DO NOTHING;

  -- 4. Marte Nilsen - Kjøkken - employee - Kokk
  v_user_id := md5(p_workspace_id::text || '-emp-4')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'marte.nilsen@template.smartout.local', v_password, now(),
    '{"first_name": "Marte", "last_name": "Nilsen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T004', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_kjokken, 'Marte Nilsen', 'Kokk'
  ) ON CONFLICT DO NOTHING;

  -- 5. Anders Larsen - Kjøkken - employee - Kjøkkenassistent
  v_user_id := md5(p_workspace_id::text || '-emp-5')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'anders.larsen@template.smartout.local', v_password, now(),
    '{"first_name": "Anders", "last_name": "Larsen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T005', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_kjokken, 'Anders Larsen', 'Kjøkkenassistent'
  ) ON CONFLICT DO NOTHING;

  -- 6. Hilde Andreassen - Kjøkken - employee - Oppvaskhjelp
  v_user_id := md5(p_workspace_id::text || '-emp-6')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'hilde.andreassen@template.smartout.local', v_password, now(),
    '{"first_name": "Hilde", "last_name": "Andreassen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T006', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_kjokken, 'Hilde Andreassen', 'Oppvaskhjelp'
  ) ON CONFLICT DO NOTHING;

  -- 7. Karin Svendsen - Restaurant - manager - Hovmester
  v_user_id := md5(p_workspace_id::text || '-emp-7')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'karin.svendsen@template.smartout.local', v_password, now(),
    '{"first_name": "Karin", "last_name": "Svendsen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T007', v_user_id, p_workspace_id, v_company_id,
    'manager', 'active', v_dept_restaurant, 'Karin Svendsen', 'Hovmester'
  ) ON CONFLICT DO NOTHING;

  -- 8. Jonas Pettersen - Restaurant - employee - Servitør
  v_user_id := md5(p_workspace_id::text || '-emp-8')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'jonas.pettersen@template.smartout.local', v_password, now(),
    '{"first_name": "Jonas", "last_name": "Pettersen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T008', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_restaurant, 'Jonas Pettersen', 'Servitør'
  ) ON CONFLICT DO NOTHING;

  -- 9. Silje Olsen - Restaurant - employee - Servitør
  v_user_id := md5(p_workspace_id::text || '-emp-9')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'silje.olsen@template.smartout.local', v_password, now(),
    '{"first_name": "Silje", "last_name": "Olsen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T009', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_restaurant, 'Silje Olsen', 'Servitør'
  ) ON CONFLICT DO NOTHING;

  -- 10. Mathias Kristiansen - Restaurant - employee - Servitør
  v_user_id := md5(p_workspace_id::text || '-emp-10')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'mathias.kristiansen@template.smartout.local', v_password, now(),
    '{"first_name": "Mathias", "last_name": "Kristiansen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T010', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_restaurant, 'Mathias Kristiansen', 'Servitør'
  ) ON CONFLICT DO NOTHING;

  -- 11. Nora Bakke - Restaurant - employee - Servitør
  v_user_id := md5(p_workspace_id::text || '-emp-11')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'nora.bakke@template.smartout.local', v_password, now(),
    '{"first_name": "Nora", "last_name": "Bakke"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T011', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_restaurant, 'Nora Bakke', 'Servitør'
  ) ON CONFLICT DO NOTHING;

  -- 12. Fredrik Moen - Bar - manager - Bartender
  v_user_id := md5(p_workspace_id::text || '-emp-12')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'fredrik.moen@template.smartout.local', v_password, now(),
    '{"first_name": "Fredrik", "last_name": "Moen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T012', v_user_id, p_workspace_id, v_company_id,
    'manager', 'active', v_dept_bar, 'Fredrik Moen', 'Bartender'
  ) ON CONFLICT DO NOTHING;

  -- 13. Camilla Dahl - Bar - employee - Bartender
  v_user_id := md5(p_workspace_id::text || '-emp-13')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'camilla.dahl@template.smartout.local', v_password, now(),
    '{"first_name": "Camilla", "last_name": "Dahl"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T013', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_bar, 'Camilla Dahl', 'Bartender'
  ) ON CONFLICT DO NOTHING;

  -- 14. Henrik Holm - Bar - employee - Bartender
  v_user_id := md5(p_workspace_id::text || '-emp-14')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'henrik.holm@template.smartout.local', v_password, now(),
    '{"first_name": "Henrik", "last_name": "Holm"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T014', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_bar, 'Henrik Holm', 'Bartender'
  ) ON CONFLICT DO NOTHING;

  -- 15. Tuva Lund - Bar - employee - Barback
  v_user_id := md5(p_workspace_id::text || '-emp-15')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'tuva.lund@template.smartout.local', v_password, now(),
    '{"first_name": "Tuva", "last_name": "Lund"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T015', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_bar, 'Tuva Lund', 'Barback'
  ) ON CONFLICT DO NOTHING;

  -- 16. Eirik Solberg - Catering - manager - Cateringsjef
  v_user_id := md5(p_workspace_id::text || '-emp-16')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'eirik.solberg@template.smartout.local', v_password, now(),
    '{"first_name": "Eirik", "last_name": "Solberg"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T016', v_user_id, p_workspace_id, v_company_id,
    'manager', 'active', v_dept_catering, 'Eirik Solberg', 'Cateringsjef'
  ) ON CONFLICT DO NOTHING;

  -- 17. Maria Haugen - Catering - employee - Cateringmedarbeider
  v_user_id := md5(p_workspace_id::text || '-emp-17')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'maria.haugen@template.smartout.local', v_password, now(),
    '{"first_name": "Maria", "last_name": "Haugen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T017', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_catering, 'Maria Haugen', 'Cateringmedarbeider'
  ) ON CONFLICT DO NOTHING;

  -- 18. Petter Aas - Catering - employee - Cateringmedarbeider
  v_user_id := md5(p_workspace_id::text || '-emp-18')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'petter.aas@template.smartout.local', v_password, now(),
    '{"first_name": "Petter", "last_name": "Aas"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T018', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_catering, 'Petter Aas', 'Cateringmedarbeider'
  ) ON CONFLICT DO NOTHING;

  -- 19. Kristine Brekke - Renhold - employee - Renholder
  v_user_id := md5(p_workspace_id::text || '-emp-19')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'kristine.brekke@template.smartout.local', v_password, now(),
    '{"first_name": "Kristine", "last_name": "Brekke"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T019', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_renhold, 'Kristine Brekke', 'Renholder'
  ) ON CONFLICT DO NOTHING;

  -- 20. Stig Ellingsen - Renhold - employee - Renholder
  v_user_id := md5(p_workspace_id::text || '-emp-20')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'stig.ellingsen@template.smartout.local', v_password, now(),
    '{"first_name": "Stig", "last_name": "Ellingsen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T020', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_renhold, 'Stig Ellingsen', 'Renholder'
  ) ON CONFLICT DO NOTHING;

  -- 21. Anne Berit Knutsen - Renhold - employee - Renholder
  v_user_id := md5(p_workspace_id::text || '-emp-21')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'anneberit.knutsen@template.smartout.local', v_password, now(),
    '{"first_name": "Anne Berit", "last_name": "Knutsen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T021', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_renhold, 'Anne Berit Knutsen', 'Renholder'
  ) ON CONFLICT DO NOTHING;

  -- 22. Ole Martin Hagen - Levering - employee - Sjåfør
  v_user_id := md5(p_workspace_id::text || '-emp-22')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'olemartin.hagen@template.smartout.local', v_password, now(),
    '{"first_name": "Ole Martin", "last_name": "Hagen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T022', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_levering, 'Ole Martin Hagen', 'Sjåfør'
  ) ON CONFLICT DO NOTHING;

  -- 23. Rune Sandvik - Levering - employee - Sjåfør
  v_user_id := md5(p_workspace_id::text || '-emp-23')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'rune.sandvik@template.smartout.local', v_password, now(),
    '{"first_name": "Rune", "last_name": "Sandvik"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T023', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_levering, 'Rune Sandvik', 'Sjåfør'
  ) ON CONFLICT DO NOTHING;

  -- 24. Heidi Strand - Event - employee - Eventkoordinator
  v_user_id := md5(p_workspace_id::text || '-emp-24')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'heidi.strand@template.smartout.local', v_password, now(),
    '{"first_name": "Heidi", "last_name": "Strand"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T024', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_event, 'Heidi Strand', 'Eventkoordinator'
  ) ON CONFLICT DO NOTHING;

  -- 25. Torbjørn Lie - Event - employee - Eventmedarbeider
  v_user_id := md5(p_workspace_id::text || '-emp-25')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'torbjorn.lie@template.smartout.local', v_password, now(),
    '{"first_name": "Torbjørn", "last_name": "Lie"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T025', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_event, 'Torbjørn Lie', 'Eventmedarbeider'
  ) ON CONFLICT DO NOTHING;

  -- ═════════════════════════════════════════════════════════════════
  -- GROUP 2: Foreign workers (10)
  -- ═════════════════════════════════════════════════════════════════

  -- 26. Ahmad Al-Rashid - Kjøkken - employee - Kjøkkenassistent - 'en'
  v_user_id := md5(p_workspace_id::text || '-emp-26')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'ahmad.alrashid@template.smartout.local', v_password, now(),
    '{"first_name": "Ahmad", "last_name": "Al-Rashid"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity SET preferred_language = 'en' WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title, language_override
  ) VALUES (
    gen_random_uuid(), 'T026', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_kjokken, 'Ahmad Al-Rashid', 'Kjøkkenassistent', 'en'
  ) ON CONFLICT DO NOTHING;

  -- 27. Fatima Youssef - Kjøkken - employee - Oppvaskhjelp - 'en'
  v_user_id := md5(p_workspace_id::text || '-emp-27')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'fatima.youssef@template.smartout.local', v_password, now(),
    '{"first_name": "Fatima", "last_name": "Youssef"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity SET preferred_language = 'en' WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title, language_override
  ) VALUES (
    gen_random_uuid(), 'T027', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_kjokken, 'Fatima Youssef', 'Oppvaskhjelp', 'en'
  ) ON CONFLICT DO NOTHING;

  -- 28. Pedro Santos - Kjøkken - employee - Kokk - 'en'
  v_user_id := md5(p_workspace_id::text || '-emp-28')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'pedro.santos@template.smartout.local', v_password, now(),
    '{"first_name": "Pedro", "last_name": "Santos"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity SET preferred_language = 'en' WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title, language_override
  ) VALUES (
    gen_random_uuid(), 'T028', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_kjokken, 'Pedro Santos', 'Kokk', 'en'
  ) ON CONFLICT DO NOTHING;

  -- 29. Elena Kowalski - Renhold - employee - Renholder - 'en'
  v_user_id := md5(p_workspace_id::text || '-emp-29')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'elena.kowalski@template.smartout.local', v_password, now(),
    '{"first_name": "Elena", "last_name": "Kowalski"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity SET preferred_language = 'en' WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title, language_override
  ) VALUES (
    gen_random_uuid(), 'T029', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_renhold, 'Elena Kowalski', 'Renholder', 'en'
  ) ON CONFLICT DO NOTHING;

  -- 30. Raj Patel - Kjøkken - employee - Kjøkkenassistent - 'en'
  v_user_id := md5(p_workspace_id::text || '-emp-30')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'raj.patel@template.smartout.local', v_password, now(),
    '{"first_name": "Raj", "last_name": "Patel"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity SET preferred_language = 'en' WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title, language_override
  ) VALUES (
    gen_random_uuid(), 'T030', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_kjokken, 'Raj Patel', 'Kjøkkenassistent', 'en'
  ) ON CONFLICT DO NOTHING;

  -- 31. Sofia Mendez - Restaurant - employee - Servitør - 'en'
  v_user_id := md5(p_workspace_id::text || '-emp-31')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'sofia.mendez@template.smartout.local', v_password, now(),
    '{"first_name": "Sofia", "last_name": "Mendez"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity SET preferred_language = 'en' WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title, language_override
  ) VALUES (
    gen_random_uuid(), 'T031', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_restaurant, 'Sofia Mendez', 'Servitør', 'en'
  ) ON CONFLICT DO NOTHING;

  -- 32. Mikael Johansson - Bar - employee - Bartender - 'sv'
  v_user_id := md5(p_workspace_id::text || '-emp-32')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'mikael.johansson@template.smartout.local', v_password, now(),
    '{"first_name": "Mikael", "last_name": "Johansson"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity SET preferred_language = 'sv' WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title, language_override
  ) VALUES (
    gen_random_uuid(), 'T032', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_bar, 'Mikael Johansson', 'Bartender', 'sv'
  ) ON CONFLICT DO NOTHING;

  -- 33. Anna Lindqvist - Restaurant - employee - Servitør - 'sv'
  v_user_id := md5(p_workspace_id::text || '-emp-33')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'anna.lindqvist@template.smartout.local', v_password, now(),
    '{"first_name": "Anna", "last_name": "Lindqvist"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity SET preferred_language = 'sv' WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title, language_override
  ) VALUES (
    gen_random_uuid(), 'T033', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_restaurant, 'Anna Lindqvist', 'Servitør', 'sv'
  ) ON CONFLICT DO NOTHING;

  -- 34. Yuki Tanaka - Kjøkken - employee - Kokk - 'en'
  v_user_id := md5(p_workspace_id::text || '-emp-34')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'yuki.tanaka@template.smartout.local', v_password, now(),
    '{"first_name": "Yuki", "last_name": "Tanaka"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity SET preferred_language = 'en' WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title, language_override
  ) VALUES (
    gen_random_uuid(), 'T034', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_kjokken, 'Yuki Tanaka', 'Kokk', 'en'
  ) ON CONFLICT DO NOTHING;

  -- 35. Maria Ionescu - Renhold - employee - Renholder - 'en'
  v_user_id := md5(p_workspace_id::text || '-emp-35')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'maria.ionescu@template.smartout.local', v_password, now(),
    '{"first_name": "Maria", "last_name": "Ionescu"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity SET preferred_language = 'en' WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title, language_override
  ) VALUES (
    gen_random_uuid(), 'T035', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_renhold, 'Maria Ionescu', 'Renholder', 'en'
  ) ON CONFLICT DO NOTHING;

  -- ═════════════════════════════════════════════════════════════════
  -- GROUP 3: Minors / mindreårig (5) — status: trainee
  -- ═════════════════════════════════════════════════════════════════

  -- 36. Emma Haugen - Restaurant - employee - Servitør (runner) - trainee
  v_user_id := md5(p_workspace_id::text || '-emp-36')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'emma.haugen@template.smartout.local', v_password, now(),
    '{"first_name": "Emma", "last_name": "Haugen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity
     SET date_of_birth = CURRENT_DATE - INTERVAL '16 years 3 months'
   WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T036', v_user_id, p_workspace_id, v_company_id,
    'employee', 'trainee', v_dept_restaurant, 'Emma Haugen', 'Servitør (runner)'
  ) ON CONFLICT DO NOTHING;

  -- 37. Oliver Berge - Restaurant - employee - Servitør (runner) - trainee
  v_user_id := md5(p_workspace_id::text || '-emp-37')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'oliver.berge@template.smartout.local', v_password, now(),
    '{"first_name": "Oliver", "last_name": "Berge"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity
     SET date_of_birth = CURRENT_DATE - INTERVAL '17 years 1 month'
   WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T037', v_user_id, p_workspace_id, v_company_id,
    'employee', 'trainee', v_dept_restaurant, 'Oliver Berge', 'Servitør (runner)'
  ) ON CONFLICT DO NOTHING;

  -- 38. Sofie Vik - Bar - employee - Barback - trainee
  v_user_id := md5(p_workspace_id::text || '-emp-38')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'sofie.vik@template.smartout.local', v_password, now(),
    '{"first_name": "Sofie", "last_name": "Vik"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity
     SET date_of_birth = CURRENT_DATE - INTERVAL '16 years 8 months'
   WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T038', v_user_id, p_workspace_id, v_company_id,
    'employee', 'trainee', v_dept_bar, 'Sofie Vik', 'Barback'
  ) ON CONFLICT DO NOTHING;

  -- 39. Magnus Tangen - Renhold - employee - Renholder - trainee
  v_user_id := md5(p_workspace_id::text || '-emp-39')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'magnus.tangen@template.smartout.local', v_password, now(),
    '{"first_name": "Magnus", "last_name": "Tangen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity
     SET date_of_birth = CURRENT_DATE - INTERVAL '17 years 5 months'
   WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T039', v_user_id, p_workspace_id, v_company_id,
    'employee', 'trainee', v_dept_renhold, 'Magnus Tangen', 'Renholder'
  ) ON CONFLICT DO NOTHING;

  -- 40. Ida Fossum - Restaurant - employee - Servitør (runner) - trainee
  v_user_id := md5(p_workspace_id::text || '-emp-40')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'ida.fossum@template.smartout.local', v_password, now(),
    '{"first_name": "Ida", "last_name": "Fossum"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity
     SET date_of_birth = CURRENT_DATE - INTERVAL '16 years 11 months'
   WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T040', v_user_id, p_workspace_id, v_company_id,
    'employee', 'trainee', v_dept_restaurant, 'Ida Fossum', 'Servitør (runner)'
  ) ON CONFLICT DO NOTHING;

  -- ═════════════════════════════════════════════════════════════════
  -- GROUP 4: Pensioners / pensjonister (4)
  -- ═════════════════════════════════════════════════════════════════

  -- 41. Bjørn Gulbrandsen - Restaurant - employee - Servitør
  v_user_id := md5(p_workspace_id::text || '-emp-41')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'bjorn.gulbrandsen@template.smartout.local', v_password, now(),
    '{"first_name": "Bjørn", "last_name": "Gulbrandsen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity
     SET date_of_birth = CURRENT_DATE - INTERVAL '68 years'
   WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T041', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_restaurant, 'Bjørn Gulbrandsen', 'Servitør'
  ) ON CONFLICT DO NOTHING;

  -- 42. Astrid Hermansen - Kjøkken - employee - Kokk
  v_user_id := md5(p_workspace_id::text || '-emp-42')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'astrid.hermansen@template.smartout.local', v_password, now(),
    '{"first_name": "Astrid", "last_name": "Hermansen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity
     SET date_of_birth = CURRENT_DATE - INTERVAL '70 years'
   WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T042', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_kjokken, 'Astrid Hermansen', 'Kokk'
  ) ON CONFLICT DO NOTHING;

  -- 43. Gunnar Pedersen - Event - employee - Eventmedarbeider
  v_user_id := md5(p_workspace_id::text || '-emp-43')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'gunnar.pedersen@template.smartout.local', v_password, now(),
    '{"first_name": "Gunnar", "last_name": "Pedersen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity
     SET date_of_birth = CURRENT_DATE - INTERVAL '72 years'
   WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T043', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_event, 'Gunnar Pedersen', 'Eventmedarbeider'
  ) ON CONFLICT DO NOTHING;

  -- 44. Ragnhild Thorsen - Restaurant - employee - Servitør
  v_user_id := md5(p_workspace_id::text || '-emp-44')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'ragnhild.thorsen@template.smartout.local', v_password, now(),
    '{"first_name": "Ragnhild", "last_name": "Thorsen"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  UPDATE public.user_identity
     SET date_of_birth = CURRENT_DATE - INTERVAL '67 years'
   WHERE user_id = v_user_id;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T044', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_restaurant, 'Ragnhild Thorsen', 'Servitør'
  ) ON CONFLICT DO NOTHING;

  -- ═════════════════════════════════════════════════════════════════
  -- GROUP 5: Freelancers / tilkalling (6)
  -- ═════════════════════════════════════════════════════════════════

  -- 45. Marius Lien - Event - employee - Eventmedarbeider (tilkalling)
  v_user_id := md5(p_workspace_id::text || '-emp-45')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'marius.lien@template.smartout.local', v_password, now(),
    '{"first_name": "Marius", "last_name": "Lien"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T045', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_event, 'Marius Lien', 'Tilkalling Eventmedarbeider'
  ) ON CONFLICT DO NOTHING;

  -- 46. Vilde Nygård - Restaurant - employee - Servitør (tilkalling)
  v_user_id := md5(p_workspace_id::text || '-emp-46')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'vilde.nygard@template.smartout.local', v_password, now(),
    '{"first_name": "Vilde", "last_name": "Nygård"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T046', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_restaurant, 'Vilde Nygård', 'Tilkalling Servitør'
  ) ON CONFLICT DO NOTHING;

  -- 47. Sander Ruud - Bar - employee - Bartender (tilkalling)
  v_user_id := md5(p_workspace_id::text || '-emp-47')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'sander.ruud@template.smartout.local', v_password, now(),
    '{"first_name": "Sander", "last_name": "Ruud"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T047', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_bar, 'Sander Ruud', 'Tilkalling Bartender'
  ) ON CONFLICT DO NOTHING;

  -- 48. Julie Fjeld - Catering - employee - Cateringmedarbeider (tilkalling)
  v_user_id := md5(p_workspace_id::text || '-emp-48')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'julie.fjeld@template.smartout.local', v_password, now(),
    '{"first_name": "Julie", "last_name": "Fjeld"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T048', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_catering, 'Julie Fjeld', 'Tilkalling Cateringmedarbeider'
  ) ON CONFLICT DO NOTHING;

  -- 49. Aleksander Bryn - Kjøkken - employee - Kokk (tilkalling)
  v_user_id := md5(p_workspace_id::text || '-emp-49')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'aleksander.bryn@template.smartout.local', v_password, now(),
    '{"first_name": "Aleksander", "last_name": "Bryn"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T049', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_kjokken, 'Aleksander Bryn', 'Tilkalling Kokk'
  ) ON CONFLICT DO NOTHING;

  -- 50. Thea Solheim - Restaurant - employee - Servitør (tilkalling)
  v_user_id := md5(p_workspace_id::text || '-emp-50')::uuid;
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    v_user_id, v_instance_id, 'authenticated', 'authenticated',
    'thea.solheim@template.smartout.local', v_password, now(),
    '{"first_name": "Thea", "last_name": "Solheim"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now()
  ) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profile (
    profile_id, profile_code, user_id, workspace_id, company_id,
    role, status, department_id, display_name, job_title
  ) VALUES (
    gen_random_uuid(), 'T050', v_user_id, p_workspace_id, v_company_id,
    'employee', 'active', v_dept_restaurant, 'Thea Solheim', 'Tilkalling Servitør'
  ) ON CONFLICT DO NOTHING;

END;
$$;
