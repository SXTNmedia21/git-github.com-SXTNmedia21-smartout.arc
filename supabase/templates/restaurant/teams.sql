-- Template: Restaurant Teams & Position Links
-- Industry:   restaurant (NACE 56.101)
-- Creates:    ~35 team_member rows, updates team leaders, links positions to shifts
-- Depends:    departments.sql, employees.sql, governance.sql (teams), schedule.sql (shifts)
-- Usage:      SELECT template_restaurant_teams(p_workspace_id);

CREATE OR REPLACE FUNCTION template_restaurant_teams(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profiles uuid[];
  v_count    integer;

  -- Team IDs
  v_team_kjokken  uuid;
  v_team_sal      uuid;
  v_team_bar      uuid;
  v_team_ledelse  uuid;

  -- Department IDs
  v_dept_kjokken    uuid;
  v_dept_restaurant uuid;
  v_dept_bar        uuid;
  v_dept_catering   uuid;
  v_dept_renhold    uuid;
  v_dept_levering   uuid;
  v_dept_event      uuid;

  -- Position IDs
  v_pos_kokk              uuid;
  v_pos_servitor          uuid;
  v_pos_bartender         uuid;
  v_pos_cateringmedarb    uuid;
  v_pos_renholder         uuid;
  v_pos_sjafor            uuid;
  v_pos_eventmedarb       uuid;
  v_pos_hjelpeservitor    uuid;
BEGIN
  ---------------------------------------------------------------------------
  -- 1. Load all profiles ordered by created_at, profile_id (0-indexed = array[1]-based)
  ---------------------------------------------------------------------------
  SELECT array_agg(profile_id ORDER BY created_at, profile_id)
    INTO v_profiles
    FROM public.profile
   WHERE workspace_id = p_workspace_id;

  v_count := coalesce(array_length(v_profiles, 1), 0);

  IF v_count < 50 THEN
    RAISE EXCEPTION 'Need at least 50 profiles, found %', v_count;
  END IF;

  ---------------------------------------------------------------------------
  -- 2. Look up team IDs by slug
  ---------------------------------------------------------------------------
  SELECT team_id INTO v_team_kjokken
    FROM public.team
   WHERE workspace_id = p_workspace_id AND slug = 'kjokkenteam'
   LIMIT 1;

  SELECT team_id INTO v_team_sal
    FROM public.team
   WHERE workspace_id = p_workspace_id AND slug = 'salteam'
   LIMIT 1;

  SELECT team_id INTO v_team_bar
    FROM public.team
   WHERE workspace_id = p_workspace_id AND slug = 'barteam'
   LIMIT 1;

  SELECT team_id INTO v_team_ledelse
    FROM public.team
   WHERE workspace_id = p_workspace_id AND slug = 'ledelsesteam'
   LIMIT 1;

  IF v_team_kjokken IS NULL OR v_team_sal IS NULL OR v_team_bar IS NULL OR v_team_ledelse IS NULL THEN
    RAISE EXCEPTION 'Missing teams. Found kjokken=%, sal=%, bar=%, ledelse=%',
      v_team_kjokken, v_team_sal, v_team_bar, v_team_ledelse;
  END IF;

  ---------------------------------------------------------------------------
  -- 3. Look up department IDs by slug
  ---------------------------------------------------------------------------
  SELECT department_id INTO v_dept_kjokken
    FROM public.department WHERE workspace_id = p_workspace_id AND slug = 'kjokken';
  SELECT department_id INTO v_dept_restaurant
    FROM public.department WHERE workspace_id = p_workspace_id AND slug = 'restaurant';
  SELECT department_id INTO v_dept_bar
    FROM public.department WHERE workspace_id = p_workspace_id AND slug = 'bar';
  SELECT department_id INTO v_dept_catering
    FROM public.department WHERE workspace_id = p_workspace_id AND slug = 'catering';
  SELECT department_id INTO v_dept_renhold
    FROM public.department WHERE workspace_id = p_workspace_id AND slug = 'renhold';
  SELECT department_id INTO v_dept_levering
    FROM public.department WHERE workspace_id = p_workspace_id AND slug = 'levering';
  SELECT department_id INTO v_dept_event
    FROM public.department WHERE workspace_id = p_workspace_id AND slug = 'event';

  ---------------------------------------------------------------------------
  -- 4. Look up position IDs by slug + department
  ---------------------------------------------------------------------------
  SELECT position_id INTO v_pos_kokk
    FROM public.position
   WHERE workspace_id = p_workspace_id AND department_id = v_dept_kjokken AND slug = 'kokk'
   LIMIT 1;

  SELECT position_id INTO v_pos_servitor
    FROM public.position
   WHERE workspace_id = p_workspace_id AND department_id = v_dept_restaurant AND slug = 'servitor'
   LIMIT 1;

  SELECT position_id INTO v_pos_bartender
    FROM public.position
   WHERE workspace_id = p_workspace_id AND department_id = v_dept_bar AND slug = 'bartender'
   LIMIT 1;

  SELECT position_id INTO v_pos_cateringmedarb
    FROM public.position
   WHERE workspace_id = p_workspace_id AND department_id = v_dept_catering AND slug = 'cateringmedarbeider'
   LIMIT 1;

  SELECT position_id INTO v_pos_renholder
    FROM public.position
   WHERE workspace_id = p_workspace_id AND department_id = v_dept_renhold AND slug = 'renholder'
   LIMIT 1;

  SELECT position_id INTO v_pos_sjafor
    FROM public.position
   WHERE workspace_id = p_workspace_id AND department_id = v_dept_levering AND slug = 'sjafor'
   LIMIT 1;

  SELECT position_id INTO v_pos_eventmedarb
    FROM public.position
   WHERE workspace_id = p_workspace_id AND department_id = v_dept_event AND slug = 'eventmedarbeider'
   LIMIT 1;

  -- Hjelpeservitor may not exist in departments.sql — look up by name in Restaurant dept
  SELECT position_id INTO v_pos_hjelpeservitor
    FROM public.position
   WHERE workspace_id = p_workspace_id AND department_id = v_dept_restaurant
     AND (slug = 'hjelpeservitor' OR name = 'Hjelpeservitør')
   LIMIT 1;

  ---------------------------------------------------------------------------
  -- 5. Insert team members (ON CONFLICT DO NOTHING for idempotency)
  ---------------------------------------------------------------------------

  -- Kjøkkenteam: employees 0-5 (kitchen) + 25-26 (foreign kitchen) = 8 members
  INSERT INTO public.team_member (team_id, profile_id)
  VALUES
    (v_team_kjokken, v_profiles[1]),   -- employee 0
    (v_team_kjokken, v_profiles[2]),   -- employee 1
    (v_team_kjokken, v_profiles[3]),   -- employee 2
    (v_team_kjokken, v_profiles[4]),   -- employee 3
    (v_team_kjokken, v_profiles[5]),   -- employee 4
    (v_team_kjokken, v_profiles[6]),   -- employee 5
    (v_team_kjokken, v_profiles[26]),  -- employee 25 (foreign kitchen)
    (v_team_kjokken, v_profiles[27])   -- employee 26 (foreign kitchen)
  ON CONFLICT DO NOTHING;

  -- Salteam: employees 6-10 (restaurant) + 27-28 (foreign restaurant) + 35-39 (minors) + 40-43 (pensioners) = 17 members
  INSERT INTO public.team_member (team_id, profile_id)
  VALUES
    (v_team_sal, v_profiles[7]),   -- employee 6
    (v_team_sal, v_profiles[8]),   -- employee 7
    (v_team_sal, v_profiles[9]),   -- employee 8
    (v_team_sal, v_profiles[10]),  -- employee 9
    (v_team_sal, v_profiles[11]),  -- employee 10
    (v_team_sal, v_profiles[28]),  -- employee 27 (foreign restaurant)
    (v_team_sal, v_profiles[29]),  -- employee 28 (foreign restaurant)
    (v_team_sal, v_profiles[36]),  -- employee 35 (minor)
    (v_team_sal, v_profiles[37]),  -- employee 36 (minor)
    (v_team_sal, v_profiles[38]),  -- employee 37 (minor)
    (v_team_sal, v_profiles[39]),  -- employee 38 (minor)
    (v_team_sal, v_profiles[40]),  -- employee 39 (minor)
    (v_team_sal, v_profiles[41]),  -- employee 40 (pensioner)
    (v_team_sal, v_profiles[42]),  -- employee 41 (pensioner)
    (v_team_sal, v_profiles[43]),  -- employee 42 (pensioner)
    (v_team_sal, v_profiles[44])   -- employee 43 (pensioner)
  ON CONFLICT DO NOTHING;

  -- Barteam: employees 11-14 (bar) + 29-30 (foreign bar) = 6 members
  INSERT INTO public.team_member (team_id, profile_id)
  VALUES
    (v_team_bar, v_profiles[12]),  -- employee 11
    (v_team_bar, v_profiles[13]),  -- employee 12
    (v_team_bar, v_profiles[14]),  -- employee 13
    (v_team_bar, v_profiles[15]),  -- employee 14
    (v_team_bar, v_profiles[30]),  -- employee 29 (foreign bar)
    (v_team_bar, v_profiles[31])   -- employee 30 (foreign bar)
  ON CONFLICT DO NOTHING;

  -- Ledelsesteam: employees 0, 6, 11, 15 (department leads) = 4 members
  INSERT INTO public.team_member (team_id, profile_id)
  VALUES
    (v_team_ledelse, v_profiles[1]),   -- employee 0 (kitchen lead)
    (v_team_ledelse, v_profiles[7]),   -- employee 6 (restaurant lead)
    (v_team_ledelse, v_profiles[12]),  -- employee 11 (bar lead)
    (v_team_ledelse, v_profiles[16])   -- employee 15 (catering lead)
  ON CONFLICT DO NOTHING;

  ---------------------------------------------------------------------------
  -- 6. Update team leaders
  ---------------------------------------------------------------------------
  UPDATE public.team SET leader_profile_id = v_profiles[1]   -- employee 0
   WHERE team_id = v_team_kjokken;

  UPDATE public.team SET leader_profile_id = v_profiles[7]   -- employee 6
   WHERE team_id = v_team_sal;

  UPDATE public.team SET leader_profile_id = v_profiles[12]  -- employee 11
   WHERE team_id = v_team_bar;

  UPDATE public.team SET leader_profile_id = v_profiles[1]   -- employee 0 (kitchen lead / admin)
   WHERE team_id = v_team_ledelse;

  ---------------------------------------------------------------------------
  -- 7. Link positions to schedule_shift based on employee department
  ---------------------------------------------------------------------------

  -- Kitchen employees (0-5): position Kokk
  IF v_pos_kokk IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_kokk
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (
         v_profiles[1], v_profiles[2], v_profiles[3],
         v_profiles[4], v_profiles[5], v_profiles[6]
       );
  END IF;

  -- Foreign kitchen (25-26): position Kokk
  IF v_pos_kokk IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_kokk
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (v_profiles[26], v_profiles[27]);
  END IF;

  -- Restaurant employees (6-10): position Servitør
  IF v_pos_servitor IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_servitor
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (
         v_profiles[7], v_profiles[8], v_profiles[9],
         v_profiles[10], v_profiles[11]
       );
  END IF;

  -- Foreign restaurant (27-28): position Servitør
  IF v_pos_servitor IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_servitor
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (v_profiles[28], v_profiles[29]);
  END IF;

  -- Bar employees (11-14): position Bartender
  IF v_pos_bartender IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_bartender
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (
         v_profiles[12], v_profiles[13],
         v_profiles[14], v_profiles[15]
       );
  END IF;

  -- Foreign bar (29-30): position Bartender
  IF v_pos_bartender IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_bartender
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (v_profiles[30], v_profiles[31]);
  END IF;

  -- Catering (15-17, 31): position Cateringmedarbeider
  IF v_pos_cateringmedarb IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_cateringmedarb
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (
         v_profiles[16], v_profiles[17],
         v_profiles[18], v_profiles[32]
       );
  END IF;

  -- Cleaning (18-20, 32): position Renholder
  IF v_pos_renholder IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_renholder
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (
         v_profiles[19], v_profiles[20],
         v_profiles[21], v_profiles[33]
       );
  END IF;

  -- Delivery (21-22, 33): position Sjåfør
  IF v_pos_sjafor IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_sjafor
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (
         v_profiles[22], v_profiles[23], v_profiles[34]
       );
  END IF;

  -- Event (23-24, 34): position Eventmedarbeider
  IF v_pos_eventmedarb IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_eventmedarb
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (
         v_profiles[24], v_profiles[25], v_profiles[35]
       );
  END IF;

  -- Minors (35-39): position Hjelpeservitør in Restaurant dept
  -- Falls back to Servitør if Hjelpeservitør position doesn't exist
  IF v_pos_hjelpeservitor IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_hjelpeservitor
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (
         v_profiles[36], v_profiles[37], v_profiles[38],
         v_profiles[39], v_profiles[40]
       );
  ELSIF v_pos_servitor IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_servitor
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (
         v_profiles[36], v_profiles[37], v_profiles[38],
         v_profiles[39], v_profiles[40]
       );
  END IF;

  -- Pensioners (40-43): position Hjelpeservitør in Restaurant dept
  -- Falls back to Servitør if Hjelpeservitør position doesn't exist
  IF v_pos_hjelpeservitor IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_hjelpeservitor
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (
         v_profiles[41], v_profiles[42],
         v_profiles[43], v_profiles[44]
       );
  ELSIF v_pos_servitor IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_servitor
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (
         v_profiles[41], v_profiles[42],
         v_profiles[43], v_profiles[44]
       );
  END IF;

  -- Freelancers (44-49): position Servitør in Restaurant dept
  IF v_pos_servitor IS NOT NULL THEN
    UPDATE public.schedule_shift SET position_id = v_pos_servitor
     WHERE workspace_id = p_workspace_id
       AND position_id IS NULL
       AND employee_id IN (
         v_profiles[45], v_profiles[46], v_profiles[47],
         v_profiles[48], v_profiles[49], v_profiles[50]
       );
  END IF;

END;
$$;

-- Grant execute to authenticated users (RLS on underlying tables handles access control)
GRANT EXECUTE ON FUNCTION template_restaurant_teams(uuid) TO authenticated;
