-- Template: Restaurant Protocol Assignments
-- Industry:   restaurant (NACE 56.101)
-- Creates:    ~350 protocol_assignment rows (50 employees x ~7 avg protocols)
-- Status:     ~60% completed, ~30% pending, ~10% expired
-- Depends:    governance.sql (protocols), employees.sql (profiles)
-- Usage:      SELECT template_restaurant_assignments(p_workspace_id);

CREATE OR REPLACE FUNCTION template_restaurant_assignments(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profiles uuid[];
  v_protocol_ids uuid[];
  v_policy_names text[] := ARRAY[
    'Temperaturkontroll',
    'Allergenhandtering',
    'Handhygiene',
    'Brannvern og evakuering',
    'Arbeidsmiljo og HMS',
    'Apningsrutiner',
    'Stengerutiner',
    'Varemottak og lagring',
    'Kassaoppgjor og verdihandtering',
    'Skjenkekontroll og aldersgrense'
  ];
  v_profile_id uuid;
  v_protocol_id uuid;
  v_status protocol_assignment_status;
  v_completed_at timestamptz;
  i int;
  p int;
BEGIN
  -- 1. Load all 50 profiles ordered deterministically
  SELECT array_agg(pr.profile_id ORDER BY pr.created_at, pr.profile_id)
    INTO v_profiles
    FROM public.profile pr
   WHERE pr.workspace_id = p_workspace_id;

  IF array_length(v_profiles, 1) IS NULL OR array_length(v_profiles, 1) < 50 THEN
    RAISE EXCEPTION 'Expected 50 profiles in workspace %, found %',
      p_workspace_id, COALESCE(array_length(v_profiles, 1), 0);
  END IF;

  -- 2. Look up all 10 protocol IDs by joining protocol -> policy (by policy name)
  FOR p IN 1..10 LOOP
    SELECT pr.protocol_id
      INTO v_protocol_id
      FROM public.protocol pr
      JOIN public.policy po ON po.policy_id = pr.policy_id
     WHERE po.workspace_id = p_workspace_id
       AND po.name = v_policy_names[p]
     LIMIT 1;

    IF v_protocol_id IS NULL THEN
      RAISE EXCEPTION 'Protocol not found for policy "%" in workspace %',
        v_policy_names[p], p_workspace_id;
    END IF;

    v_protocol_ids := array_append(v_protocol_ids, v_protocol_id);
  END LOOP;

  -- 3. Assign protocols to employees based on rules
  FOR p IN 1..10 LOOP
    FOR i IN 0..49 LOOP
      -- Determine if this employee gets this protocol
      IF NOT (
        -- Workspace-wide: protocols 1-5 (everyone)
        p <= 5
        -- Åpningsrutiner (6): employees 0-14, 25-30
        OR (p = 6 AND (i BETWEEN 0 AND 14 OR i BETWEEN 25 AND 30))
        -- Stengerutiner (7): employees 0-14, 25-30
        OR (p = 7 AND (i BETWEEN 0 AND 14 OR i BETWEEN 25 AND 30))
        -- Varemottak og lagring (8): employees 0-5, 15-17, 25-26, 31
        OR (p = 8 AND (i BETWEEN 0 AND 5 OR i BETWEEN 15 AND 17 OR i BETWEEN 25 AND 26 OR i = 31))
        -- Kassaoppgjør og verdihåndtering (9): employees 6-14, 27-30, 40-43
        OR (p = 9 AND (i BETWEEN 6 AND 14 OR i BETWEEN 27 AND 30 OR i BETWEEN 40 AND 43))
        -- Skjenkekontroll og aldersgrense (10): employees 11-14, 29-30 (bar staff, 18+)
        OR (p = 10 AND (i BETWEEN 11 AND 14 OR i BETWEEN 29 AND 30))
      ) THEN
        CONTINUE;
      END IF;

      v_profile_id := v_profiles[i + 1]; -- arrays are 1-indexed in PL/pgSQL

      -- Determine status based on employee category
      IF i < 35 THEN
        -- Adult employees: ~80% completed (completed if (i + p) % 5 <> 0)
        IF (i + p) % 5 <> 0 THEN
          v_status := 'completed';
          v_completed_at := now() - ((50 - i) || ' days')::interval;
        ELSE
          v_status := 'pending';
          v_completed_at := NULL;
        END IF;

      ELSIF i BETWEEN 35 AND 39 THEN
        -- Minors (trainees): always pending
        v_status := 'pending';
        v_completed_at := NULL;

      ELSIF i BETWEEN 40 AND 43 THEN
        -- Pensioners: completed if (i + p) % 3 <> 0
        IF (i + p) % 3 <> 0 THEN
          v_status := 'completed';
          v_completed_at := now() - ((50 - i) || ' days')::interval;
        ELSE
          v_status := 'pending';
          v_completed_at := NULL;
        END IF;

      ELSE
        -- Freelancers (44-49): expired/completed/pending
        IF (i + p) % 7 = 0 THEN
          v_status := 'expired';
          v_completed_at := NULL;
        ELSIF (i + p) % 3 <> 0 THEN
          v_status := 'completed';
          v_completed_at := now() - ((50 - i) || ' days')::interval;
        ELSE
          v_status := 'pending';
          v_completed_at := NULL;
        END IF;
      END IF;

      -- Insert assignment (idempotent: skip if already exists)
      INSERT INTO public.protocol_assignment (
        protocol_id,
        profile_id,
        status,
        assigned_at,
        completed_at,
        created_at,
        updated_at
      )
      SELECT
        v_protocol_ids[p],
        v_profile_id,
        v_status,
        now(),
        v_completed_at,
        now(),
        now()
      WHERE NOT EXISTS (
        SELECT 1
          FROM public.protocol_assignment pa
         WHERE pa.protocol_id = v_protocol_ids[p]
           AND pa.profile_id = v_profile_id
      );

    END LOOP;
  END LOOP;
END;
$$;
