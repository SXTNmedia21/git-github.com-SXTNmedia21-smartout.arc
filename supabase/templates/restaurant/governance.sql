-- Template: Restaurant Governance
-- Industry:   restaurant (NACE 56.101)
-- Policies:   10 (haccp, operational, safety, hr)
-- Protocols:  10 (1:1 with policies)
-- Procedures: 12 (with 3-5 steps each)
-- Routines:   4
-- Control lists: 3
-- Knowledge tests: 3
-- Confirmations: 2
-- Depends:    departments.sql (for team lookups)
-- Usage:      SELECT template_restaurant_governance(p_workspace_id);

CREATE OR REPLACE FUNCTION template_restaurant_governance(p_workspace_id uuid)
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
  v_team_ledelse_id uuid;

  -- Policy IDs
  v_pol_temperatur_id uuid;
  v_pol_allergen_id uuid;
  v_pol_apning_id uuid;
  v_pol_stenging_id uuid;
  v_pol_handhygiene_id uuid;
  v_pol_brannvern_id uuid;
  v_pol_kassa_id uuid;
  v_pol_varemottak_id uuid;
  v_pol_hms_id uuid;
  v_pol_skjenke_id uuid;

  -- Protocol IDs
  v_prot_temperatur_id uuid;
  v_prot_allergen_id uuid;
  v_prot_apning_id uuid;
  v_prot_stenging_id uuid;
  v_prot_handhygiene_id uuid;
  v_prot_brannvern_id uuid;
  v_prot_kassa_id uuid;
  v_prot_varemottak_id uuid;
  v_prot_hms_id uuid;
  v_prot_skjenke_id uuid;

  -- Procedure IDs
  v_proc_temp_daglig_id uuid;
  v_proc_allergen_serv_id uuid;
  v_proc_apning_kjokken_id uuid;
  v_proc_apning_sal_id uuid;
  v_proc_stenge_kjokken_id uuid;
  v_proc_stenge_sal_id uuid;
  v_proc_handhygiene_id uuid;
  v_proc_evakuering_id uuid;
  v_proc_kassaoppgjor_id uuid;
  v_proc_varemottak_id uuid;
  v_proc_hms_avvik_id uuid;
  v_proc_alderskontroll_id uuid;

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

  SELECT team_id INTO v_team_ledelse_id
    FROM public.team
   WHERE workspace_id = p_workspace_id AND slug = 'ledelsesteam'
   LIMIT 1;

  IF v_team_ledelse_id IS NULL THEN
    v_team_ledelse_id := gen_random_uuid();
    INSERT INTO public.team (team_id, workspace_id, name, slug, team_type)
    VALUES (v_team_ledelse_id, p_workspace_id, 'Ledelsesteam', 'ledelsesteam', 'operational');
  END IF;

  ---------------------------------------------------------------------------
  -- 3. Generate IDs for all governance objects
  ---------------------------------------------------------------------------
  v_pol_temperatur_id   := gen_random_uuid();
  v_pol_allergen_id     := gen_random_uuid();
  v_pol_apning_id       := gen_random_uuid();
  v_pol_stenging_id     := gen_random_uuid();
  v_pol_handhygiene_id  := gen_random_uuid();
  v_pol_brannvern_id    := gen_random_uuid();
  v_pol_kassa_id        := gen_random_uuid();
  v_pol_varemottak_id   := gen_random_uuid();
  v_pol_hms_id          := gen_random_uuid();
  v_pol_skjenke_id      := gen_random_uuid();

  v_prot_temperatur_id  := gen_random_uuid();
  v_prot_allergen_id    := gen_random_uuid();
  v_prot_apning_id      := gen_random_uuid();
  v_prot_stenging_id    := gen_random_uuid();
  v_prot_handhygiene_id := gen_random_uuid();
  v_prot_brannvern_id   := gen_random_uuid();
  v_prot_kassa_id       := gen_random_uuid();
  v_prot_varemottak_id  := gen_random_uuid();
  v_prot_hms_id         := gen_random_uuid();
  v_prot_skjenke_id     := gen_random_uuid();

  v_proc_temp_daglig_id     := gen_random_uuid();
  v_proc_allergen_serv_id   := gen_random_uuid();
  v_proc_apning_kjokken_id  := gen_random_uuid();
  v_proc_apning_sal_id      := gen_random_uuid();
  v_proc_stenge_kjokken_id  := gen_random_uuid();
  v_proc_stenge_sal_id      := gen_random_uuid();
  v_proc_handhygiene_id     := gen_random_uuid();
  v_proc_evakuering_id      := gen_random_uuid();
  v_proc_kassaoppgjor_id    := gen_random_uuid();
  v_proc_varemottak_id      := gen_random_uuid();
  v_proc_hms_avvik_id       := gen_random_uuid();
  v_proc_alderskontroll_id  := gen_random_uuid();

  ---------------------------------------------------------------------------
  -- 4. POLICIES (10)
  ---------------------------------------------------------------------------

  -- 1. Temperaturkontroll
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_temperatur_id, p_workspace_id, v_season_id, 'haccp', 'workspace',
    'Temperaturkontroll',
    'Policy for daglig temperaturovervaking av kjole- og fryseenheter.',
    'Alle kjole- og fryseenheter skal kontrolleres minimum to ganger daglig. Avvik utenfor godkjent temperaturomrade skal handteres umiddelbart iht. Mattilsynets retningslinjer.',
    'enforced', v_admin_id);

  -- 2. Allergenhandtering
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_allergen_id, p_workspace_id, v_season_id, 'haccp', 'workspace',
    'Allergenhandtering',
    'Policy for korrekt merking og informasjon om allergener.',
    'Alle retter skal merkes med allergener iht. EU-forordning 1169/2011. Personalet skal kunne informere gjester om allergeninnhold i alle retter.',
    'enforced', v_admin_id);

  -- 3. Apningsrutiner
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_apning_id, p_workspace_id, v_season_id, 'operational', 'workspace',
    'Apningsrutiner',
    'Policy for systematisk apning av alle avdelinger.',
    'Alle avdelinger skal gjennomfore fastsatt apningsrutine for gjester mottas. Skiftleder bekrefter at sjekklisten er fullfort.',
    'enforced', v_admin_id);

  -- 4. Stengerutiner
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_stenging_id, p_workspace_id, v_season_id, 'operational', 'workspace',
    'Stengerutiner',
    'Policy for systematisk stenging av alle avdelinger.',
    'Alle avdelinger skal gjennomfore fastsatt stengerutine etter siste gjest. Kassaoppgjor, renhold og sikring skal dokumenteres.',
    'enforced', v_admin_id);

  -- 5. Handhygiene
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_handhygiene_id, p_workspace_id, v_season_id, 'haccp', 'workspace',
    'Handhygiene',
    'Policy for korrekt handvask i alle avdelinger.',
    'Alle ansatte i kjokken og sal skal vaske hender ved oppstart, etter toalettbesok, etter handtering av ratt kjott, og mellom arbeidsoppgaver. Iht. Forskrift om naeringsmiddelhygiene.',
    'enforced', v_admin_id);

  -- 6. Brannvern og evakuering
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_brannvern_id, p_workspace_id, v_season_id, 'safety', 'workspace',
    'Brannvern og evakuering',
    'Policy for brannsikkerhet og evakueringsrutiner.',
    'Alle ansatte skal kjenne romningsveier, moteplass og plassering av slokkeutstyr. Brannovelse gjennomfores minimum to ganger arlig iht. Forskrift om brannforebygging.',
    'enforced', v_admin_id);

  -- 7. Kassaoppgjor og verdihandtering
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_kassa_id, p_workspace_id, v_season_id, 'operational', 'department',
    'Kassaoppgjor og verdihandtering',
    'Policy for kassaoppgjor og handtering av kontanter.',
    'Kasse skal telles og avstemmes ved hvert skiftbytte og ved stenging. Avvik over NOK 50 rapporteres til daglig leder.',
    'enforced', v_admin_id);

  -- 8. Varemottak og lagring
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_varemottak_id, p_workspace_id, v_season_id, 'haccp', 'department',
    'Varemottak og lagring',
    'Policy for kontroll av vareleveranser og lagerhandtering.',
    'Alle vareleveranser skal kontrolleres ved mottak: temperatur, holdbarhetsdato, emballasje. FIFO-prinsippet gjelder i alle kjole- og torrlager.',
    'enforced', v_admin_id);

  -- 9. Arbeidsmiljo og HMS
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_hms_id, p_workspace_id, v_season_id, 'hr', 'workspace',
    'Arbeidsmiljo og HMS',
    'Policy for helse, miljo og sikkerhet pa arbeidsplassen.',
    'Arbeidsgiver skal sikre et fullt forsvarlig arbeidsmiljo iht. Arbeidsmiljoloven. Verneombud skal vaere oppnevnt. Avviksmeldinger behandles innen 48 timer.',
    'enforced', v_admin_id);

  -- 10. Skjenkekontroll og aldersgrense
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_skjenke_id, p_workspace_id, v_season_id, 'operational', 'department',
    'Skjenkekontroll og aldersgrense',
    'Policy for alderskontroll og ansvarlig alkoholservering.',
    'Alle gjester som ser under 25 ar ut skal legitimeres ved bestilling av alkohol. Skjenketider folger kommunale bestemmelser. Overstadig berusede personer nektes servering iht. Alkoholloven paragraf 8-11.',
    'enforced', v_admin_id);

  ---------------------------------------------------------------------------
  -- 5. PROTOCOLS (10, one per policy)
  ---------------------------------------------------------------------------

  INSERT INTO public.protocol (protocol_id, policy_id, workspace_id, name, description, status, owner_profile_id, created_by)
  VALUES
    (v_prot_temperatur_id,  v_pol_temperatur_id,  p_workspace_id, 'Temperaturkontroll-protokoll',          'Protokoll for daglig temperatursjekk.',               'active', v_admin_id, v_admin_id),
    (v_prot_allergen_id,    v_pol_allergen_id,    p_workspace_id, 'Allergenhandtering-protokoll',           'Protokoll for allergeninformasjon og handtering.',     'active', v_admin_id, v_admin_id),
    (v_prot_apning_id,      v_pol_apning_id,      p_workspace_id, 'Apningsrutiner-protokoll',              'Protokoll for apning av avdelinger.',                  'active', v_admin_id, v_admin_id),
    (v_prot_stenging_id,    v_pol_stenging_id,    p_workspace_id, 'Stengerutiner-protokoll',                'Protokoll for stenging av avdelinger.',                'active', v_admin_id, v_admin_id),
    (v_prot_handhygiene_id, v_pol_handhygiene_id, p_workspace_id, 'Handhygiene-protokoll',                  'Protokoll for korrekt handvask.',                     'active', v_admin_id, v_admin_id),
    (v_prot_brannvern_id,   v_pol_brannvern_id,   p_workspace_id, 'Brannvern og evakuering-protokoll',     'Protokoll for brannsikkerhet og evakuering.',         'active', v_admin_id, v_admin_id),
    (v_prot_kassa_id,       v_pol_kassa_id,       p_workspace_id, 'Kassaoppgjor-protokoll',                 'Protokoll for kassaoppgjor og verdihandtering.',      'active', v_admin_id, v_admin_id),
    (v_prot_varemottak_id,  v_pol_varemottak_id,  p_workspace_id, 'Varemottak og lagring-protokoll',       'Protokoll for varemottak, kontroll og lagring.',      'active', v_admin_id, v_admin_id),
    (v_prot_hms_id,         v_pol_hms_id,         p_workspace_id, 'Arbeidsmiljo og HMS-protokoll',         'Protokoll for HMS-arbeid og avvikshandtering.',       'active', v_admin_id, v_admin_id),
    (v_prot_skjenke_id,     v_pol_skjenke_id,     p_workspace_id, 'Skjenkekontroll-protokoll',              'Protokoll for alderskontroll og ansvarlig servering.', 'active', v_admin_id, v_admin_id);

  ---------------------------------------------------------------------------
  -- 6. PROCEDURES (12)
  ---------------------------------------------------------------------------

  -- 6.1 Daglig temperaturkontroll (Policy 1)
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_temp_daglig_id, v_prot_temperatur_id, 'Daglig temperaturkontroll',
    'Prosedyre for kontroll av alle kjole- og fryseenheter.', 'standard', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_temp_daglig_id, 'Sjekk kjoleskap (0-4 grader C)',       'Apne hvert kjoleskap og les av temperatur pa termometer. Godkjent omrade: 0-4 grader C.',                           1, true, 2),
    (v_proc_temp_daglig_id, 'Sjekk fryser (-18 grader C eller kaldere)', 'Les av temperatur pa alle frysere. Godkjent: -18 grader C eller kaldere.',                                    2, true, 2),
    (v_proc_temp_daglig_id, 'Registrer i temperaturlogg',           'For temperatur, klokkeslett og dine initialer i temperaturloggen.',                                                   3, true, 1),
    (v_proc_temp_daglig_id, 'Handter avvik',                        'Ved temperatur utenfor godkjent omrade: meld til kjokkensjef, vurder om varer ma kastes. Dokumenter tiltak.',        4, true, 5);

  -- 6.2 Allergenkontroll ved servering (Policy 2)
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_allergen_serv_id, v_prot_allergen_id, 'Allergenkontroll ved servering',
    'Prosedyre for handtering av allergeninformasjon ved servering.', 'standard', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_allergen_serv_id, 'Sjekk dagens allergenliste',           'Kontroller at oppdatert allergenliste er tilgjengelig for alle retter pa menyen.',                                  1, true, 2),
    (v_proc_allergen_serv_id, 'Informer gjester ved bestilling',      'Spor proaktivt om allergier. Gjennomga allergeninnhold for bestilte retter.',                                       2, true, 1),
    (v_proc_allergen_serv_id, 'Kommuniser til kjokken',               'Merk bestilling med allergenvarsel. Bekreft at kjokken har mottatt beskjeden.',                                     3, true, 1),
    (v_proc_allergen_serv_id, 'Separat tilberedning',                 'Sorg for at retter med allergenvarsel tilberedes med eget utstyr og pa egen benk.',                                 4, true, 3);

  -- 6.3 Apningsrutine kjokken (Policy 3)
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_apning_kjokken_id, v_prot_apning_id, 'Apningsrutine kjokken',
    'Prosedyre for daglig apning av kjokkenavdelingen.', 'standard', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_apning_kjokken_id, 'Skru pa utstyr',       'Sla pa ovner, komfyrer, frityrkoker, salamander. Sjekk at alt starter normalt.',                 1, true, 5),
    (v_proc_apning_kjokken_id, 'Temperaturkontroll',    'Sjekk temperatur i alle kjoleskap og frysere. Registrer i logg.',                                 2, true, 5),
    (v_proc_apning_kjokken_id, 'Mise en place',         'Forbered ingredienser for lunsj/middag. Skjaer gronnsaker, portjoner protein, klargjor sauser.',  3, true, 30),
    (v_proc_apning_kjokken_id, 'Sjekk varelager',       'Kontroller at alle nodvendige ravarer er pa plass. Bestill mangler.',                              4, true, 10),
    (v_proc_apning_kjokken_id, 'Renholdssjekk',         'Kontroller at alle flater, skjaerebrett og utstyr er rengjort fra forrige skift.',                5, true, 5);

  -- 6.4 Apningsrutine restaurant/sal (Policy 3)
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_apning_sal_id, v_prot_apning_id, 'Apningsrutine restaurant/sal',
    'Prosedyre for daglig apning av restauranten.', 'standard', 2);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_apning_sal_id, 'Dekk bord',                       'Legg duker, bestikk, glass og servietter iht. bordplan.',                                    1, true, 15),
    (v_proc_apning_sal_id, 'Sjekk reservasjoner',              'Ga gjennom dagens reservasjoner. Merk allergier og spesielle onsker.',                        2, true, 5),
    (v_proc_apning_sal_id, 'Klargjor kasse',                   'Tell vekslepenger, start kassesystem, skriv ut dagens meny.',                                 3, true, 5),
    (v_proc_apning_sal_id, 'Sjekk toaletter og fellesareal',   'Kontroller at toaletter er rene, papir fylt, fellesareal ryddig.',                            4, true, 5);

  -- 6.5 Stengerutine kjokken (Policy 4)
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_stenge_kjokken_id, v_prot_stenging_id, 'Stengerutine kjokken',
    'Prosedyre for daglig stenging av kjokkenavdelingen.', 'standard', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_stenge_kjokken_id, 'Rydd og rengjor arbeidsstasjoner', 'Vask alle benker, skjaerebrett og utstyr. Kast engangshansker.',                         1, true, 20),
    (v_proc_stenge_kjokken_id, 'Lagre restvarer',                  'Porsjoner og merk alle restvarer med dato. Plasser i kjoleskap.',                          2, true, 10),
    (v_proc_stenge_kjokken_id, 'Sla av utstyr',                    'Skru av ovner, frityrkoker, salamander. La ventilatorer kjore 15 min til.',                3, true, 5),
    (v_proc_stenge_kjokken_id, 'Gulvvask',                         'Fei og vask kjokkengulvet med godkjent rengjoringsmiddel.',                                4, true, 15),
    (v_proc_stenge_kjokken_id, 'Avfallshandtering',                'Tom alle soppelbotter. Kildesorter. Vask bottene.',                                        5, true, 10);

  -- 6.6 Stengerutine restaurant/sal (Policy 4)
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_stenge_sal_id, v_prot_stenging_id, 'Stengerutine restaurant/sal',
    'Prosedyre for daglig stenging av restauranten.', 'standard', 2);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_stenge_sal_id, 'Kassaoppgjor',                'Tell kasse, skriv ut Z-rapport, legg kontanter i safe. Dokumenter avvik.',                       1, true, 10),
    (v_proc_stenge_sal_id, 'Rydd bord og sal',            'Fjern alt fra bord. Tork av. Snu stoler opp der det er relevant.',                                2, true, 15),
    (v_proc_stenge_sal_id, 'Sjekk toaletter',             'Siste sjekk av toaletter. Rydd og fyll pa.',                                                      3, true, 5),
    (v_proc_stenge_sal_id, 'Las og alarm',                'Sjekk at alle vinduer er lukket. Las dorer. Aktiver alarm.',                                       4, true, 5);

  -- 6.7 Handhygiene - korrekt handvask (Policy 5)
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_handhygiene_id, v_prot_handhygiene_id, 'Handhygiene - korrekt handvask',
    'Prosedyre for korrekt handvask iht. hygienekrav.', 'standard', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_handhygiene_id, 'Vat hendene',              'Bruk rennende lunkent vann.',                                                                        1, true, 1),
    (v_proc_handhygiene_id, 'Pafor sape',               'Bruk antibakteriell sape fra dispenser.',                                                             2, true, 1),
    (v_proc_handhygiene_id, 'Skrubb i 20 sekunder',     'Vask mellom fingre, under negler, handledd. Tell til 20.',                                           3, true, 1),
    (v_proc_handhygiene_id, 'Skyll grundig',             'Hold hendene ned under rennende vann.',                                                               4, true, 1),
    (v_proc_handhygiene_id, 'Tork med papirhandkle',     'Bruk engangs papirhandkle. Bruk handkle til a sla av kran.',                                         5, true, 1);

  -- 6.8 Evakueringsrutine (Policy 6)
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_evakuering_id, v_prot_brannvern_id, 'Evakueringsrutine',
    'Prosedyre for evakuering ved brann eller annen nodssituasjon.', 'safety', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_evakuering_id, 'Oppdage brann/alarm',            'Ved brannalarm eller observasjon av brann: behold roen.',                                        1, true, 1),
    (v_proc_evakuering_id, 'Varsle',                          'Ring 110. Gi beskjed til kolleger. Bruk intern varsling.',                                       2, true, 1),
    (v_proc_evakuering_id, 'Evakuer gjester',                 'Led gjester mot naermeste romningsvei. Bruk rolig men bestemt tone.',                             3, true, 3),
    (v_proc_evakuering_id, 'Sjekk toaletter og bakrom',       'Kontroller at ingen er igjen i lokalet.',                                                        4, true, 2),
    (v_proc_evakuering_id, 'Moteplass',                       'Ga til avtalt moteplass. Gjennomfor opptelling.',                                                 5, true, 2);

  -- 6.9 Kassaoppgjor (Policy 7)
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_kassaoppgjor_id, v_prot_kassa_id, 'Kassaoppgjor',
    'Prosedyre for telling og avstemming av kasse.', 'standard', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_kassaoppgjor_id, 'Skriv ut Z-rapport',         'Skriv ut Z-rapport fra kassesystemet.',                                                             1, true, 1),
    (v_proc_kassaoppgjor_id, 'Tell kontanter',              'Tell alle sedler og mynter. Registrer belop.',                                                      2, true, 5),
    (v_proc_kassaoppgjor_id, 'Avstem mot rapport',          'Sammenlign kontantbeholdning med Z-rapport. Beregn differanse.',                                    3, true, 2),
    (v_proc_kassaoppgjor_id, 'Dokumenter',                  'Skriv ned belop, eventuelle avvik, og signer. Legg i safe.',                                        4, true, 2);

  -- 6.10 Varemottak og kontroll (Policy 8)
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_varemottak_id, v_prot_varemottak_id, 'Varemottak og kontroll',
    'Prosedyre for mottak og kontroll av vareleveranser.', 'standard', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_varemottak_id, 'Kontroller folgeseddel',     'Sammenlign folgeseddel med bestilling. Meld avvik.',                                                 1, true, 3),
    (v_proc_varemottak_id, 'Temperatursjekk',            'Mal kjernetemperatur pa kjolevarer med termometer.',                                                  2, true, 5),
    (v_proc_varemottak_id, 'Sjekk holdbarhet',           'Kontroller holdbarhetsdato pa alle varer.',                                                           3, true, 3),
    (v_proc_varemottak_id, 'Sjekk emballasje',           'Avvis varer med skadet, apen eller skitten emballasje.',                                              4, true, 2),
    (v_proc_varemottak_id, 'Plasser iht. FIFO',          'Sett nye varer bak gamle. Merk med mottaksdato.',                                                    5, true, 10);

  -- 6.11 Avviksmelding HMS (Policy 9)
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_hms_avvik_id, v_prot_hms_id, 'Avviksmelding HMS',
    'Prosedyre for rapportering av HMS-avvik og hendelser.', 'standard', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_hms_avvik_id, 'Dokumenter hendelsen',         'Skriv ned hva som skjedde, nar, hvor, og hvem som var involvert.',                                   1, true, 5),
    (v_proc_hms_avvik_id, 'Meld til naermeste leder',     'Informer skiftleder eller daglig leder umiddelbart.',                                                2, true, 1),
    (v_proc_hms_avvik_id, 'Forstehjelp ved behov',        'Gi forstehjelp. Ring 113 ved alvorlig skade.',                                                       3, true, NULL),
    (v_proc_hms_avvik_id, 'Fyll ut avviksskjema',         'Fyll ut digitalt avviksskjema i Smartout med alle detaljer.',                                         4, true, 5);

  -- 6.12 Alderskontroll ved skjenking (Policy 10)
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_alderskontroll_id, v_prot_skjenke_id, 'Alderskontroll ved skjenking',
    'Prosedyre for aldersverifisering ved servering av alkohol.', 'standard', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_alderskontroll_id, 'Vurder alder',                  'Gjesten ser under 25? Be om legitimasjon.',                                                    1, true, 1),
    (v_proc_alderskontroll_id, 'Kontroller legitimasjon',        'Godkjent: pass, forerkort, bankkort m/bilde. Sjekk fodselsdato og bilde.',                     2, true, 1),
    (v_proc_alderskontroll_id, 'Avvis ved manglende ID',         'Ingen gyldig ID = ingen alkohol. Vaer hoflig men bestemt.',                                    3, true, 1),
    (v_proc_alderskontroll_id, 'Vurder beruselse',               'Vis tegn pa overstadig berus? Nekt servering. Tilby vann/kaffe.',                              4, true, 1);

  ---------------------------------------------------------------------------
  -- 7. ROUTINES (4)
  ---------------------------------------------------------------------------

  -- 7.1 Temperatursjekk morgen
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_temperatur_id, v_proc_temp_daglig_id,
    'Temperatursjekk morgen',
    'scheduled',
    '{"times": ["08:00", "15:00"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_kitchen_id, 'every_time');

  -- 7.2 Apningssjekk
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_apning_id, v_proc_apning_kjokken_id,
    'Apningssjekk',
    'scheduled',
    '{"times": ["09:00"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_kitchen_id, 'every_time');

  -- 7.3 Lukkesjekk
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_stenging_id, v_proc_stenge_kjokken_id,
    'Lukkesjekk',
    'scheduled',
    '{"times": ["22:00"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_kitchen_id, 'every_time');

  -- 7.4 Kassaoppgjor kveld
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_kassa_id, v_proc_kassaoppgjor_id,
    'Kassaoppgjor kveld',
    'scheduled',
    '{"times": ["22:30"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_sal_id, 'every_time');

  ---------------------------------------------------------------------------
  -- 8. CONTROL LISTS (3)
  ---------------------------------------------------------------------------

  -- 8.1 Apningssjekkliste kjokken
  INSERT INTO public.control_list (protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_prot_apning_id,
    'Apningssjekkliste kjokken',
    'Sjekkliste for daglig apning av kjokkenavdelingen.',
    'team_leader', v_team_kitchen_id,
    '[
      {"label": "Ovner og komfyrer slatt pa", "required": true},
      {"label": "Frityrkoker slatt pa og temperatur OK", "required": true},
      {"label": "Kjoleskap temperatur kontrollert (0-4 grader C)", "required": true},
      {"label": "Fryser temperatur kontrollert (-18 grader C)", "required": true},
      {"label": "Mise en place ferdig", "required": true},
      {"label": "Varelager sjekket", "required": true},
      {"label": "Benker og utstyr rengjort", "required": true},
      {"label": "Handvask utfort", "required": true}
    ]'::jsonb);

  -- 8.2 Stengesjekkliste kjokken
  INSERT INTO public.control_list (protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_prot_stenging_id,
    'Stengesjekkliste kjokken',
    'Sjekkliste for daglig stenging av kjokkenavdelingen.',
    'team_leader', v_team_kitchen_id,
    '[
      {"label": "Alle arbeidsstasjoner rengjort", "required": true},
      {"label": "Restvarer merket og kjolt", "required": true},
      {"label": "Ovner og frityrkoker slatt av", "required": true},
      {"label": "Gulv feid og vasket", "required": true},
      {"label": "Soppel tomt og kildesortert", "required": true},
      {"label": "Kjoleskap og frysere lukket", "required": true},
      {"label": "Ventilasjon kjorer (15 min timer)", "required": false}
    ]'::jsonb);

  -- 8.3 Daglig temperaturlogg
  INSERT INTO public.control_list (protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_prot_temperatur_id,
    'Daglig temperaturlogg',
    'Logg for registrering av temperaturer i kjole- og fryseenheter.',
    'team_leader', v_team_kitchen_id,
    '[
      {"label": "Kjoleskap 1: temperatur registrert", "required": true},
      {"label": "Kjoleskap 2: temperatur registrert", "required": true},
      {"label": "Fryser 1: temperatur registrert", "required": true},
      {"label": "Fryser 2: temperatur registrert", "required": true},
      {"label": "Avvik meldt (hvis aktuelt)", "required": false}
    ]'::jsonb);

  ---------------------------------------------------------------------------
  -- 9. KNOWLEDGE TESTS (3)
  ---------------------------------------------------------------------------

  -- 9.1 Mattrygghet grunnkurs (pass_threshold: 80)
  INSERT INTO public.knowledge_test (protocol_id, name, description, pass_threshold, questions)
  VALUES (v_prot_temperatur_id,
    'Mattrygghet grunnkurs',
    'Grunnleggende kunnskapstest om mattrygghet og temperaturkontroll.',
    80,
    '[
      {
        "question": "Hva er godkjent temperaturomrade for kjoleskap i naeringsmiddelbedrifter?",
        "options": ["0-4 grader C", "2-8 grader C", "0-10 grader C", "-2 til 2 grader C"],
        "correct_index": 0
      },
      {
        "question": "Hva er maksimal temperatur for fryselagring?",
        "options": ["-10 grader C", "-15 grader C", "-18 grader C", "-24 grader C"],
        "correct_index": 2
      },
      {
        "question": "Hva er den viktigste arsaken til kryssforurensning pa kjokkenet?",
        "options": [
          "For hoyt varme pa ovnen",
          "Bruk av samme skjaerebrett for ratt kjott og gronnsaker uten vask mellom",
          "For mye salt i maten",
          "Apne vinduer i kjokkenet"
        ],
        "correct_index": 1
      },
      {
        "question": "Hva betyr FIFO-prinsippet?",
        "options": [
          "First In, First Out - eldste varer brukes forst",
          "Fast Inventory, Fast Output - rask omsetning",
          "Food Inspection, Food Organization - matinspeksjon",
          "Fresh Items, Frozen Order - ferske varer forst"
        ],
        "correct_index": 0
      },
      {
        "question": "Hvor mange allergener er det krav om a merke iht. EU-regelverket?",
        "options": ["10", "12", "14", "16"],
        "correct_index": 2
      },
      {
        "question": "Nar skal du vaske hendene pa kjokkenet?",
        "options": [
          "Bare ved arbeidsdagens start",
          "For og etter hvert malting",
          "Ved oppstart, etter toalettbesok, etter ratt kjott, mellom oppgaver",
          "Bare nar hendene er synlig skitne"
        ],
        "correct_index": 2
      },
      {
        "question": "Hva skal du gjore hvis du oppdager at kjoleskapet holder 8 grader C?",
        "options": [
          "Ingenting, det er innenfor grensen",
          "Melde avvik, vurdere om varer ma kastes, dokumentere tiltak",
          "Bare skru ned temperaturen og ga videre",
          "Kaste alt innholdet umiddelbart"
        ],
        "correct_index": 1
      },
      {
        "question": "Hvordan skal du handtere varer ved varemottak?",
        "options": [
          "Sette alt rett inn i lageret uten kontroll",
          "Kontrollere folgeseddel, temperatur, holdbarhet og emballasje",
          "Bare sjekke antall kolli mot bestillingen",
          "La varene sta til neste dag for kontroll"
        ],
        "correct_index": 1
      }
    ]'::jsonb);

  -- 9.2 Allergenbevissthet (pass_threshold: 80)
  INSERT INTO public.knowledge_test (protocol_id, name, description, pass_threshold, questions)
  VALUES (v_prot_allergen_id,
    'Allergenbevissthet',
    'Kunnskapstest om allergenhandtering og gjestekommunikasjon.',
    80,
    '[
      {
        "question": "Hvilke av folgende er blant de 14 EU-allergenene?",
        "options": [
          "Tomat, agurk, paprika",
          "Gluten, melk, egg, notter",
          "Ris, mais, poteter",
          "Olivenolje, smor, margarin"
        ],
        "correct_index": 1
      },
      {
        "question": "Hva skal du gjore nar en gjest sier de har en allergi?",
        "options": [
          "Si at de sikkert taler litt",
          "Sporre proaktivt og sjekke allergenlisten for bestilte retter",
          "Be gjesten selv sjekke menyen",
          "Si at kjokkenet ikke kan tilpasse retter"
        ],
        "correct_index": 1
      },
      {
        "question": "Hvordan skal retter med allergenvarsel tilberedes?",
        "options": [
          "Pa samme benk som andre retter",
          "Med eget utstyr og pa egen benk",
          "Av en annen kokk uten spesielle forholdsregler",
          "Det er ikke nodvendig med spesielle tiltak"
        ],
        "correct_index": 1
      },
      {
        "question": "Hvilken lov regulerer merking av allergener i Norge?",
        "options": [
          "Alkoholloven",
          "Arbeidsmiljoloven",
          "EU-forordning 1169/2011 (matinformasjonsforordningen)",
          "Plan- og bygningsloven"
        ],
        "correct_index": 2
      },
      {
        "question": "Hva er riktig handtering nar du er usikker pa allergeninnholdet i en rett?",
        "options": [
          "Si til gjesten at det sannsynligvis er trygt",
          "Sjekke med kjokkenet for bekrefte innholdet",
          "Servere retten uansett",
          "Be gjesten bestille noe annet uten a sjekke"
        ],
        "correct_index": 1
      },
      {
        "question": "Hvordan skal du kommunisere allergenvarsel til kjokkenet?",
        "options": [
          "Rope det over disken",
          "Merke bestillingen med allergenvarsel og bekrefte at kjokkenet har mottatt",
          "Anta at kjokkenet vet fra for",
          "Bare skrive det i en bok som sjekkes pa slutten av dagen"
        ],
        "correct_index": 1
      }
    ]'::jsonb);

  -- 9.3 Brannvern og evakuering (pass_threshold: 100)
  INSERT INTO public.knowledge_test (protocol_id, name, description, pass_threshold, questions)
  VALUES (v_prot_brannvern_id,
    'Brannvern og evakuering',
    'Kunnskapstest om brannvernrutiner og evakuering. Alle svar ma vaere riktige.',
    100,
    '[
      {
        "question": "Hvilket nodnummer ringer du ved brann?",
        "options": ["112", "110", "113", "114"],
        "correct_index": 1
      },
      {
        "question": "Hva er det forste du skal gjore ved brannalarm?",
        "options": [
          "Hente personlige eiendeler",
          "Fortsette arbeidet til du ser flamme",
          "Beholde roen og folge evakueringsrutinen",
          "Ringe daglig leder"
        ],
        "correct_index": 2
      },
      {
        "question": "Hvilke omrader MA sjekkes under evakuering?",
        "options": [
          "Bare spiseomradet",
          "Toaletter, bakrom og alle rom i lokalet",
          "Bare kjokkenet",
          "Bare omradene der det brenner"
        ],
        "correct_index": 1
      },
      {
        "question": "Hva gjor du pa moteplassen etter evakuering?",
        "options": [
          "Gar hjem",
          "Gjennomforer opptelling av ansatte og gjester",
          "Gar tilbake inn for a sjekke",
          "Ringer forsikringsselskapet"
        ],
        "correct_index": 1
      },
      {
        "question": "Hvordan skal dorer handteres ved brann?",
        "options": [
          "Apne alle dorer pa vidt gap",
          "Las alle dorer",
          "Lukke dorer etter deg for a begrense spredning, men IKKE lase",
          "Det spiller ingen rolle"
        ],
        "correct_index": 2
      }
    ]'::jsonb);

  ---------------------------------------------------------------------------
  -- 10. CONFIRMATIONS (2)
  ---------------------------------------------------------------------------

  -- 10.1 Apning gjennomfort
  INSERT INTO public.confirmation (protocol_id, name, confirmation_text, requires_signature)
  VALUES (v_prot_apning_id,
    'Apning gjennomfort',
    'Jeg bekrefter at apningsrutinen er fullstendig gjennomfort og alle sjekkpunkter er godkjent.',
    true);

  -- 10.2 Stenging gjennomfort
  INSERT INTO public.confirmation (protocol_id, name, confirmation_text, requires_signature)
  VALUES (v_prot_stenging_id,
    'Stenging gjennomfort',
    'Jeg bekrefter at stengerutinen er fullstendig gjennomfort, kasse er avstemt, og lokalet er sikret.',
    true);

END;
$$;

-- Grant execute to authenticated users (RLS on underlying tables handles access control)
GRANT EXECUTE ON FUNCTION template_restaurant_governance(uuid) TO authenticated;
