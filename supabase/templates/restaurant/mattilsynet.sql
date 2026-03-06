-- Template: Restaurant Mattilsynet Food Safety Routines
-- Industry:   restaurant (NACE 56.101)
-- Creates:    4 HACCP policies, 4 protocols, 20 procedures with steps,
--             12 routines, 8 control lists, 4 knowledge tests
-- References: Mattilsynet internkontroll, Forskrift om naeringsmiddelhygiene,
--             EU forordning 852/2004, EU forordning 1169/2011 (allergener),
--             IK-mat forskrift (FOR-1994-12-15-1187), Smilefjesordningen
-- Depends:    departments.sql (for department/team lookups)
-- Usage:      SELECT template_restaurant_mattilsynet(p_workspace_id);

CREATE OR REPLACE FUNCTION template_restaurant_mattilsynet(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Admin profile
  v_admin_id uuid;
  v_season_id uuid;

  -- Department IDs
  v_dept_kitchen_id uuid;
  v_dept_restaurant_id uuid;
  v_dept_bar_id uuid;

  -- Team IDs
  v_team_kitchen_id uuid;
  v_team_sal_id uuid;
  v_team_bar_id uuid;

  -- Policy IDs (4 HACCP policies)
  v_pol_temperatur_id uuid;
  v_pol_hygiene_id uuid;
  v_pol_allergen_id uuid;
  v_pol_sporbarhet_id uuid;

  -- Protocol IDs (1:1 with policies)
  v_prot_temperatur_id uuid;
  v_prot_hygiene_id uuid;
  v_prot_allergen_id uuid;
  v_prot_sporbarhet_id uuid;

  -- Procedure IDs (20 total)
  -- Policy 1: Temperaturovervaking og kaldkjede
  v_proc_daglig_templogg_id uuid;
  v_proc_varemottak_temp_id uuid;
  v_proc_varmholding_id uuid;
  v_proc_nedkjoling_id uuid;
  v_proc_kjernetemp_id uuid;

  -- Policy 2: Hygiene og renhold
  v_proc_handhygiene_id uuid;
  v_proc_daglig_renhold_id uuid;
  v_proc_ukentlig_dyp_id uuid;
  v_proc_sanitaer_id uuid;
  v_proc_skadedyr_id uuid;

  -- Policy 3: Allergenhandtering og merking
  v_proc_allergenreg_id uuid;
  v_proc_allergenserv_id uuid;
  v_proc_kryssforurensning_id uuid;

  -- Policy 4: Sporbarhet og avvikshandtering
  v_proc_varemottak_spor_id uuid;
  v_proc_avvik_id uuid;
  v_proc_tilbaketrekking_id uuid;
  v_proc_internrevisjon_id uuid;
  v_proc_datomerking_id uuid;
  v_proc_proevetaking_id uuid;
  v_proc_opplaering_id uuid;

  -- Control list IDs (8)
  v_cl_templogg_id uuid;
  v_cl_varemottak_id uuid;
  v_cl_daglig_renhold_id uuid;
  v_cl_ukentlig_dyp_id uuid;
  v_cl_allergen_id uuid;
  v_cl_varmholding_id uuid;
  v_cl_nedkjoling_id uuid;
  v_cl_sanitaer_id uuid;

BEGIN
  ---------------------------------------------------------------------------
  -- 0. Look up admin profile and active season
  ---------------------------------------------------------------------------
  SELECT profile_id INTO v_admin_id
    FROM public.profile
   WHERE workspace_id = p_workspace_id
     AND role = 'admin'
   ORDER BY created_at ASC
   LIMIT 1;

  IF v_admin_id IS NULL THEN
    SELECT profile_id INTO v_admin_id
      FROM public.profile
     WHERE workspace_id = p_workspace_id
       AND role = 'owner'
     ORDER BY created_at ASC
     LIMIT 1;
  END IF;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin or owner profile found for workspace %', p_workspace_id;
  END IF;

  SELECT season_id INTO v_season_id
    FROM public.season
   WHERE workspace_id = p_workspace_id
     AND status = 'active'
   ORDER BY created_at DESC
   LIMIT 1;

  -- If no active season, try default
  IF v_season_id IS NULL THEN
    SELECT season_id INTO v_season_id
      FROM public.season
     WHERE workspace_id = p_workspace_id
       AND is_default = true
     LIMIT 1;
  END IF;

  ---------------------------------------------------------------------------
  -- 1. Look up or create departments
  ---------------------------------------------------------------------------
  SELECT department_id INTO v_dept_kitchen_id
    FROM public.department
   WHERE workspace_id = p_workspace_id AND slug = 'kjokken'
   LIMIT 1;

  IF v_dept_kitchen_id IS NULL THEN
    v_dept_kitchen_id := gen_random_uuid();
    INSERT INTO public.department (department_id, workspace_id, name, slug, description, sort_order)
    VALUES (v_dept_kitchen_id, p_workspace_id, 'Kjokken', 'kjokken', 'Kjokkenavdelingen', 1);
  END IF;

  SELECT department_id INTO v_dept_restaurant_id
    FROM public.department
   WHERE workspace_id = p_workspace_id AND slug = 'restaurant'
   LIMIT 1;

  IF v_dept_restaurant_id IS NULL THEN
    v_dept_restaurant_id := gen_random_uuid();
    INSERT INTO public.department (department_id, workspace_id, name, slug, description, sort_order)
    VALUES (v_dept_restaurant_id, p_workspace_id, 'Restaurant', 'restaurant', 'Sal og servering', 2);
  END IF;

  SELECT department_id INTO v_dept_bar_id
    FROM public.department
   WHERE workspace_id = p_workspace_id AND slug = 'bar'
   LIMIT 1;

  IF v_dept_bar_id IS NULL THEN
    v_dept_bar_id := gen_random_uuid();
    INSERT INTO public.department (department_id, workspace_id, name, slug, description, sort_order)
    VALUES (v_dept_bar_id, p_workspace_id, 'Bar', 'bar', 'Baravdelingen', 3);
  END IF;

  ---------------------------------------------------------------------------
  -- 2. Look up or create teams
  ---------------------------------------------------------------------------
  SELECT team_id INTO v_team_kitchen_id
    FROM public.team
   WHERE workspace_id = p_workspace_id AND slug = 'kjokkenteam'
   LIMIT 1;

  IF v_team_kitchen_id IS NULL THEN
    v_team_kitchen_id := gen_random_uuid();
    INSERT INTO public.team (team_id, workspace_id, department_id, name, slug, team_type)
    VALUES (v_team_kitchen_id, p_workspace_id, v_dept_kitchen_id, 'Kjokkenteam', 'kjokkenteam', 'operational');
  END IF;

  SELECT team_id INTO v_team_sal_id
    FROM public.team
   WHERE workspace_id = p_workspace_id AND slug = 'salteam'
   LIMIT 1;

  IF v_team_sal_id IS NULL THEN
    v_team_sal_id := gen_random_uuid();
    INSERT INTO public.team (team_id, workspace_id, department_id, name, slug, team_type)
    VALUES (v_team_sal_id, p_workspace_id, v_dept_restaurant_id, 'Salteam', 'salteam', 'operational');
  END IF;

  SELECT team_id INTO v_team_bar_id
    FROM public.team
   WHERE workspace_id = p_workspace_id AND slug = 'barteam'
   LIMIT 1;

  IF v_team_bar_id IS NULL THEN
    v_team_bar_id := gen_random_uuid();
    INSERT INTO public.team (team_id, workspace_id, department_id, name, slug, team_type)
    VALUES (v_team_bar_id, p_workspace_id, v_dept_bar_id, 'Barteam', 'barteam', 'operational');
  END IF;

  ---------------------------------------------------------------------------
  -- 3. Generate IDs for all governance objects
  ---------------------------------------------------------------------------

  -- Policies
  v_pol_temperatur_id := gen_random_uuid();
  v_pol_hygiene_id    := gen_random_uuid();
  v_pol_allergen_id   := gen_random_uuid();
  v_pol_sporbarhet_id := gen_random_uuid();

  -- Protocols
  v_prot_temperatur_id := gen_random_uuid();
  v_prot_hygiene_id    := gen_random_uuid();
  v_prot_allergen_id   := gen_random_uuid();
  v_prot_sporbarhet_id := gen_random_uuid();

  -- Procedures (20)
  v_proc_daglig_templogg_id   := gen_random_uuid();
  v_proc_varemottak_temp_id   := gen_random_uuid();
  v_proc_varmholding_id       := gen_random_uuid();
  v_proc_nedkjoling_id        := gen_random_uuid();
  v_proc_kjernetemp_id        := gen_random_uuid();
  v_proc_handhygiene_id       := gen_random_uuid();
  v_proc_daglig_renhold_id    := gen_random_uuid();
  v_proc_ukentlig_dyp_id      := gen_random_uuid();
  v_proc_sanitaer_id          := gen_random_uuid();
  v_proc_skadedyr_id          := gen_random_uuid();
  v_proc_allergenreg_id       := gen_random_uuid();
  v_proc_allergenserv_id      := gen_random_uuid();
  v_proc_kryssforurensning_id := gen_random_uuid();
  v_proc_varemottak_spor_id   := gen_random_uuid();
  v_proc_avvik_id             := gen_random_uuid();
  v_proc_tilbaketrekking_id   := gen_random_uuid();
  v_proc_internrevisjon_id    := gen_random_uuid();
  v_proc_datomerking_id       := gen_random_uuid();
  v_proc_proevetaking_id      := gen_random_uuid();
  v_proc_opplaering_id        := gen_random_uuid();

  -- Control lists (8)
  v_cl_templogg_id      := gen_random_uuid();
  v_cl_varemottak_id    := gen_random_uuid();
  v_cl_daglig_renhold_id := gen_random_uuid();
  v_cl_ukentlig_dyp_id  := gen_random_uuid();
  v_cl_allergen_id      := gen_random_uuid();
  v_cl_varmholding_id   := gen_random_uuid();
  v_cl_nedkjoling_id    := gen_random_uuid();
  v_cl_sanitaer_id      := gen_random_uuid();

  ---------------------------------------------------------------------------
  -- 4. POLICIES (4 HACCP)
  ---------------------------------------------------------------------------

  -- Policy 1: Temperaturovervaking og kaldkjede
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_temperatur_id, p_workspace_id, v_season_id, 'haccp', 'workspace',
    'Temperaturovervaking og kaldkjede',
    'HACCP-policy for temperaturovervaking av alle temperaturfolgomme naeringsmidler.',
    'Alle temperaturfolgomme naeringsmidler skal oppbevares ved forskriftsmessig temperatur. Kjolevarer 0-4 grader C, frysevarer -18 grader C eller kaldere. Varmholding over 60 grader C. Nedkjoling fra 60 grader C til 10 grader C innen 2 timer. Kjernetemperatur ved tilberedning minst 70 grader C i flere minutter.',
    'enforced', v_admin_id)
  ON CONFLICT DO NOTHING;

  -- Policy 2: Hygiene og renhold
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_hygiene_id, p_workspace_id, v_season_id, 'haccp', 'workspace',
    'Hygiene og renhold',
    'HACCP-policy for hygiene, renhold og personlig hygiene i alle lokaler.',
    'Alle lokaler, utstyr og overflater som kommer i kontakt med naeringsmidler skal holdes rene og i god stand. Renholdsplan skal foreligge og folges. Personlig hygiene skal sikre at mat ikke forurenses.',
    'enforced', v_admin_id)
  ON CONFLICT DO NOTHING;

  -- Policy 3: Allergenhandtering og merking
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_allergen_id, p_workspace_id, v_season_id, 'haccp', 'workspace',
    'Allergenhandtering og merking',
    'HACCP-policy for allergenmerking, informasjon og forebygging av kryssforurensning.',
    'Alle retter skal merkes med de 14 deklarasjonspliktige allergenene. Personalet skal kunne informere gjester om allergeninnhold. Kryssforurensning mellom allergener skal forebygges. Allergeninformasjon skal vaere skriftlig tilgjengelig.',
    'enforced', v_admin_id)
  ON CONFLICT DO NOTHING;

  -- Policy 4: Sporbarhet og avvikshandtering
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_sporbarhet_id, p_workspace_id, v_season_id, 'haccp', 'workspace',
    'Sporbarhet og avvikshandtering',
    'HACCP-policy for sporing av naeringsmidler, avvikshandtering og internkontroll.',
    'Virksomheten skal ha system for sporing av alle inngaende og utgaende naeringsmidler. Avvik skal dokumenteres skriftlig, korrigerende tiltak iverksettes umiddelbart, og forebyggende tiltak skal hindre gjentagelse.',
    'enforced', v_admin_id)
  ON CONFLICT DO NOTHING;

  ---------------------------------------------------------------------------
  -- 5. PROTOCOLS (4, one per policy)
  ---------------------------------------------------------------------------

  INSERT INTO public.protocol (protocol_id, policy_id, workspace_id, name, description, status, owner_profile_id, created_by)
  VALUES
    (v_prot_temperatur_id, v_pol_temperatur_id, p_workspace_id,
      'Temperaturovervaking-protokoll',
      'Protokoll for temperaturovervaking og kaldkjede iht. Mattilsynet.',
      'active', v_admin_id, v_admin_id),
    (v_prot_hygiene_id, v_pol_hygiene_id, p_workspace_id,
      'Hygiene og renhold-protokoll',
      'Protokoll for hygiene, renhold og personlig hygiene iht. Smilefjesordningen.',
      'active', v_admin_id, v_admin_id),
    (v_prot_allergen_id, v_pol_allergen_id, p_workspace_id,
      'Allergenhandtering-protokoll',
      'Protokoll for allergenmerking og kryssforurensning iht. EU 1169/2011.',
      'active', v_admin_id, v_admin_id),
    (v_prot_sporbarhet_id, v_pol_sporbarhet_id, p_workspace_id,
      'Sporbarhet og avvik-protokoll',
      'Protokoll for sporbarhet, avvikshandtering og internkontroll iht. IK-mat.',
      'active', v_admin_id, v_admin_id);

  ---------------------------------------------------------------------------
  -- 6. PROCEDURES (20) with steps
  ---------------------------------------------------------------------------

  -- =========================================================================
  -- Policy 1: Temperaturovervaking og kaldkjede (5 procedures)
  -- =========================================================================

  -- 6.1 Daglig temperaturlogg kjoleenheter
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_daglig_templogg_id, v_prot_temperatur_id,
    'Daglig temperaturlogg kjoleenheter',
    'Kontroller alle kjole- og fryseenheter to ganger daglig (08:00 og 15:00).',
    'safety', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_daglig_templogg_id, 'Apne temperaturlogg',          'Apne digital temperaturlogg i systemet. Velg riktig dato og tidspunkt.',                                              1, true, 1),
    (v_proc_daglig_templogg_id, 'Les av temperatur',             'Les temperatur fra display eller termometer pa hver enhet.',                                                           2, true, 3),
    (v_proc_daglig_templogg_id, 'Registrer i system',            'For inn temperatur for hvert kjoleskap og fryser i loggen.',                                                          3, true, 2),
    (v_proc_daglig_templogg_id, 'Sjekk mot grenseverdier',       'Kontroller at kjoleskap holder 0-4 grader C og frysere -18 grader C eller kaldere.',                                  4, true, 1),
    (v_proc_daglig_templogg_id, 'Korrigerende tiltak ved avvik',  'Ved temperatur utenfor grenseverdi: flytt varer til annen enhet, meld avvik, vurder kassering.',                      5, true, 5),
    (v_proc_daglig_templogg_id, 'Signer logg',                   'Signer loggen med navn og tidspunkt.',                                                                                6, true, 1);

  -- 6.2 Temperaturkontroll ved varemottak
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_varemottak_temp_id, v_prot_temperatur_id,
    'Temperaturkontroll ved varemottak',
    'Mal kjernetemperatur pa alle temperaturfolgomme leveranser ved mottak.',
    'safety', 2);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_varemottak_temp_id, 'Sjekk folgeseddel',             'Kontroller at folgeseddel stemmer med bestilling og leverandor.',                                                      1, true, 2),
    (v_proc_varemottak_temp_id, 'Mal kjernetemperatur',           'Bruk probetermometer til a male kjernetemperatur pa representative varer.',                                            2, true, 3),
    (v_proc_varemottak_temp_id, 'Sammenlign med grenseverdier',   'Ferskt kjott under 4 grader C, frysevarer under -18 grader C, meieriprodukter under 4 grader C.',                     3, true, 1),
    (v_proc_varemottak_temp_id, 'Avvis ikke-konforme varer',      'Varer utenfor temperaturkrav avvises. Dokumenter avvisning og kontakt leverandor.',                                   4, true, 3),
    (v_proc_varemottak_temp_id, 'Registrer i logg',               'For temperatur, leverandor, batchnummer og resultat inn i mottaksloggen.',                                            5, true, 2);

  -- 6.3 Varmholdingskontroll
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_varmholding_id, v_prot_temperatur_id,
    'Varmholdingskontroll',
    'Overvak temperatur pa varmholdt mat. Minimum 60 grader C.',
    'safety', 3);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_varmholding_id, 'Sjekk at mat holder 60 grader C+',  'Kontroller at all varmholdt mat er over 60 grader C.',                                                                 1, true, 1),
    (v_proc_varmholding_id, 'Mal med probetermometer',            'Bruk probetermometer for noyaktig maling i midten av retten.',                                                         2, true, 2),
    (v_proc_varmholding_id, 'Registrer temperatur hver 30 min',   'For temperatur inn i logg hvert 30. minutt under varmholding.',                                                        3, true, 1),
    (v_proc_varmholding_id, 'Kasser ved for lav temperatur',      'Mat som har vaert under 60 grader C i mer enn 2 timer skal kasseres.',                                                 4, true, 2),
    (v_proc_varmholding_id, 'Rengjor utstyr etter service',       'Rengjor varmholdingsutstyr etter endt service.',                                                                       5, true, 5);

  -- 6.4 Nedkjolingskontroll
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_nedkjoling_id, v_prot_temperatur_id,
    'Nedkjolingskontroll',
    'Overvak rask nedkjoling fra 60 grader C til 10 grader C innen 2 timer.',
    'safety', 4);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_nedkjoling_id, 'Start timer ved koking ferdig',       'Noter tidspunkt nar tilberedning avsluttes.',                                                                          1, true, 1),
    (v_proc_nedkjoling_id, 'Porsjoner i mindre beholdere',        'Del opp i mindre porsjoner for raskere nedkjoling.',                                                                   2, true, 5),
    (v_proc_nedkjoling_id, 'Bruk blastchiller eller isbad',       'Plasser i blastchiller eller isbad for rask nedkjoling.',                                                              3, true, 2),
    (v_proc_nedkjoling_id, 'Overvak: 10 grader C innen 2 timer',  'Mal temperatur underveis. Mat ma na 10 grader C innen 2 timer.',                                                      4, true, 5),
    (v_proc_nedkjoling_id, 'Registrer start- og slutttemp',       'For inn starttemperatur, slutttemperatur, starttid og sluttid i loggen.',                                              5, true, 2),
    (v_proc_nedkjoling_id, 'Merk med dato og klokkeslett',        'Merk beholder med innhold, dato og klokkeslett for nedkjoling.',                                                       6, true, 1);

  -- 6.5 Kjernetemperatur ved tilberedning
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_kjernetemp_id, v_prot_temperatur_id,
    'Kjernetemperatur ved tilberedning',
    'Verifiser kjernetemperatur pa CCP-produkter (fjorkre, kvernet kjott, fisk).',
    'safety', 5);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_kjernetemp_id, 'Identifiser CCP-produkter',           'Fjorkre, kvernet kjott, fisk og andre hoyrisikovarer krever kjernetemperaturmaling.',                                  1, true, 1),
    (v_proc_kjernetemp_id, 'Sett inn probe i tykkeste del',       'Sett probetermometer inn i tykkeste del av produktet, unnga ben.',                                                     2, true, 1),
    (v_proc_kjernetemp_id, 'Verifiser temperatur',                'Kontroller at kjernetemperatur er minst 70 grader C i 2 minutter. Fjorkre: 75 grader C.',                              3, true, 2),
    (v_proc_kjernetemp_id, 'Registrer temperatur',                'For inn malt kjernetemperatur, produkt og tidspunkt i loggen.',                                                         4, true, 1),
    (v_proc_kjernetemp_id, 'Tillat hviletid for servering',        'La produktet hvile kort for servering for jevn varmefordeling.',                                                       5, true, 2);

  -- =========================================================================
  -- Policy 2: Hygiene og renhold (5 procedures)
  -- =========================================================================

  -- 6.6 Handhygiene og personlig hygiene
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_handhygiene_id, v_prot_hygiene_id,
    'Handhygiene og personlig hygiene',
    'Detaljert prosedyre for handvask og personlig hygiene. Utfores for mathhandtering, etter toalett, etter ratt kjott, etter nys/hoste, etter avfall, mellom oppgaver.',
    'safety', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_handhygiene_id, 'Vat hendene med varmt vann',        'Bruk rennende varmt vann til a gjore hendene vate.',                                                                    1, true, 1),
    (v_proc_handhygiene_id, 'Pafor antibakteriell sape',          'Bruk antibakteriell sape fra dispenser.',                                                                               2, true, 1),
    (v_proc_handhygiene_id, 'Skrubb i 20 sekunder',              'Skrubb mellom fingre, under negler og pa handledd i minst 20 sekunder.',                                               3, true, 1),
    (v_proc_handhygiene_id, 'Skyll grundig',                      'Skyll hendene grundig under rennende vann.',                                                                            4, true, 1),
    (v_proc_handhygiene_id, 'Tork med papirhandkle',              'Tork hendene med engangs papirhandkle.',                                                                                5, true, 1),
    (v_proc_handhygiene_id, 'Bruk handkle til a sla av kran',     'Bruk papirhandkle til a skru av kranen for a unnga rekontaminering.',                                                  6, true, 1);

  -- 6.7 Daglig renhold kjokken
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_daglig_renhold_id, v_prot_hygiene_id,
    'Daglig renhold kjokken',
    'Prosedyre for daglig renhold av kjokkenavdelingen etter service.',
    'safety', 2);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_daglig_renhold_id, 'Rydd alle overflater',             'Fjern all mat, utstyr og redskaper fra arbeidsflater.',                                                                1, true, 5),
    (v_proc_daglig_renhold_id, 'Vask med naeringsmiddeltrygt middel', 'Tork alle flater med godkjent naeringsmiddeltrygt rengjoringsmiddel.',                                             2, true, 10),
    (v_proc_daglig_renhold_id, 'Rengjor skjaerebrett',             'Vask skjaerebrett grundig. Bruk separate brett for ratt/kokt.',                                                       3, true, 5),
    (v_proc_daglig_renhold_id, 'Rengjor utstyr etter bruk',       'Vask alt utstyr (kniver, gryter, panner) etter hver bruk.',                                                           4, true, 10),
    (v_proc_daglig_renhold_id, 'Vask gulv',                        'Fei og mopp kjokkengulvet med godkjent rengjoringsmiddel.',                                                           5, true, 10),
    (v_proc_daglig_renhold_id, 'Tom soppelbotter',                 'Tom alle soppelbotter og kildesorter avfall.',                                                                         6, true, 5),
    (v_proc_daglig_renhold_id, 'Sjekk handvaskstasjoner',          'Kontroller at alle handvaskstasjoner har sape og papir.',                                                              7, true, 2);

  -- 6.8 Ukentlig dyprenhold
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_ukentlig_dyp_id, v_prot_hygiene_id,
    'Ukentlig dyprenhold',
    'Prosedyre for ukentlig dyprenhold av kjokken og utstyr.',
    'safety', 3);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_ukentlig_dyp_id, 'Flytt utstyr, rengjor bak/under',   'Flytt alt utstyr og rengjor bak og under.',                                                                           1, true, 20),
    (v_proc_ukentlig_dyp_id, 'Avfett ventilasjonshette og filtre', 'Rengjor og avfett ventilasjonshette og alle filtre.',                                                                 2, true, 15),
    (v_proc_ukentlig_dyp_id, 'Dyprengjor ovner, frityrkokere',    'Rengjor ovner, frityrkokere og griller innvendig.',                                                                   3, true, 20),
    (v_proc_ukentlig_dyp_id, 'Rengjor kjoleskap innvendig',        'Fjern alle varer, vask hyller og vegger innvendig. Sett varer tilbake.',                                              4, true, 20),
    (v_proc_ukentlig_dyp_id, 'Rengjor avlop',                      'Rens alle avlop og siler i kjokkenet.',                                                                               5, true, 10),
    (v_proc_ukentlig_dyp_id, 'Sjekk skadedyrfeller',               'Kontroller alle skadedyrfeller og baitstasjoner.',                                                                    6, true, 5),
    (v_proc_ukentlig_dyp_id, 'Dokumenter gjennomforing',           'For inn i renholdsloggen at ukentlig dyprenhold er utfort.',                                                           7, true, 2);

  -- 6.9 Renhold sanitaerrom og garderobe
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_sanitaer_id, v_prot_hygiene_id,
    'Renhold sanitaerrom og garderobe',
    'Prosedyre for renhold av ansatttoaletter, garderobe og fellesareal.',
    'safety', 4);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_sanitaer_id, 'Rengjor ansatttoaletter',               'Vask ansatttoaletter minimum to ganger daglig.',                                                                        1, true, 10),
    (v_proc_sanitaer_id, 'Fyll pa sape og papir',                 'Kontroller og fyll pa sape, papirhandklaer og toalettpapir.',                                                           2, true, 3),
    (v_proc_sanitaer_id, 'Sjekk handvaskstasjoner',               'Kontroller at handvaskstasjoner fungerer og er fylt opp.',                                                              3, true, 2),
    (v_proc_sanitaer_id, 'Rengjor garderobe',                     'Rydd og rengjor garderobe. Sjekk at arbeidsklarer er separert fra privatklarer.',                                       4, true, 5),
    (v_proc_sanitaer_id, 'Kontroller adskillelse fra matarea',    'Verifiser at det ikke er direkte adgang fra toaletter til mathandteringsomrader.',                                      5, true, 2);

  -- 6.10 Skadedyrkontroll
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_skadedyr_id, v_prot_hygiene_id,
    'Skadedyrkontroll',
    'Prosedyre for forebygging og kontroll av skadedyr.',
    'safety', 5);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_skadedyr_id, 'Daglig sjekk: tegn pa skadedyr',        'Sjekk daglig for tegn pa gnagere, insekter eller andre skadedyr.',                                                     1, true, 3),
    (v_proc_skadedyr_id, 'Sjekk baitstasjoner manedlig',          'Kontroller alle baitstasjoner og feller minst en gang per maned.',                                                      2, true, 5),
    (v_proc_skadedyr_id, 'Tetning av apninger',                   'Kontroller og tett apninger rundt ror, kabler og dorer.',                                                               3, true, 5),
    (v_proc_skadedyr_id, 'Hold avfall innelukket',                 'Sorg for at alt avfall oppbevares i lukkede beholdere.',                                                                4, true, 2),
    (v_proc_skadedyr_id, 'Rapporter funn umiddelbart',             'Meld observasjoner av skadedyr umiddelbart til skiftleder.',                                                            5, true, 1),
    (v_proc_skadedyr_id, 'Kontakt profesjonell ved behov',         'Kontakt Anticimex eller annet profesjonelt firma ved funn.',                                                            6, true, 2);

  -- =========================================================================
  -- Policy 3: Allergenhandtering og merking (3 procedures)
  -- =========================================================================

  -- 6.11 Allergenregistrering per rett
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_allergenreg_id, v_prot_allergen_id,
    'Allergenregistrering per rett',
    'Dokumenter allergener for hvert menypunkt. De 14 allergenene: gluten, krepsdyr, egg, fisk, peanotter, soya, melk, notter, selleri, sennep, sesam, sulfitt, blotdyr, lupin.',
    'safety', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_allergenreg_id, 'List alle ingredienser per rett',     'Ga gjennom oppskriften og list alle ingredienser.',                                                                     1, true, 5),
    (v_proc_allergenreg_id, 'Krysskontroller mot 14 allergener',  'Sjekk hver ingrediens mot de 14 deklarasjonspliktige allergenene.',                                                    2, true, 5),
    (v_proc_allergenreg_id, 'Merk allergener pa reseptkort',      'Merk alle identifiserte allergener pa rettens reseptkort.',                                                              3, true, 3),
    (v_proc_allergenreg_id, 'Oppdater ved oppskriftsendring',     'Oppdater allergenmerking hver gang oppskrift endres.',                                                                  4, true, 2),
    (v_proc_allergenreg_id, 'Gjor tilgjengelig for serveringspersonale', 'Sorg for at oppdatert allergenliste er tilgjengelig for alle som serverer.',                                     5, true, 2);

  -- 6.12 Allergeninformasjon ved servering
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_allergenserv_id, v_prot_allergen_id,
    'Allergeninformasjon ved servering',
    'Prosedyre for allergeninformasjon og kommunikasjon ved servering til gjester.',
    'safety', 2);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_allergenserv_id, 'Spor gjest om allergier',            'Spor proaktivt om allergier eller intoleranse for bestilling.',                                                         1, true, 1),
    (v_proc_allergenserv_id, 'Sjekk menyens allergenmerking',     'Kontroller allergenlisten for de rettene gjesten onsker a bestille.',                                                   2, true, 1),
    (v_proc_allergenserv_id, 'Konsulter kjokken ved usikkerhet',  'Hvis du er usikker, kontakt kjokkenet for bekreftelse.',                                                                3, true, 2),
    (v_proc_allergenserv_id, 'Kommuniser til kjokken',             'Merk bestilling tydelig med allergenvarsel og bekreft at kjokkenet har mottatt.',                                      4, true, 1),
    (v_proc_allergenserv_id, 'Dobbeltsjekk tallerkenen',           'Kontroller rett tallerkenen for servering at den er korrekt tilberedt.',                                               5, true, 1),
    (v_proc_allergenserv_id, 'Dokumenter allergenhendelser',       'Registrer eventuelle allergenhendelser eller nestenuhell i avviksloggen.',                                              6, true, 2);

  -- 6.13 Forebygging av kryssforurensning allergener
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_kryssforurensning_id, v_prot_allergen_id,
    'Forebygging av kryssforurensning allergener',
    'Prosedyre for a forhindre kryssforurensning mellom allergener og allergenfrie retter.',
    'safety', 3);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_kryssforurensning_id, 'Bruk separate redskaper',       'Bruk egne kniver, skjaerebrett og redskaper for allergenfri tilberedning.',                                            1, true, 1),
    (v_proc_kryssforurensning_id, 'Rengjor flater mellom prep',    'Rengjor arbeidsflater grundig mellom tilberedning av ulike retter.',                                                  2, true, 3),
    (v_proc_kryssforurensning_id, 'Oppbevar allergenfritt separat', 'Lagre allergenfrie ingredienser adskilt og tydelig merket.',                                                          3, true, 2),
    (v_proc_kryssforurensning_id, 'Merk beholdere tydelig',         'Alle beholdere med allergeninnhold skal vaere tydelig merket.',                                                       4, true, 1),
    (v_proc_kryssforurensning_id, 'Aldri gjenbruk stekeolje',       'Gjenbruk aldri stekeolje mellom allergenholdige og allergenfrie produkter.',                                          5, true, 1);

  -- =========================================================================
  -- Policy 4: Sporbarhet og avvikshandtering (7 procedures)
  -- =========================================================================

  -- 6.14 Varemottak og sporbarhet
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_varemottak_spor_id, v_prot_sporbarhet_id,
    'Varemottak og sporbarhet',
    'Prosedyre for varemottak med sporing av leverandor, batch og holdbarhet.',
    'safety', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_varemottak_spor_id, 'Kontroller leveranse mot ordre',   'Sammenlign folgeseddel med bestilling. Meld avvik.',                                                                  1, true, 3),
    (v_proc_varemottak_spor_id, 'Registrer leverandor og batch',    'Registrer leverandornavn, batchnummer og best-for-dato i mottakslogg.',                                              2, true, 3),
    (v_proc_varemottak_spor_id, 'Sjekk emballasje',                'Kontroller at emballasje er hel, ren og uaapnet.',                                                                    3, true, 2),
    (v_proc_varemottak_spor_id, 'Temperatursjekk med probe',       'Mal kjernetemperatur med probetermometer pa kjolevarer.',                                                              4, true, 3),
    (v_proc_varemottak_spor_id, 'FIFO-plassering',                 'Plasser nye varer bak eksisterende. Forst inn, forst ut.',                                                             5, true, 5),
    (v_proc_varemottak_spor_id, 'Arkiver folgeseddel 2 ar',        'Arkiver folgesedler og mottaksdokumenter i minst 2 ar.',                                                              6, true, 1);

  -- 6.15 Avvikshandtering
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_avvik_id, v_prot_sporbarhet_id,
    'Avvikshandtering',
    'Prosedyre for handtering av avvik fra mattrygghetskrav.',
    'safety', 2);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_avvik_id, 'Identifiser avviket',                       'Beskriv hva avviket er, nar det oppstod, og hvor.',                                                                    1, true, 2),
    (v_proc_avvik_id, 'Umiddelbar korrigerende handling',          'Utfor umiddelbar korreksjon: kasser mat, juster temperatur, rengjor, etc.',                                            2, true, 5),
    (v_proc_avvik_id, 'Dokumenter avviket',                        'Skriv ned: hva, nar, hvor, hvem oppdaget, korrigerende tiltak.',                                                       3, true, 5),
    (v_proc_avvik_id, 'Varsle skiftleder',                         'Informer skiftleder eller daglig leder om avviket.',                                                                   4, true, 1),
    (v_proc_avvik_id, 'Rotaarsaksanalyse',                         'Undersok grunnarsaken til avviket.',                                                                                   5, true, 10),
    (v_proc_avvik_id, 'Forebyggende tiltak',                       'Iverksett tiltak for a hindre at avviket skjer igjen.',                                                                6, true, 5),
    (v_proc_avvik_id, 'Folg opp',                                  'Kontroller at forebyggende tiltak er effektive.',                                                                       7, true, 5);

  -- 6.16 Tilbaketrekking og tilbakekalling
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_tilbaketrekking_id, v_prot_sporbarhet_id,
    'Tilbaketrekking og tilbakekalling',
    'Prosedyre for tilbaketrekking av produkter ved varsel fra leverandor eller Mattilsynet.',
    'safety', 3);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_tilbaketrekking_id, 'Motta varsel',                    'Motta varsel fra leverandor eller Mattilsynet om tilbaketrekking.',                                                     1, true, 2),
    (v_proc_tilbaketrekking_id, 'Identifiser berort produkt',      'Finn berort produkt ved hjelp av batchnummer og leverandorinformasjon.',                                               2, true, 5),
    (v_proc_tilbaketrekking_id, 'Isoler fra lageret',              'Fjern berort produkt fra lager og merk tydelig: SKAL IKKE BRUKES.',                                                    3, true, 5),
    (v_proc_tilbaketrekking_id, 'Dokumenter mengder',              'Registrer antall, vekt og verdi av berort produkt.',                                                                    4, true, 3),
    (v_proc_tilbaketrekking_id, 'Rapporter til Mattilsynet',       'Meld til Mattilsynet dersom palagt eller ved mistanke om helsefare.',                                                  5, true, 5),
    (v_proc_tilbaketrekking_id, 'Informer berort part',             'Informer alle som kan ha mottatt produktet.',                                                                          6, true, 5),
    (v_proc_tilbaketrekking_id, 'Kasser korrekt',                   'Kasser produktet pa forskriftsmessig mate. Dokumenter.',                                                               7, true, 3);

  -- 6.17 Internrevisjon IK-mat
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_internrevisjon_id, v_prot_sporbarhet_id,
    'Internrevisjon IK-mat',
    'Prosedyre for kvartalsvis internrevisjon av mattrygghetsystemet.',
    'safety', 4);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_internrevisjon_id, 'Planlegg kvartalsvis gjennomgang',  'Sett av tid for kvartalsvis gjennomgang av IK-mat-systemet.',                                                         1, true, 5),
    (v_proc_internrevisjon_id, 'Sjekk at prosedyrer er oppdatert', 'Kontroller at alle prosedyrer er gjeldende og folges i praksis.',                                                      2, true, 30),
    (v_proc_internrevisjon_id, 'Verifiser temperaturlogger',        'Sjekk at alle temperaturlogger er komplett utfylt.',                                                                   3, true, 15),
    (v_proc_internrevisjon_id, 'Gjennomga avviksrapporter',         'Les gjennom alle avviksmeldinger siden forrige revisjon.',                                                             4, true, 20),
    (v_proc_internrevisjon_id, 'Sjekk allergeninformasjon',         'Kontroller at allergeninformasjon er noyaktig for alle retter.',                                                       5, true, 15),
    (v_proc_internrevisjon_id, 'Oppdater prosedyrer ved behov',     'Revider prosedyrer basert pa funn fra revisjonen.',                                                                    6, true, 20),
    (v_proc_internrevisjon_id, 'Dokumenter funn og tiltak',         'Skriv revisjonsrapport med funn, avvik og planlagte tiltak.',                                                          7, true, 15);

  -- 6.18 Datomerking og holdbarhet
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_datomerking_id, v_prot_sporbarhet_id,
    'Datomerking og holdbarhet',
    'Prosedyre for daglig kontroll av datomerkinger og holdbarhet.',
    'safety', 5);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_datomerking_id, 'Sjekk best-for-dato daglig',          'Ga gjennom alle kjoleskap, frysere og torrlager for utgatte varer.',                                                   1, true, 10),
    (v_proc_datomerking_id, 'Fjern utgatte varer',                  'Fjern alle varer som har passert holdbarhetsdato.',                                                                    2, true, 5),
    (v_proc_datomerking_id, 'Merk apnet varer med dato',            'Alle varer som apnes skal merkes med apningsdato.',                                                                   3, true, 3),
    (v_proc_datomerking_id, 'Folg interne holdbarhetskrav',         'Apnet meieri: 3 dager. Tilberedt mat: 3 dager. Sjekk intern liste.',                                                 4, true, 2),
    (v_proc_datomerking_id, 'FIFO i all lagring',                   'Sorg for forst inn, forst ut i alle lagringspunkter.',                                                                5, true, 5);

  -- 6.19 Proevetaking og laboratorieanalyse
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_proevetaking_id, v_prot_sporbarhet_id,
    'Proevetaking og laboratorieanalyse',
    'Prosedyre for manedlig proevetaking og innsending til godkjent laboratorium.',
    'safety', 6);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_proevetaking_id, 'Ta overflateproever manedlig',        'Ta svaberproever fra arbeidsflater, skjaerebrett og utstyr manedlig.',                                                1, true, 15),
    (v_proc_proevetaking_id, 'Send til godkjent lab',               'Send proever til godkjent laboratorium for analyse.',                                                                  2, true, 5),
    (v_proc_proevetaking_id, 'Registrer resultater',                'For inn analyseresultater i kvalitetssystemet.',                                                                       3, true, 3),
    (v_proc_proevetaking_id, 'Korrigerende tiltak ved avvik',       'Ved resultater utenfor akseptabelt niva: umiddelbar korreksjon av renholdsrutiner.',                                  4, true, 10),
    (v_proc_proevetaking_id, 'Juster renholdsrutiner',              'Oppdater renholdsplan basert pa analyseresultater.',                                                                   5, true, 5),
    (v_proc_proevetaking_id, 'Retest innen 2 uker',                'Gjennomfor ny proevetaking innen 2 uker etter avvik.',                                                                6, true, 15);

  -- 6.20 Opplaering nytilsatte - mattrygghet
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_opplaering_id, v_prot_sporbarhet_id,
    'Opplaering nytilsatte - mattrygghet',
    'Prosedyre for opplaering av nye ansatte i mattrygghet og IK-mat.',
    'safety', 7);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_opplaering_id, 'Gjennomfor Mattilsynet e-laering',     'Fullfar Mattilsynets e-laeringskurs for naeringsmiddelhygiene.',                                                       1, true, 60),
    (v_proc_opplaering_id, 'Skyggejobb med erfaren ansatt',        'Folg en erfaren ansatt i 2 dager for a laere praktiske rutiner.',                                                     2, true, 960),
    (v_proc_opplaering_id, 'Besta intern kunnskapstest (80%)',      'Gjennomfor og besta intern kunnskapstest med minimum 80% riktig.',                                                    3, true, 20),
    (v_proc_opplaering_id, 'Ga gjennom allergendokumentasjon',     'Les og forsta allergenmerking for alle retter pa menyen.',                                                              4, true, 30),
    (v_proc_opplaering_id, 'Demonstrer korrekt handvask',          'Vis at du behersker korrekt handvaskprosedyre.',                                                                        5, true, 5),
    (v_proc_opplaering_id, 'Signer bekreftelse',                   'Signer bekreftelse pa gjennomfort opplaering i mattrygghet.',                                                          6, true, 2);

  ---------------------------------------------------------------------------
  -- 7. ROUTINES (12)
  ---------------------------------------------------------------------------

  -- 7.1 Temperaturlogg morgen
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_temperatur_id, v_proc_daglig_templogg_id,
    'Temperaturlogg morgen',
    'scheduled',
    '{"times": ["08:00"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_kitchen_id, 'every_time');

  -- 7.2 Temperaturlogg ettermiddag
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_temperatur_id, v_proc_daglig_templogg_id,
    'Temperaturlogg ettermiddag',
    'scheduled',
    '{"times": ["15:00"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_kitchen_id, 'every_time');

  -- 7.3 Varemottak kontroll
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_temperatur_id, v_proc_varemottak_temp_id,
    'Varemottak kontroll',
    'event',
    '{"event": "goods_delivery", "description": "Utfores ved hver vareleveranse"}'::jsonb,
    'team', v_team_kitchen_id, 'every_time');

  -- 7.4 Varmholding lunsj
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_temperatur_id, v_proc_varmholding_id,
    'Varmholding lunsj',
    'scheduled',
    '{"times": ["12:30"], "days": ["mon","tue","wed","thu","fri","sat"]}'::jsonb,
    'team', v_team_kitchen_id, 'every_time');

  -- 7.5 Varmholding middag
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_temperatur_id, v_proc_varmholding_id,
    'Varmholding middag',
    'scheduled',
    '{"times": ["19:30"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_kitchen_id, 'every_time');

  -- 7.6 Handhygiene kontroll
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_list_id, control_frequency)
  VALUES (v_prot_hygiene_id, v_proc_handhygiene_id,
    'Handhygiene kontroll',
    'scheduled',
    '{"times": ["10:00"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_kitchen_id, NULL, 'every_nth');

  -- 7.7 Daglig renhold kjokken
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_hygiene_id, v_proc_daglig_renhold_id,
    'Daglig renhold kjokken',
    'scheduled',
    '{"times": ["22:00"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_kitchen_id, 'every_time');

  -- 7.8 Ukentlig dyprenhold
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_hygiene_id, v_proc_ukentlig_dyp_id,
    'Ukentlig dyprenhold',
    'scheduled',
    '{"times": ["06:00"], "days": ["mon"]}'::jsonb,
    'team', v_team_kitchen_id, 'every_time');

  -- 7.9 Allergensjekk meny
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_allergen_id, v_proc_allergenreg_id,
    'Allergensjekk meny',
    'scheduled',
    '{"times": ["10:00"], "days": ["mon"]}'::jsonb,
    'team', v_team_kitchen_id, 'every_nth');

  -- 7.10 Daglig datokontroll
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_sporbarhet_id, v_proc_datomerking_id,
    'Daglig datokontroll',
    'scheduled',
    '{"times": ["09:00"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_kitchen_id, 'every_time');

  -- 7.11 Sanitaer renhold formiddag
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_hygiene_id, v_proc_sanitaer_id,
    'Sanitaer renhold formiddag',
    'scheduled',
    '{"times": ["11:00"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_sal_id, 'every_time');

  -- 7.12 Sanitaer renhold ettermiddag
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_hygiene_id, v_proc_sanitaer_id,
    'Sanitaer renhold ettermiddag',
    'scheduled',
    '{"times": ["17:00"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_sal_id, 'every_time');

  ---------------------------------------------------------------------------
  -- 8. CONTROL LISTS (8)
  ---------------------------------------------------------------------------

  -- 8.1 Temperaturlogg kjoleenheter
  INSERT INTO public.control_list (control_list_id, protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_cl_templogg_id, v_prot_temperatur_id,
    'Temperaturlogg kjoleenheter',
    'Sjekkliste for daglig temperaturmaling av kjole- og fryseenheter.',
    'team_leader', v_team_kitchen_id,
    '[
      {"label": "Kjoleskap 1 temp (grader C)", "required": true},
      {"label": "Kjoleskap 2 temp (grader C)", "required": true},
      {"label": "Fryser 1 temp (grader C)", "required": true},
      {"label": "Fryser 2 temp (grader C)", "required": true},
      {"label": "Temperatur innenfor grenser?", "required": true},
      {"label": "Avvik dokumentert (hvis aktuelt)?", "required": false},
      {"label": "Signatur", "required": true}
    ]'::jsonb);

  -- 8.2 Varemottak sjekkliste
  INSERT INTO public.control_list (control_list_id, protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_cl_varemottak_id, v_prot_temperatur_id,
    'Varemottak sjekkliste',
    'Sjekkliste for kontroll av vareleveranser ved mottak.',
    'team_leader', v_team_kitchen_id,
    '[
      {"label": "Folgeseddel kontrollert", "required": true},
      {"label": "Temperatur malt (grader C)", "required": true},
      {"label": "Under grenseverdi?", "required": true},
      {"label": "Holdbarhet OK", "required": true},
      {"label": "Emballasje hel", "required": true},
      {"label": "FIFO plassert", "required": true},
      {"label": "Avvik meldt (hvis aktuelt)", "required": false},
      {"label": "Signatur", "required": true}
    ]'::jsonb);

  -- 8.3 Daglig renholdssjekkliste kjokken
  INSERT INTO public.control_list (control_list_id, protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_cl_daglig_renhold_id, v_prot_hygiene_id,
    'Daglig renholdssjekkliste kjokken',
    'Sjekkliste for daglig renhold av kjokkenavdelingen.',
    'team_leader', v_team_kitchen_id,
    '[
      {"label": "Arbeidsbenker rengjort", "required": true},
      {"label": "Skjaerebrett rengjort/byttet", "required": true},
      {"label": "Utstyr vasket", "required": true},
      {"label": "Gulv feid og vasket", "required": true},
      {"label": "Soppel tomt", "required": true},
      {"label": "Handvask stasjoner fylt", "required": true},
      {"label": "Kluter byttet", "required": true}
    ]'::jsonb);

  -- 8.4 Ukentlig dyprenhold sjekkliste
  INSERT INTO public.control_list (control_list_id, protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_cl_ukentlig_dyp_id, v_prot_hygiene_id,
    'Ukentlig dyprenhold sjekkliste',
    'Sjekkliste for ukentlig dyprenhold av kjokken og utstyr.',
    'team_leader', v_team_kitchen_id,
    '[
      {"label": "Ventilasjonshette og filtre", "required": true},
      {"label": "Ovner innvendig", "required": true},
      {"label": "Frityrkokere", "required": true},
      {"label": "Kjoleskap innvendig", "required": true},
      {"label": "Frysere innvendig", "required": true},
      {"label": "Avlop", "required": true},
      {"label": "Vegger og hyller bak utstyr", "required": true},
      {"label": "Skadedyrfeller sjekket", "required": true}
    ]'::jsonb);

  -- 8.5 Allergenoversikt serveringskontroll
  INSERT INTO public.control_list (control_list_id, protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_cl_allergen_id, v_prot_allergen_id,
    'Allergenoversikt serveringskontroll',
    'Sjekkliste for allergeninformasjon og kommunikasjon ved servering.',
    'team_leader', v_team_sal_id,
    '[
      {"label": "Allergenliste oppdatert for alle retter?", "required": true},
      {"label": "Personalet briefet om dagens allergener?", "required": true},
      {"label": "Spesialbestillinger kommunisert til kjokken?", "required": true},
      {"label": "Kryssforurensning forebygget?", "required": true}
    ]'::jsonb);

  -- 8.6 Varmholdingskontroll
  INSERT INTO public.control_list (control_list_id, protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_cl_varmholding_id, v_prot_temperatur_id,
    'Varmholdingskontroll',
    'Sjekkliste for temperaturkontroll av varmholdt mat.',
    'team_leader', v_team_kitchen_id,
    '[
      {"label": "Rett 1 temp (grader C)", "required": true},
      {"label": "Rett 2 temp (grader C)", "required": true},
      {"label": "Rett 3 temp (grader C)", "required": true},
      {"label": "Alle over 60 grader C?", "required": true},
      {"label": "Tidspunkt malt", "required": true},
      {"label": "Avvik handtert?", "required": false}
    ]'::jsonb);

  -- 8.7 Nedkjolingskontroll
  INSERT INTO public.control_list (control_list_id, protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_cl_nedkjoling_id, v_prot_temperatur_id,
    'Nedkjolingskontroll',
    'Sjekkliste for overvaking av rask nedkjoling.',
    'team_leader', v_team_kitchen_id,
    '[
      {"label": "Starttemperatur (grader C)", "required": true},
      {"label": "Starttidspunkt", "required": true},
      {"label": "Slutttemperatur (grader C)", "required": true},
      {"label": "Sluttidspunkt", "required": true},
      {"label": "Under 10 grader C innen 2 timer?", "required": true},
      {"label": "Merket med dato og klokkeslett?", "required": true}
    ]'::jsonb);

  -- 8.8 Sanitaer og garderobe sjekkliste
  INSERT INTO public.control_list (control_list_id, protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_cl_sanitaer_id, v_prot_hygiene_id,
    'Sanitaer og garderobe sjekkliste',
    'Sjekkliste for renhold av sanitaerrom og garderobe.',
    'team_leader', v_team_sal_id,
    '[
      {"label": "Ansatttoaletter rengjort", "required": true},
      {"label": "Sape og papir fylt", "required": true},
      {"label": "Handvask stasjon OK", "required": true},
      {"label": "Garderobe ryddig", "required": true},
      {"label": "Arbeidsklarer separert fra privatklarer", "required": true}
    ]'::jsonb);

  ---------------------------------------------------------------------------
  -- 9. KNOWLEDGE TESTS (4)
  ---------------------------------------------------------------------------

  -- 9.1 Temperaturkontroll og kaldkjede (pass: 80%)
  INSERT INTO public.knowledge_test (protocol_id, name, description, pass_threshold, questions)
  VALUES (v_prot_temperatur_id,
    'Temperaturkontroll og kaldkjede',
    'Kunnskapstest om temperaturkrav, kaldkjede og kjernetemperatur iht. Mattilsynet.',
    80,
    '[
      {
        "question": "Hva er godkjent temperaturomrade for kjoleskap?",
        "options": ["0-4 grader C", "2-8 grader C", "0-10 grader C", "-2 til 2 grader C"],
        "correct_index": 0
      },
      {
        "question": "Hva er maks temperatur for fryselagring?",
        "options": ["-10 grader C", "-15 grader C", "-18 grader C", "-24 grader C"],
        "correct_index": 2
      },
      {
        "question": "Hva er minimum kjernetemperatur for tilberedt kylling?",
        "options": ["60 grader C", "65 grader C", "70 grader C", "75 grader C"],
        "correct_index": 3
      },
      {
        "question": "Hva er minimum temperatur for varmholding?",
        "options": ["40 grader C", "50 grader C", "60 grader C", "70 grader C"],
        "correct_index": 2
      },
      {
        "question": "Hva er maks tid for nedkjoling fra 60 til 10 grader C?",
        "options": ["1 time", "2 timer", "3 timer", "4 timer"],
        "correct_index": 1
      },
      {
        "question": "I hvilket temperaturomrade trives bakterier best?",
        "options": ["Under 0 grader C", "0-4 grader C", "8-60 grader C", "Over 70 grader C"],
        "correct_index": 2
      },
      {
        "question": "Hva gjor du ved temperaturavvik i kjoleskapet?",
        "options": [
          "Ingenting, det ordner seg",
          "Flytt varer til annen enhet, meld avvik, vurder kassering",
          "Bare skru ned termostaten",
          "Vent til neste dag og sjekk igjen"
        ],
        "correct_index": 1
      },
      {
        "question": "Hvor males kjernetemperatur pa et produkt?",
        "options": [
          "Pa overflaten",
          "I tykkeste delen av produktet",
          "I enden av produktet",
          "Det spiller ingen rolle hvor"
        ],
        "correct_index": 1
      }
    ]'::jsonb);

  -- 9.2 Hygiene og renhold (pass: 80%)
  INSERT INTO public.knowledge_test (protocol_id, name, description, pass_threshold, questions)
  VALUES (v_prot_hygiene_id,
    'Hygiene og renhold',
    'Kunnskapstest om handhygiene, renholdsrutiner og personlig hygiene.',
    80,
    '[
      {
        "question": "Hvor lenge skal hendene vaskes med sape?",
        "options": ["5 sekunder", "10 sekunder", "20 sekunder", "60 sekunder"],
        "correct_index": 2
      },
      {
        "question": "Hva er riktig rekkefolge for handvask?",
        "options": [
          "Sape, vann, tork",
          "Vatt, sape, skrubb, skyll, tork",
          "Skyll, sape, tork",
          "Desinfiser, skyll, tork"
        ],
        "correct_index": 1
      },
      {
        "question": "Hvor ofte byttes kjokkenkluter?",
        "options": [
          "Ukentlig",
          "Daglig, vask ved 65 grader C",
          "Nar de ser skitne ut",
          "Hver maned"
        ],
        "correct_index": 1
      },
      {
        "question": "Kan en ansatt med diare lage mat?",
        "options": [
          "Ja, med hansker",
          "Ja, hvis man vasker hendene",
          "Nei, vent 48 timer etter symptomfrihet",
          "Ja, det er ikke smittsomt"
        ],
        "correct_index": 2
      },
      {
        "question": "Hva kreves det separate skjaerebrett for?",
        "options": [
          "Ulike farger pa gronnsaker",
          "Ratt kjott, gronnsaker, ferdig mat",
          "Store og sma porsjoner",
          "Det trengs ikke separate brett"
        ],
        "correct_index": 1
      },
      {
        "question": "Hvor lagres rengjoringsmidler?",
        "options": [
          "Under vasken pa kjokkenet",
          "Ved siden av maten for rask tilgang",
          "Ikke i matomrader, i eget skap",
          "I kjoleskapet"
        ],
        "correct_index": 2
      }
    ]'::jsonb);

  -- 9.3 Allergenhandtering (pass: 80%)
  INSERT INTO public.knowledge_test (protocol_id, name, description, pass_threshold, questions)
  VALUES (v_prot_allergen_id,
    'Allergenhandtering',
    'Kunnskapstest om de 14 allergenene, merking og forebygging av kryssforurensning.',
    80,
    '[
      {
        "question": "Hvor mange deklarasjonspliktige allergener finnes det?",
        "options": ["10", "12", "14", "16"],
        "correct_index": 2
      },
      {
        "question": "Hvilke av folgende er blant de 14 allergenene?",
        "options": [
          "Tomat, agurk, paprika, gulrot, lok",
          "Gluten, egg, melk, fisk, notter",
          "Ris, mais, poteter, banan, eple",
          "Olivenolje, smor, sukker, salt, pepper"
        ],
        "correct_index": 1
      },
      {
        "question": "Hva betyr merking med Inneholder pa en matvare?",
        "options": [
          "Matvaren er sunn",
          "Angir at et bestemt allergen er til stede i matvaren",
          "Matvaren er okoologisk",
          "Matvaren er norskprodusert"
        ],
        "correct_index": 1
      },
      {
        "question": "Hvordan forebygger du kryssforurensning mellom allergener?",
        "options": [
          "Vaske hendene en ekstra gang",
          "Separate redskaper, grundig rengjoring mellom tilberedninger",
          "Bruke samme utstyr men jobbe raskere",
          "Det er ikke mulig a forebygge kryssforurensning"
        ],
        "correct_index": 1
      },
      {
        "question": "Kan muntlig informasjon erstatte skriftlig allergenmerking?",
        "options": [
          "Ja, muntlig er nok",
          "Nei, skriftlig allergeninformasjon er obligatorisk",
          "Ja, hvis gjesten samtykker",
          "Bare pa smale arrangementer"
        ],
        "correct_index": 1
      },
      {
        "question": "Hva gjor du hvis en gjest melder allergi?",
        "options": [
          "Si at det sannsynligvis gar bra",
          "Sjekk reseptkort, informer kjokken, dobbeltsjekk tallerkenen",
          "Be gjesten bestille noe annet",
          "Ignorer det hvis det er en ukjent allergi"
        ],
        "correct_index": 1
      }
    ]'::jsonb);

  -- 9.4 Internkontroll og avvikshandtering (pass: 75%)
  INSERT INTO public.knowledge_test (protocol_id, name, description, pass_threshold, questions)
  VALUES (v_prot_sporbarhet_id,
    'Internkontroll og avvikshandtering',
    'Kunnskapstest om IK-mat, avvikshandtering og sporbarhet.',
    75,
    '[
      {
        "question": "Hva er internkontroll (IK-mat)?",
        "options": [
          "En ekstern revisjon fra Mattilsynet",
          "Systematisk gjennomgang for a sikre etterlevelse av matlovgivning",
          "En arlig rapport til kommunen",
          "En frivillig kvalitetsordning"
        ],
        "correct_index": 1
      },
      {
        "question": "Hva er de 5 elementene i IK-mat?",
        "options": [
          "Kjope, lage, selge, rydde, stenge",
          "Planlegge, organisere, utfore, vedlikeholde, dokumentere",
          "Vaske, kjole, fryse, varme, servere",
          "Bestille, motta, lagre, tilberede, kaste"
        ],
        "correct_index": 1
      },
      {
        "question": "Hvor lenge skal avviksmeldinger arkiveres?",
        "options": ["6 maneder", "1 ar", "Minimum 2 ar", "5 ar"],
        "correct_index": 2
      },
      {
        "question": "Hva gjores forst ved et mattryggghetsavvik?",
        "options": [
          "Vent til slutten av skiftet",
          "Umiddelbar korrigerende handling",
          "Send e-post til leder",
          "Ignorer det hvis det er lite"
        ],
        "correct_index": 1
      },
      {
        "question": "Hvem kontaktes ved alvorlig matbaren sykdom?",
        "options": [
          "Forsikringsselskapet",
          "Leverandoren",
          "Mattilsynet",
          "Kommunen"
        ],
        "correct_index": 2
      }
    ]'::jsonb);

END;
$$;

-- Grant execute to authenticated users (RLS on underlying tables handles access control)
GRANT EXECUTE ON FUNCTION template_restaurant_mattilsynet(uuid) TO authenticated;
