-- Template: Restaurant Employment Contracts
-- Industry:   restaurant (NACE 56.101)
-- Contracts:  50 (one per employee)
-- Wages:      Riksavtalen 2024-2026 (NHO Reiseliv / Fellesforbundet)
-- Categories: 35 Fast (100%), 5 Deltid (30%), 4 Deltid (40%), 6 Tilkalling
-- References: Arbeidsmiljoloven §14-6, Riksavtalen tariff rates effective 1 April 2024
-- Depends:    employees.sql (profiles must exist)
-- Usage:      SELECT template_restaurant_contracts(p_workspace_id);

CREATE OR REPLACE FUNCTION template_restaurant_contracts(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profiles uuid[];
  v_admin_id uuid;
  v_idx int;
  v_position text;
  v_category text;
  v_pct numeric(5,2);
  v_hourly numeric(10,2);
  v_monthly numeric(10,2);
  v_status contract_status;
  v_start date;
  v_end_date date;
  v_signed timestamptz;
BEGIN
  ---------------------------------------------------------------------------
  -- 1. Load all 50 profiles for this workspace, ordered deterministically
  ---------------------------------------------------------------------------
  SELECT array_agg(profile_id ORDER BY created_at, profile_id)
    INTO v_profiles
    FROM public.profile
   WHERE workspace_id = p_workspace_id;

  IF array_length(v_profiles, 1) IS NULL OR array_length(v_profiles, 1) < 50 THEN
    RAISE EXCEPTION 'Expected 50 profiles for workspace %, found %',
      p_workspace_id, COALESCE(array_length(v_profiles, 1), 0);
  END IF;

  ---------------------------------------------------------------------------
  -- 2. Find an admin/owner profile for created_by
  ---------------------------------------------------------------------------
  SELECT p.profile_id
    INTO v_admin_id
    FROM public.profile p
    JOIN public.company_member cm ON cm.user_id = p.user_id
                                  AND cm.company_id = (
                                    SELECT w.company_id
                                      FROM public.workspace w
                                     WHERE w.workspace_id = p_workspace_id
                                  )
   WHERE p.workspace_id = p_workspace_id
     AND cm.role IN ('owner', 'admin')
   ORDER BY cm.role = 'owner' DESC, p.created_at
   LIMIT 1;

  -- Fallback to first profile if no admin found
  IF v_admin_id IS NULL THEN
    v_admin_id := v_profiles[1];
  END IF;

  ---------------------------------------------------------------------------
  -- 3. Insert contracts for all 50 employees
  ---------------------------------------------------------------------------
  FOR v_idx IN 0..49 LOOP
    -- Defaults
    v_category := 'Fast';
    v_pct      := 100.00;
    v_status   := 'signed';
    v_end_date := NULL;
    v_monthly  := NULL;

    -------------------------------------------------------------------------
    -- Employees 0-5: Kitchen (Kokk)
    -------------------------------------------------------------------------
    IF v_idx = 0 THEN
      v_position := 'Kjokkensjef';
      v_hourly   := 240.52;
      v_monthly  := 37040;
      v_start    := CURRENT_DATE - interval '2 years';
    ELSIF v_idx = 1 THEN
      v_position := 'Sous Chef';
      v_hourly   := 240.52;
      v_monthly  := 37040;
      v_start    := CURRENT_DATE - interval '2 years';
    ELSIF v_idx = 2 THEN
      v_position := 'Kokk';
      v_hourly   := 226.16;
      v_monthly  := 34829;
      v_start    := CURRENT_DATE - interval '2 years';
    ELSIF v_idx = 3 THEN
      v_position := 'Kokk';
      v_hourly   := 224.45;
      v_monthly  := 34565;
      v_start    := CURRENT_DATE - interval '1 year';
    ELSIF v_idx = 4 THEN
      v_position := 'Kokk';
      v_hourly   := 215.61;
      v_monthly  := 33204;
      v_start    := CURRENT_DATE - interval '6 months';
    ELSIF v_idx = 5 THEN
      v_position := 'Kokk';
      v_hourly   := 213.90;
      v_monthly  := 32940;
      v_start    := CURRENT_DATE - interval '6 months';

    -------------------------------------------------------------------------
    -- Employees 6-10: Restaurant (Servitor)
    -------------------------------------------------------------------------
    ELSIF v_idx = 6 THEN
      v_position := 'Hovmester';
      v_hourly   := 237.43;
      v_monthly  := 36564;
      v_start    := CURRENT_DATE - interval '2 years';
    ELSIF v_idx = 7 THEN
      v_position := 'Servitor';
      v_hourly   := 223.07;
      v_monthly  := 34353;
      v_start    := CURRENT_DATE - interval '2 years';
    ELSIF v_idx = 8 THEN
      v_position := 'Servitor';
      v_hourly   := 219.26;
      v_monthly  := 33766;
      v_start    := CURRENT_DATE - interval '1 year';
    ELSIF v_idx = 9 THEN
      v_position := 'Servitor';
      v_hourly   := 212.52;
      v_monthly  := 32728;
      v_start    := CURRENT_DATE - interval '6 months';
    ELSIF v_idx = 10 THEN
      v_position := 'Servitor';
      v_hourly   := 208.71;
      v_monthly  := 32141;
      v_start    := CURRENT_DATE - interval '6 months';

    -------------------------------------------------------------------------
    -- Employees 11-14: Bar (Bartender)
    -------------------------------------------------------------------------
    ELSIF v_idx = 11 THEN
      v_position := 'Barbartender (leder)';
      v_hourly   := 237.43;
      v_monthly  := 36564;
      v_start    := CURRENT_DATE - interval '2 years';
    ELSIF v_idx = 12 THEN
      v_position := 'Bartender';
      v_hourly   := 223.07;
      v_monthly  := 34353;
      v_start    := CURRENT_DATE - interval '2 years';
    ELSIF v_idx = 13 THEN
      v_position := 'Bartender';
      v_hourly   := 219.26;
      v_monthly  := 33766;
      v_start    := CURRENT_DATE - interval '1 year';
    ELSIF v_idx = 14 THEN
      v_position := 'Bartender';
      v_hourly   := 212.52;
      v_monthly  := 32728;
      v_start    := CURRENT_DATE - interval '6 months';

    -------------------------------------------------------------------------
    -- Employees 15-17: Catering
    -------------------------------------------------------------------------
    ELSIF v_idx = 15 THEN
      v_position := 'Cateringansvarlig';
      v_hourly   := 226.88;
      v_monthly  := 34939;
      v_start    := CURRENT_DATE - interval '2 years';
    ELSIF v_idx = 16 THEN
      v_position := 'Cateringmedarbeider';
      v_hourly   := 212.52;
      v_monthly  := 32728;
      v_start    := CURRENT_DATE - interval '1 year';
    ELSIF v_idx = 17 THEN
      v_position := 'Cateringmedarbeider';
      v_hourly   := 208.71;
      v_monthly  := 32141;
      v_start    := CURRENT_DATE - interval '6 months';

    -------------------------------------------------------------------------
    -- Employees 18-20: Renhold (Cleaning)
    -------------------------------------------------------------------------
    ELSIF v_idx = 18 THEN
      v_position := 'Renholder';
      v_hourly   := 212.52;
      v_monthly  := 32728;
      v_start    := CURRENT_DATE - interval '2 years';
    ELSIF v_idx = 19 THEN
      v_position := 'Renholder';
      v_hourly   := 208.71;
      v_monthly  := 32141;
      v_start    := CURRENT_DATE - interval '1 year';
    ELSIF v_idx = 20 THEN
      v_position := 'Renholder';
      v_hourly   := 208.71;
      v_monthly  := 32141;
      v_start    := CURRENT_DATE - interval '6 months';

    -------------------------------------------------------------------------
    -- Employees 21-22: Levering (Delivery)
    -------------------------------------------------------------------------
    ELSIF v_idx = 21 THEN
      v_position := 'Sjafor';
      v_hourly   := 212.52;
      v_monthly  := 32728;
      v_start    := CURRENT_DATE - interval '2 years';
    ELSIF v_idx = 22 THEN
      v_position := 'Sjafor';
      v_hourly   := 208.71;
      v_monthly  := 32141;
      v_start    := CURRENT_DATE - interval '1 year';

    -------------------------------------------------------------------------
    -- Employees 23-24: Event
    -------------------------------------------------------------------------
    ELSIF v_idx = 23 THEN
      v_position := 'Eventansvarlig';
      v_hourly   := 226.88;
      v_monthly  := 34939;
      v_start    := CURRENT_DATE - interval '2 years';
    ELSIF v_idx = 24 THEN
      v_position := 'Eventmedarbeider';
      v_hourly   := 208.71;
      v_monthly  := 32141;
      v_start    := CURRENT_DATE - interval '1 year';

    -------------------------------------------------------------------------
    -- Employees 25-34: Foreign workers (beginner rates, no fagbrev)
    -------------------------------------------------------------------------
    ELSIF v_idx IN (25, 26) THEN
      -- Kitchen foreign workers
      v_position := 'Kokk';
      v_hourly   := 213.90;
      v_monthly  := 32940;
      v_start    := CURRENT_DATE - interval '1 year';
    ELSIF v_idx IN (27, 28) THEN
      -- Restaurant foreign workers
      v_position := 'Servitor';
      v_hourly   := 208.71;
      v_monthly  := 32141;
      v_start    := CURRENT_DATE - interval '1 year';
    ELSIF v_idx IN (29, 30) THEN
      -- Bar foreign workers
      v_position := 'Bartender';
      v_hourly   := 208.71;
      v_monthly  := 32141;
      v_start    := CURRENT_DATE - interval '1 year';
    ELSIF v_idx = 31 THEN
      -- Catering foreign worker
      v_position := 'Cateringmedarbeider';
      v_hourly   := 208.71;
      v_monthly  := 32141;
      v_start    := CURRENT_DATE - interval '1 year';
    ELSIF v_idx = 32 THEN
      -- Cleaning foreign worker
      v_position := 'Renholder';
      v_hourly   := 208.71;
      v_monthly  := 32141;
      v_start    := CURRENT_DATE - interval '1 year';
    ELSIF v_idx = 33 THEN
      -- Delivery foreign worker
      v_position := 'Sjafor';
      v_hourly   := 208.71;
      v_monthly  := 32141;
      v_start    := CURRENT_DATE - interval '1 year';
    ELSIF v_idx = 34 THEN
      -- Event foreign worker
      v_position := 'Eventmedarbeider';
      v_hourly   := 208.71;
      v_monthly  := 32141;
      v_start    := CURRENT_DATE - interval '1 year';

    -------------------------------------------------------------------------
    -- Employees 35-39: Minors (16-17 years, part-time)
    -------------------------------------------------------------------------
    ELSIF v_idx IN (35, 36) THEN
      v_position := 'Hjelpeservitor';
      v_category := 'Deltid';
      v_pct      := 30.00;
      v_hourly   := 153.09;  -- 17 years
      v_monthly  := NULL;
      v_start    := CURRENT_DATE - interval '3 months';
    ELSIF v_idx IN (37, 38, 39) THEN
      v_position := 'Hjelpeservitor';
      v_category := 'Deltid';
      v_pct      := 30.00;
      v_hourly   := 143.06;  -- 16 years
      v_monthly  := NULL;
      v_start    := CURRENT_DATE - interval '3 months';

    -------------------------------------------------------------------------
    -- Employees 40-43: Pensioners (part-time)
    -------------------------------------------------------------------------
    ELSIF v_idx IN (40, 41, 42, 43) THEN
      v_position := 'Hjelpeservitor';
      v_category := 'Deltid';
      v_pct      := 40.00;
      v_hourly   := 208.71;
      v_monthly  := NULL;
      v_start    := CURRENT_DATE - interval '8 months';

    -------------------------------------------------------------------------
    -- Employees 44-49: Freelancers (on-call / tilkalling)
    -------------------------------------------------------------------------
    ELSIF v_idx IN (44, 45) THEN
      v_position := 'Servitor (tilkalling)';
      v_category := 'Tilkalling';
      v_pct      := NULL;
      v_hourly   := 208.71;
      v_monthly  := NULL;
      v_end_date := CURRENT_DATE + interval '6 months';
      v_start    := CURRENT_DATE - interval '4 months';
    ELSIF v_idx IN (46, 47) THEN
      v_position := 'Bartender (tilkalling)';
      v_category := 'Tilkalling';
      v_pct      := NULL;
      v_hourly   := 208.71;
      v_monthly  := NULL;
      v_end_date := CURRENT_DATE + interval '6 months';
      v_start    := CURRENT_DATE - interval '4 months';
    ELSIF v_idx = 48 THEN
      v_position := 'Eventmedarbeider (tilkalling)';
      v_category := 'Tilkalling';
      v_pct      := NULL;
      v_hourly   := 208.71;
      v_monthly  := NULL;
      v_status   := 'sent';  -- not yet signed
      v_end_date := CURRENT_DATE + interval '6 months';
      v_start    := CURRENT_DATE - interval '2 weeks';
    ELSIF v_idx = 49 THEN
      v_position := 'Eventmedarbeider (tilkalling)';
      v_category := 'Tilkalling';
      v_pct      := NULL;
      v_hourly   := 208.71;
      v_monthly  := NULL;
      v_status   := 'draft';  -- being prepared
      v_end_date := CURRENT_DATE + interval '6 months';
      v_start    := CURRENT_DATE;
    END IF;

    -- signed_at: start_date + 1 day for signed contracts, NULL otherwise
    IF v_status = 'signed' THEN
      v_signed := (v_start + interval '1 day')::timestamptz;
    ELSE
      v_signed := NULL;
    END IF;

    -------------------------------------------------------------------------
    -- Insert the contract (array is 1-indexed in PL/pgSQL)
    -------------------------------------------------------------------------
    INSERT INTO public.employment_contract (
      workspace_id,
      profile_id,
      status,
      position_title,
      employment_category,
      employment_percentage,
      hourly_rate,
      monthly_salary,
      start_date,
      end_date,
      signed_at,
      created_by,
      created_at,
      updated_at
    ) VALUES (
      p_workspace_id,
      v_profiles[v_idx + 1],  -- PL/pgSQL arrays are 1-indexed
      v_status,
      v_position,
      v_category,
      v_pct,
      v_hourly,
      v_monthly,
      v_start,
      v_end_date,
      v_signed,
      v_admin_id,
      now(),
      now()
    );

  END LOOP;
END;
$$;
