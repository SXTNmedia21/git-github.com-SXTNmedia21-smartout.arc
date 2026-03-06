-- =============================================================================
-- Döner Bros Showcase Seed
-- =============================================================================
-- Full-fledged restaurant workspace for Döner Bros kebab chain in Oslo.
-- 5 locations, 50 employees, 3 months of shifts, governance, contracts, budget.
--
-- Prerequisites:
--   - All restaurant template functions loaded (run _apply.sql first)
--   - Supabase local running with auth schema
--
-- Usage:
--   1. Load template functions:
--      psql -f supabase/templates/restaurant/_apply.sql
--   2. Run this seed:
--      psql -f supabase/seed/doner-bros-showcase.sql
--
-- Both steps are required. Template functions must exist before this seed runs.
-- =============================================================================

BEGIN;

-- ─── UUIDs ──────────────────────────────────────────────────────────────────
-- Using 'db' prefix to avoid collision with existing seed (a/b/c/d/e/f series)
DO $$
DECLARE
  v_company_id    uuid := 'db000000-0000-0000-0000-000000000001';
  v_workspace_id  uuid := 'db000000-0000-0000-0000-000000000002';
  v_admin_user_id uuid := 'db000000-0000-0000-0000-000000000003';
  v_season_id     uuid := 'db000000-0000-0000-0000-000000000004';
  v_instance_id   uuid := '00000000-0000-0000-0000-000000000000';
  v_admin_profile uuid;
  v_loc1 uuid;
  v_loc2 uuid;
  v_loc3 uuid;
  v_loc4 uuid;
  v_loc5 uuid;
BEGIN

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 1. COMPANY
  -- ═══════════════════════════════════════════════════════════════════════════
  INSERT INTO public.company (
    company_id, name, legal_name, org_number, country, industry
  ) VALUES (
    v_company_id,
    'Döner Bros',
    'Döner Bros AS',
    '929506293',
    'NO',
    'restaurant'
  ) ON CONFLICT (company_id) DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 2. WORKSPACE
  -- ═══════════════════════════════════════════════════════════════════════════
  INSERT INTO public.workspace (
    workspace_id, company_id, name, slug, description,
    timezone, currency, language, country
  ) VALUES (
    v_workspace_id,
    v_company_id,
    'Döner Bros Oslo',
    'doner-bros',
    'Kebab, fries and good vibes — 5 locations across Oslo. Berlin-style döner since 2020. Best kebab in town (Aftenposten 2021, Wolt 2022, Dagbladet 2023).',
    'Europe/Oslo',
    'NOK',
    'no',
    'NO'
  ) ON CONFLICT (workspace_id) DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 3. ADMIN USER (trigger creates user_identity)
  -- ═══════════════════════════════════════════════════════════════════════════
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new,
    email_change_token_current, email_change, phone, phone_change,
    phone_change_token, reauthentication_token
  ) VALUES (
    v_admin_user_id, v_instance_id,
    'authenticated', 'authenticated',
    'admin@donerbros.no',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"first_name": "Mehmet", "last_name": "Yilmaz"}',
    '{"provider": "email", "providers": ["email"]}',
    now(), now(), '', '', '', '', '', '+4798765432', '', '', ''
  ) ON CONFLICT (id) DO NOTHING;

  -- Grant godmode (platform-admin access)
  UPDATE public.user_identity
  SET is_godmode = true
  WHERE user_id = v_admin_user_id;

  -- Company member
  INSERT INTO public.company_member (user_id, company_id, role, title, is_active)
  VALUES (v_admin_user_id, v_company_id, 'owner', 'Daglig leder', true)
  ON CONFLICT DO NOTHING;

  -- Admin profile in workspace
  INSERT INTO public.profile (
    workspace_id, company_id, user_id, profile_code, role, status, display_name
  ) VALUES (
    v_workspace_id, v_company_id, v_admin_user_id, 'DB-001', 'owner', 'active',
    'Mehmet Yilmaz'
  )
  ON CONFLICT DO NOTHING
  RETURNING profile_id INTO v_admin_profile;

  IF v_admin_profile IS NULL THEN
    SELECT profile_id INTO v_admin_profile FROM public.profile
    WHERE workspace_id = v_workspace_id AND user_id = v_admin_user_id;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 4. SEASON (required by budget template)
  -- ═══════════════════════════════════════════════════════════════════════════
  INSERT INTO public.season (
    season_id, workspace_id, name, slug, description,
    season_type, start_date, end_date, status, is_default, created_by
  ) VALUES (
    v_season_id, v_workspace_id,
    'Vår/Sommer 2026',
    'var-sommer-2026',
    'Hovedsesong vår og sommer. Uteservering åpner april. Høysesong juni-august.',
    'calendar',
    '2026-03-01',
    '2026-08-31',
    'active',
    true,
    v_admin_profile
  ) ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 5. DEPARTMENTS & POSITIONS (from template)
  -- ═══════════════════════════════════════════════════════════════════════════
  -- The restaurant template creates 7 departments with ~20 positions.
  -- For a kebab chain we keep: Kjøkken, Restaurant, Bar, Levering, Renhold.
  -- Catering and Event are less relevant but harmless for demo purposes.
  PERFORM template_restaurant_departments(v_workspace_id);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 6. FIVE LOCATIONS (custom — Döner Bros specific)
  -- ═══════════════════════════════════════════════════════════════════════════

  -- Location 1: Flagship — Osterhaus' gate 12, St. Hanshaugen
  INSERT INTO public.location (workspace_id, name, slug, location_type, address)
  VALUES (v_workspace_id, 'Döner Bros Torggata', 'torggata', 'main',
          'Osterhaus'' gate 12, 0183 Oslo')
  RETURNING location_id INTO v_loc1;

  -- Location 2: Oslo S — Jernbanetorget 1
  INSERT INTO public.location (workspace_id, name, slug, location_type, address)
  VALUES (v_workspace_id, 'Döner Bros Oslo S', 'oslo-s', 'main',
          'Jernbanetorget 1, 0154 Oslo')
  RETURNING location_id INTO v_loc2;

  -- Location 3: Oslo City — Stenersgata 1
  INSERT INTO public.location (workspace_id, name, slug, location_type, address)
  VALUES (v_workspace_id, 'Döner Bros Oslo City', 'oslo-city', 'main',
          'Stenersgata 1, 0050 Oslo')
  RETURNING location_id INTO v_loc3;

  -- Location 4: Karl Johan — Karl Johans gate 1
  INSERT INTO public.location (workspace_id, name, slug, location_type, address)
  VALUES (v_workspace_id, 'Döner Bros Karl Johan', 'karl-johan', 'main',
          'Karl Johans gate 1, 0154 Oslo')
  RETURNING location_id INTO v_loc4;

  -- Location 5: Grünerløkka — Thorvald Meyers gate 30
  INSERT INTO public.location (workspace_id, name, slug, location_type, address)
  VALUES (v_workspace_id, 'Döner Bros Grünerløkka', 'grunerlokka', 'main',
          'Thorvald Meyers gate 30, 0555 Oslo')
  RETURNING location_id INTO v_loc5;

  -- ─── Zones per location ────────────────────────────────────────────────
  -- Flagship (Torggata) — largest, full setup
  INSERT INTO public.zone (workspace_id, location_id, name, slug, description, capacity, sort_order) VALUES
    (v_workspace_id, v_loc1, 'Bestillingsdisk', 'torggata-disk', 'Touchskjerm-bestilling og kasse', NULL, 0),
    (v_workspace_id, v_loc1, 'Spisesal', 'torggata-sal', 'Hovedsal med sitteplasser og TV-skjermer', 45, 1),
    (v_workspace_id, v_loc1, 'Kjøkken', 'torggata-kjokken', 'Produksjonskjøkken med grill, frityrkokere og prep-stasjon', NULL, 2),
    (v_workspace_id, v_loc1, 'Uteservering', 'torggata-ute', 'Fortauscafe med parasoller. Sesongbasert apr-sep.', 20, 3),
    (v_workspace_id, v_loc1, 'Lager', 'torggata-lager', 'Kjøle- og tørrlager, emballasje', NULL, 4),
    (v_workspace_id, v_loc1, 'Personalrom', 'torggata-personal', 'Garderobe og pauserom', NULL, 5)
  ON CONFLICT DO NOTHING;

  -- Oslo S — medium, high footfall
  INSERT INTO public.zone (workspace_id, location_id, name, slug, description, capacity, sort_order) VALUES
    (v_workspace_id, v_loc2, 'Bestillingsdisk', 'oslos-disk', 'Touchskjerm-bestilling og kasse', NULL, 0),
    (v_workspace_id, v_loc2, 'Spisesal', 'oslos-sal', 'Sitteplasser ved vindu mot Jernbanetorget', 30, 1),
    (v_workspace_id, v_loc2, 'Kjøkken', 'oslos-kjokken', 'Kompakt kjøkken, grill og frityr', NULL, 2),
    (v_workspace_id, v_loc2, 'Lager', 'oslos-lager', 'Kjølelager i kjeller', NULL, 3)
  ON CONFLICT DO NOTHING;

  -- Oslo City — mall food court style
  INSERT INTO public.zone (workspace_id, location_id, name, slug, description, capacity, sort_order) VALUES
    (v_workspace_id, v_loc3, 'Disk og kasse', 'city-disk', 'Bestillingsdisk i food court', NULL, 0),
    (v_workspace_id, v_loc3, 'Fellesareal', 'city-felles', 'Delt sitteområde i kjøpesenter', 60, 1),
    (v_workspace_id, v_loc3, 'Kjøkken', 'city-kjokken', 'Åpent kjøkken bak disk', NULL, 2)
  ON CONFLICT DO NOTHING;

  -- Karl Johan — street-level, compact
  INSERT INTO public.zone (workspace_id, location_id, name, slug, description, capacity, sort_order) VALUES
    (v_workspace_id, v_loc4, 'Bestillingsdisk', 'kj-disk', 'Touchskjerm-bestilling', NULL, 0),
    (v_workspace_id, v_loc4, 'Spisesal', 'kj-sal', 'Kompakt spisesal med bardisk langs vindu', 25, 1),
    (v_workspace_id, v_loc4, 'Kjøkken', 'kj-kjokken', 'Produksjonskjøkken', NULL, 2),
    (v_workspace_id, v_loc4, 'Lager', 'kj-lager', 'Lite lagerrom', NULL, 3)
  ON CONFLICT DO NOTHING;

  -- Grünerløkka — trendy neighborhood, outdoor focus
  INSERT INTO public.zone (workspace_id, location_id, name, slug, description, capacity, sort_order) VALUES
    (v_workspace_id, v_loc5, 'Bestillingsdisk', 'gl-disk', 'Touchskjerm-bestilling og kasse', NULL, 0),
    (v_workspace_id, v_loc5, 'Spisesal', 'gl-sal', 'Industriell stil med murvegger og neonlys', 35, 1),
    (v_workspace_id, v_loc5, 'Kjøkken', 'gl-kjokken', 'Åpent kjøkken med utsikt fra sal', NULL, 2),
    (v_workspace_id, v_loc5, 'Uteservering', 'gl-ute', 'Bakgård med strengelys og benker. Apr-sep.', 30, 3),
    (v_workspace_id, v_loc5, 'Lager', 'gl-lager', 'Kjøle- og tørrlager', NULL, 4)
  ON CONFLICT DO NOTHING;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 7. GOVERNANCE (policies, protocols, procedures, routines, tests)
  -- ═══════════════════════════════════════════════════════════════════════════
  PERFORM template_restaurant_policies(v_workspace_id);
  PERFORM template_restaurant_governance(v_workspace_id);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 8. EMPLOYEES (50 staff reused from template auth.users)
  -- ═══════════════════════════════════════════════════════════════════════════
  -- The template auth.users already exist (from HQ workspace seed).
  -- We reuse them: add company_members + profiles for the Döner Bros workspace.
  -- This avoids email uniqueness collisions in auth.users.

  -- Look up department IDs for profile assignment
  DECLARE
    v_dept_kjokken uuid;
    v_dept_restaurant uuid;
    v_dept_bar uuid;
    v_dept_catering uuid;
    v_dept_renhold uuid;
    v_dept_levering uuid;
    v_dept_event uuid;
    v_emp_user_id uuid;
    v_emp_idx integer;
  BEGIN
    SELECT department_id INTO v_dept_kjokken FROM public.department WHERE workspace_id = v_workspace_id AND slug = 'kjokken';
    SELECT department_id INTO v_dept_restaurant FROM public.department WHERE workspace_id = v_workspace_id AND slug = 'restaurant';
    SELECT department_id INTO v_dept_bar FROM public.department WHERE workspace_id = v_workspace_id AND slug = 'bar';
    SELECT department_id INTO v_dept_catering FROM public.department WHERE workspace_id = v_workspace_id AND slug = 'catering';
    SELECT department_id INTO v_dept_renhold FROM public.department WHERE workspace_id = v_workspace_id AND slug = 'renhold';
    SELECT department_id INTO v_dept_levering FROM public.department WHERE workspace_id = v_workspace_id AND slug = 'levering';
    SELECT department_id INTO v_dept_event FROM public.department WHERE workspace_id = v_workspace_id AND slug = 'event';

    -- Create 50 profiles reusing existing auth.users from HQ workspace
    -- HQ workspace used: md5('b0000000-0000-0000-0000-000000000000' || '-emp-N')::uuid
    -- We use the SAME user IDs but create NEW profiles in the Döner Bros workspace
    FOR v_emp_idx IN 1..50 LOOP
      v_emp_user_id := md5('b0000000-0000-0000-0000-000000000000' || '-emp-' || v_emp_idx)::uuid;

      -- Add company_member if not already member of this company
      INSERT INTO public.company_member (user_id, company_id, role, is_active)
      VALUES (v_emp_user_id, v_company_id, 'member', true)
      ON CONFLICT DO NOTHING;

      -- Create profile in Döner Bros workspace
      INSERT INTO public.profile (
        profile_code, user_id, workspace_id, company_id,
        role, status, department_id, display_name, job_title
      ) VALUES (
        'DB-' || lpad(v_emp_idx::text, 3, '0'),
        v_emp_user_id,
        v_workspace_id,
        v_company_id,
        CASE
          WHEN v_emp_idx IN (1, 7, 12, 16) THEN 'manager'::profile_role
          ELSE 'employee'::profile_role
        END,
        CASE
          WHEN v_emp_idx BETWEEN 36 AND 40 THEN 'trainee'::profile_status
          ELSE 'active'::profile_status
        END,
        CASE
          WHEN v_emp_idx BETWEEN 1  AND 6  THEN v_dept_kjokken
          WHEN v_emp_idx BETWEEN 7  AND 11 THEN v_dept_restaurant
          WHEN v_emp_idx BETWEEN 12 AND 15 THEN v_dept_bar
          WHEN v_emp_idx BETWEEN 16 AND 18 THEN v_dept_catering
          WHEN v_emp_idx BETWEEN 19 AND 21 THEN v_dept_renhold
          WHEN v_emp_idx BETWEEN 22 AND 23 THEN v_dept_levering
          WHEN v_emp_idx BETWEEN 24 AND 25 THEN v_dept_event
          WHEN v_emp_idx BETWEEN 26 AND 27 THEN v_dept_kjokken     -- foreign kitchen
          WHEN v_emp_idx BETWEEN 28 AND 29 THEN v_dept_restaurant  -- foreign restaurant
          WHEN v_emp_idx BETWEEN 30 AND 31 THEN v_dept_bar         -- foreign bar
          WHEN v_emp_idx BETWEEN 32 AND 35 THEN v_dept_renhold     -- foreign other
          WHEN v_emp_idx BETWEEN 36 AND 40 THEN v_dept_restaurant  -- minors
          WHEN v_emp_idx BETWEEN 41 AND 44 THEN v_dept_restaurant  -- pensioners
          WHEN v_emp_idx BETWEEN 45 AND 50 THEN v_dept_restaurant  -- freelancers
        END,
        -- Get display_name from user_identity
        (SELECT COALESCE(first_name || ' ' || last_name, email)
         FROM public.user_identity WHERE user_id = v_emp_user_id),
        CASE
          WHEN v_emp_idx BETWEEN 1  AND 6  THEN 'Kokk'
          WHEN v_emp_idx BETWEEN 7  AND 11 THEN 'Servitør'
          WHEN v_emp_idx BETWEEN 12 AND 15 THEN 'Bartender'
          WHEN v_emp_idx BETWEEN 16 AND 18 THEN 'Cateringmedarbeider'
          WHEN v_emp_idx BETWEEN 19 AND 21 THEN 'Renholder'
          WHEN v_emp_idx BETWEEN 22 AND 23 THEN 'Sjåfør'
          WHEN v_emp_idx BETWEEN 24 AND 25 THEN 'Eventmedarbeider'
          WHEN v_emp_idx BETWEEN 26 AND 27 THEN 'Kokk'
          WHEN v_emp_idx BETWEEN 28 AND 31 THEN 'Servitør'
          WHEN v_emp_idx BETWEEN 32 AND 35 THEN 'Renholder'
          WHEN v_emp_idx BETWEEN 36 AND 44 THEN 'Hjelpeservitør'
          WHEN v_emp_idx BETWEEN 45 AND 50 THEN 'Frilanser'
        END
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END;

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 9. SCHEDULE (3 months of shifts for all 50 employees)
  -- ═══════════════════════════════════════════════════════════════════════════
  PERFORM template_restaurant_schedule(v_workspace_id);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 10. BUDGET & OPERATING HOURS
  -- ═══════════════════════════════════════════════════════════════════════════
  -- Creates season_budget (NOK 8.5M target), day_factors, hour_factors
  PERFORM template_restaurant_budget(v_workspace_id);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 11. TEAMS & POSITION LINKS
  -- ═══════════════════════════════════════════════════════════════════════════
  -- Creates 4 teams (kjøkken, sal, bar, ledelse), assigns members, links positions to shifts
  PERFORM template_restaurant_teams(v_workspace_id);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 12. PROTOCOL ASSIGNMENTS (Readiness)
  -- ═══════════════════════════════════════════════════════════════════════════
  PERFORM template_restaurant_assignments(v_workspace_id);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 13. EMPLOYMENT CONTRACTS (Riksavtalen 2024-2026)
  -- ═══════════════════════════════════════════════════════════════════════════
  PERFORM template_restaurant_contracts(v_workspace_id);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 14. MATTILSYNET FOOD SAFETY (20 routines, 8 control lists, 4 tests)
  -- ═══════════════════════════════════════════════════════════════════════════
  PERFORM template_restaurant_mattilsynet(v_workspace_id);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 15. ALCOHOL HANDLING & LABOR LAW
  -- ═══════════════════════════════════════════════════════════════════════════
  PERFORM template_restaurant_alcohol_labor(v_workspace_id);

  -- ═══════════════════════════════════════════════════════════════════════════
  -- 16. DISTRIBUTE EMPLOYEES ACROSS LOCATIONS
  -- ═══════════════════════════════════════════════════════════════════════════
  -- Assign profiles to locations via profile.location_id + profile.locations[]:
  --   Torggata (flagship):  employees 0-11  (12 staff — kitchen, restaurant, some bar)
  --   Oslo S:               employees 12-19 (8 staff — bar, catering, cleaning)
  --   Oslo City:            employees 20-27 (8 staff — delivery, event, foreign workers)
  --   Karl Johan:           employees 28-37 (10 staff — foreign workers, minors)
  --   Grünerløkka:          employees 38-49 (12 staff — minors, pensioners, freelancers)

  WITH ordered_profiles AS (
    SELECT profile_id, row_number() OVER (ORDER BY created_at, profile_id) - 1 AS idx
    FROM public.profile
    WHERE workspace_id = v_workspace_id AND user_id != v_admin_user_id
  )
  UPDATE public.profile p
  SET
    location_id = CASE
      WHEN op.idx BETWEEN 0  AND 11 THEN v_loc1  -- Torggata
      WHEN op.idx BETWEEN 12 AND 19 THEN v_loc2  -- Oslo S
      WHEN op.idx BETWEEN 20 AND 27 THEN v_loc3  -- Oslo City
      WHEN op.idx BETWEEN 28 AND 37 THEN v_loc4  -- Karl Johan
      WHEN op.idx BETWEEN 38 AND 49 THEN v_loc5  -- Grünerløkka
    END,
    locations = ARRAY[CASE
      WHEN op.idx BETWEEN 0  AND 11 THEN v_loc1
      WHEN op.idx BETWEEN 12 AND 19 THEN v_loc2
      WHEN op.idx BETWEEN 20 AND 27 THEN v_loc3
      WHEN op.idx BETWEEN 28 AND 37 THEN v_loc4
      WHEN op.idx BETWEEN 38 AND 49 THEN v_loc5
    END]
  FROM ordered_profiles op
  WHERE p.profile_id = op.profile_id;

  -- Also assign admin to the flagship
  UPDATE public.profile
  SET location_id = v_loc1, locations = ARRAY[v_loc1, v_loc2, v_loc3, v_loc4, v_loc5]
  WHERE profile_id = v_admin_profile;

  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  Döner Bros showcase workspace seeded successfully!';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '  Company:    Döner Bros AS (%)' , v_company_id;
  RAISE NOTICE '  Workspace:  Döner Bros Oslo (%)' , v_workspace_id;
  RAISE NOTICE '  Admin:      admin@donerbros.no / password123';
  RAISE NOTICE '  Slug:       doner-bros';
  RAISE NOTICE '';
  RAISE NOTICE '  Locations:';
  RAISE NOTICE '    1. Torggata (flagship) — Osterhaus'' gate 12';
  RAISE NOTICE '    2. Oslo S             — Jernbanetorget 1';
  RAISE NOTICE '    3. Oslo City          — Stenersgata 1';
  RAISE NOTICE '    4. Karl Johan         — Karl Johans gate 1';
  RAISE NOTICE '    5. Grünerløkka        — Thorvald Meyers gate 30';
  RAISE NOTICE '';
  RAISE NOTICE '  Data:';
  RAISE NOTICE '    - 7 departments, ~20 positions';
  RAISE NOTICE '    - 50 employees (diverse mix)';
  RAISE NOTICE '    - ~4,500 shifts (3 months)';
  RAISE NOTICE '    - 32 policies, 22 protocols, 51 procedures';
  RAISE NOTICE '    - 24 routines, 18 control lists, 11 knowledge tests';
  RAISE NOTICE '    - 50 employment contracts (Riksavtalen)';
  RAISE NOTICE '    - Season budget NOK 8.5M, day/hour factors';
  RAISE NOTICE '    - Mattilsynet food safety + alcohol/labor law';
  RAISE NOTICE '';
  RAISE NOTICE '  Login:  http://localhost:3050/login';
  RAISE NOTICE '  Email:  admin@donerbros.no';
  RAISE NOTICE '  Pass:   password123';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';

END;
$$;

COMMIT;
