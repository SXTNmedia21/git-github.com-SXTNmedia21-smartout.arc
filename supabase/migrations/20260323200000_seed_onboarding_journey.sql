-- Seed the onboarding journey definition (J-ONBOARD-001).
-- The journey table requires workspace_id NOT NULL, so we create a reusable
-- function that seeds the journey + steps for a given workspace.
-- The function is idempotent: ON CONFLICT DO NOTHING on unique constraints.
-- At migration time, we seed all existing workspaces automatically.

CREATE OR REPLACE FUNCTION seed_onboarding_journey(p_workspace_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_journey_id uuid := gen_random_uuid();
  v_step1_id uuid := gen_random_uuid();
  v_step2_id uuid := gen_random_uuid();
  v_step3_id uuid := gen_random_uuid();
  v_step4_id uuid := gen_random_uuid();
BEGIN
  -- Journey: New Workspace Onboarding via Lise
  INSERT INTO journey (
    journey_id, workspace_id, code, title, slug, module, actor, platform, priority, status,
    trigger_description, preconditions, test_assertion,
    doc_title, outcomes_success, outcomes_error
  ) VALUES (
    v_journey_id,
    p_workspace_id,
    'J-ONBOARD-001',
    'New Workspace Onboarding via Lise',
    'new-workspace-onboarding',
    'onboarding',
    'admin',
    'desktop',
    'P0',
    'active',
    'Admin starts onboarding wizard for first time',
    ARRAY['User has created a Smartout account', 'User has created a company'],
    'Workspace has company info, at least one season, and at least one department',
    'Ny arbeidsplass — onboarding med Lise',
    'Workspace er ferdig satt opp med bedriftsinfo, sesong og avdelinger',
    'Bruker kan alltid prøve igjen — data som er samlet blir lagret'
  )
  ON CONFLICT (workspace_id, code) DO NOTHING;

  -- If the journey already existed, fetch its ID for the steps
  SELECT journey_id INTO v_journey_id
  FROM journey
  WHERE workspace_id = p_workspace_id AND code = 'J-ONBOARD-001';

  -- Step 1: Bli kjent og bedriftsinfo
  INSERT INTO journey_step (
    journey_step_id, journey_id, workspace_id, step_order, title, action, expects,
    screen, component, data_writes, data_reads,
    min_duration_seconds, max_duration_seconds, required_confirmation
  ) VALUES (
    v_step1_id, v_journey_id, p_workspace_id, 1,
    'Bli kjent og bedriftsinfo',
    'Presentér deg og oppgi bedriftens navn, adresse, telefon og org.nummer',
    'Lise fyller inn bedriftsinfo i UI via updateBusiness-verktøy',
    '/onboarding/business', 'BusinessSection',
    ARRAY['company.name', 'company.address', 'company.phone'],
    ARRAY['company.org_number'],
    30, 300, false
  )
  ON CONFLICT (journey_id, step_order) DO NOTHING;

  -- Step 2: Sesong
  INSERT INTO journey_step (
    journey_step_id, journey_id, workspace_id, step_order, title, action, expects,
    screen, component, data_writes, data_reads,
    min_duration_seconds, max_duration_seconds, required_confirmation
  ) VALUES (
    v_step2_id, v_journey_id, p_workspace_id, 2,
    'Sesong',
    'Fortell om årets sesonger, datoer og forventet omsetning',
    'Lise oppretter sesong med navn, start/sluttdato via updateSeason-verktøy',
    '/onboarding/season', 'SeasonSection',
    ARRAY['season.name', 'season.start_date', 'season.end_date'],
    '{}',
    20, 300, false
  )
  ON CONFLICT (journey_id, step_order) DO NOTHING;

  -- Step 3: Avdelinger og team
  INSERT INTO journey_step (
    journey_step_id, journey_id, workspace_id, step_order, title, action, expects,
    screen, component, data_writes, data_reads,
    min_duration_seconds, max_duration_seconds, required_confirmation
  ) VALUES (
    v_step3_id, v_journey_id, p_workspace_id, 3,
    'Avdelinger og team',
    'Beskriv avdelingene og hvem som leder dem',
    'Lise legger til avdelinger via addDepartments-verktøy',
    '/onboarding/departments', 'DepartmentsSection',
    ARRAY['departments[]'],
    '{}',
    20, 300, false
  )
  ON CONFLICT (journey_id, step_order) DO NOTHING;

  -- Step 4: Bekreft og avslutt
  INSERT INTO journey_step (
    journey_step_id, journey_id, workspace_id, step_order, title, action, expects,
    screen, component, data_writes, data_reads,
    min_duration_seconds, max_duration_seconds, required_confirmation
  ) VALUES (
    v_step4_id, v_journey_id, p_workspace_id, 4,
    'Bekreft og avslutt',
    'Bekreft at all informasjon stemmer',
    'Oppsummering vises og brukeren overføres til dashboard',
    '/onboarding/done', 'DoneSection',
    '{}', '{}',
    10, 120, true
  )
  ON CONFLICT (journey_id, step_order) DO NOTHING;

  RETURN v_journey_id;
END;
$$;

COMMENT ON FUNCTION seed_onboarding_journey(uuid) IS
  'Seeds the J-ONBOARD-001 journey and its 4 steps for a workspace. Idempotent — safe to call multiple times.';

-- Seed for all existing workspaces
DO $$
DECLARE
  ws record;
  result uuid;
BEGIN
  FOR ws IN SELECT workspace_id FROM workspace LOOP
    result := seed_onboarding_journey(ws.workspace_id);
    RAISE NOTICE 'Seeded onboarding journey for workspace %: journey_id=%', ws.workspace_id, result;
  END LOOP;
END $$;
