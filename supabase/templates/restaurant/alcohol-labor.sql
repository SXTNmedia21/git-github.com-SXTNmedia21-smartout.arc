-- Template: Restaurant Alcohol Handling & Labor Law Compliance
-- Industry:   restaurant (NACE 56.101)
-- Creates:    3 policies, 3 protocols, 10 procedures with steps,
--             6 routines, 4 control lists, 2 knowledge tests
-- References: Alkoholloven, Helsedirektoratet internkontroll alkohol,
--             Arbeidsmiljoloven kap. 10 (arbeidstid, overtid, nattarbeid)
-- Depends:    departments.sql (for team lookups), governance.sql (teams)
-- Usage:      SELECT template_restaurant_alcohol_labor(p_workspace_id);

CREATE OR REPLACE FUNCTION template_restaurant_alcohol_labor(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  -- Admin profile
  v_admin_id uuid;
  v_season_id uuid;

  -- Team IDs
  v_team_sal_id uuid;
  v_team_bar_id uuid;
  v_team_ledelse_id uuid;

  -- Policy IDs (3)
  v_pol_skjenke_id uuid;
  v_pol_nattarbeid_id uuid;
  v_pol_overtid_id uuid;

  -- Protocol IDs (3, 1:1 with policies)
  v_prot_skjenke_id uuid;
  v_prot_nattarbeid_id uuid;
  v_prot_overtid_id uuid;

  -- Procedure IDs (10)
  -- Policy 1: Skjenkekontroll (5 procedures)
  v_proc_alderskontroll_id uuid;
  v_proc_beruselse_id uuid;
  v_proc_skjenketid_id uuid;
  v_proc_internkontroll_alk_id uuid;
  v_proc_ansvarlig_vertskap_id uuid;
  -- Policy 2: Nattarbeid (3 procedures)
  v_proc_nattarbeid_id uuid;
  v_proc_mindrearige_id uuid;
  v_proc_verneombud_id uuid;
  -- Policy 3: Overtid (2 procedures)
  v_proc_overtidsreg_id uuid;
  v_proc_overtidsrapport_id uuid;

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
  -- 1. Look up teams by slug
  ---------------------------------------------------------------------------
  SELECT team_id INTO v_team_sal_id
    FROM public.team
   WHERE workspace_id = p_workspace_id AND slug = 'salteam'
   LIMIT 1;

  SELECT team_id INTO v_team_bar_id
    FROM public.team
   WHERE workspace_id = p_workspace_id AND slug = 'barteam'
   LIMIT 1;

  SELECT team_id INTO v_team_ledelse_id
    FROM public.team
   WHERE workspace_id = p_workspace_id AND slug = 'ledelsesteam'
   LIMIT 1;

  ---------------------------------------------------------------------------
  -- 2. Generate IDs for all governance objects
  ---------------------------------------------------------------------------
  v_pol_skjenke_id          := gen_random_uuid();
  v_pol_nattarbeid_id       := gen_random_uuid();
  v_pol_overtid_id          := gen_random_uuid();

  v_prot_skjenke_id         := gen_random_uuid();
  v_prot_nattarbeid_id      := gen_random_uuid();
  v_prot_overtid_id         := gen_random_uuid();

  v_proc_alderskontroll_id  := gen_random_uuid();
  v_proc_beruselse_id       := gen_random_uuid();
  v_proc_skjenketid_id      := gen_random_uuid();
  v_proc_internkontroll_alk_id := gen_random_uuid();
  v_proc_ansvarlig_vertskap_id := gen_random_uuid();
  v_proc_nattarbeid_id      := gen_random_uuid();
  v_proc_mindrearige_id     := gen_random_uuid();
  v_proc_verneombud_id      := gen_random_uuid();
  v_proc_overtidsreg_id     := gen_random_uuid();
  v_proc_overtidsrapport_id := gen_random_uuid();

  ---------------------------------------------------------------------------
  -- 3. POLICIES (3)
  ---------------------------------------------------------------------------

  -- Policy 1: Skjenkekontroll og alkoholhandtering
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_skjenke_id, p_workspace_id, v_season_id, 'operational', 'workspace',
    'Skjenkekontroll og alkoholhandtering',
    'Policy for skjenkebevilling, alderskontroll, beruselsesvurdering og internkontroll etter alkoholloven.',
    'Virksomheten skal ha gyldig skjenkebevilling og utpekt styrer og stedfortreder med bestatt kunnskapsprove. Alderskontroll skal gjennomfores ved enhver tvil. Overstadig berusede personer nektes servering. Skjenketider folger kommunale bestemmelser. Internkontroll etter alkoholloven skal dokumenteres.',
    'enforced', v_admin_id)
  ON CONFLICT DO NOTHING;

  -- Policy 2: Nattarbeid og arbeidstid
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_nattarbeid_id, p_workspace_id, v_season_id, 'hr', 'workspace',
    'Nattarbeid og arbeidstid',
    'Policy for nattarbeid, arbeidstidsbegrensninger og helsekontroll iht. Arbeidsmiljoloven kap. 10.',
    'Nattarbeid (21:00-06:00) er kun tillatt nar arbeidets art gjor det nodvendig. Arbeidstaker som regelmessig arbeider natt skal tilbys helsekontroll. Gjennomsnittlig arbeidstid for nattarbeidere skal ikke overstige 8 timer per 24 timer beregnet over 4 uker. Ansatte under 18 ar skal ikke arbeide etter kl. 23:00.',
    'enforced', v_admin_id)
  ON CONFLICT DO NOTHING;

  -- Policy 3: Overtid og merarbeid
  INSERT INTO public.policy (policy_id, workspace_id, season_id, policy_type, policy_scope, name, description, statement, enforcement_status, created_by)
  VALUES (v_pol_overtid_id, p_workspace_id, v_season_id, 'hr', 'workspace',
    'Overtid og merarbeid',
    'Policy for overtidsregistrering, grenser og tillegg iht. Arbeidsmiljoloven paragraf 10-6.',
    'Overtidsarbeid skal kun utfores ved saerlig og tidsavgrenset behov. Grenser: maks 10 timer per 7 dager, 25 timer per 4 uker, 200 timer per 52 uker. Samlet arbeidstid inkl. overtid maks 13 timer per 24 timer, 48 timer per 7 dager snitt over 8 uker. Overtidstillegg minimum 40%.',
    'enforced', v_admin_id)
  ON CONFLICT DO NOTHING;

  ---------------------------------------------------------------------------
  -- 4. PROTOCOLS (3, one per policy)
  ---------------------------------------------------------------------------

  INSERT INTO public.protocol (protocol_id, policy_id, workspace_id, name, description, status, owner_profile_id, created_by)
  VALUES
    (v_prot_skjenke_id,    v_pol_skjenke_id,    p_workspace_id, 'Skjenkekontroll-protokoll',    'Protokoll for alderskontroll, beruselsesvurdering og internkontroll alkohol.',  'active', v_admin_id, v_admin_id),
    (v_prot_nattarbeid_id, v_pol_nattarbeid_id, p_workspace_id, 'Nattarbeid-protokoll',          'Protokoll for nattarbeid, arbeidstid og mindrearige.',                          'active', v_admin_id, v_admin_id),
    (v_prot_overtid_id,    v_pol_overtid_id,    p_workspace_id, 'Overtid-protokoll',             'Protokoll for overtidsregistrering, godkjenning og rapportering.',             'active', v_admin_id, v_admin_id);

  ---------------------------------------------------------------------------
  -- 5. PROCEDURES (10) with steps
  ---------------------------------------------------------------------------

  -- =========================================================================
  -- Policy 1: Skjenkekontroll og alkoholhandtering (5 procedures)
  -- Ref: Alkoholloven §1-4, §4-1, §8-11, Helsedirektoratet guide
  -- =========================================================================

  -- 5.1 Alderskontroll ved servering
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_alderskontroll_id, v_prot_skjenke_id,
    'Alderskontroll ved servering',
    'Prosedyre for aldersverifisering ved servering av alkohol iht. Alkoholloven.',
    'standard', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_alderskontroll_id, 'Vurder alder',                   'Gjesten ser under 25? Be om ID.',                                                                                  1, true, 1),
    (v_proc_alderskontroll_id, 'Sjekk godkjent ID',              'Godkjent ID: pass, forerkort, bankkort med bilde.',                                                                2, true, 1),
    (v_proc_alderskontroll_id, 'Verifiser fodselsdato og bilde',  'Sjekk at fodselsdato gir riktig alder og at bilde matcher gjesten.',                                               3, true, 1),
    (v_proc_alderskontroll_id, 'Avvis ved manglende eller ugyldig ID', 'Ingen gyldig ID = ingen alkohol. Vaer hoflig men bestemt.',                                                   4, true, 1),
    (v_proc_alderskontroll_id, 'Opptre hoflig men bestemt',       'Forklar reglene rolig. Tilby alkoholfrie alternativer.',                                                           5, true, 1);

  -- 5.2 Beruselsesvurdering
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_beruselse_id, v_prot_skjenke_id,
    'Beruselsesvurdering',
    'Prosedyre for vurdering av beruselsesgrad og handtering iht. Alkoholloven paragraf 8-11.',
    'standard', 2);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_beruselse_id, 'Observer gjestens oppforsel',              'Se etter tegn: usto gang, uklar tale, aggressiv atferd, sovnig.',                                             1, true, 1),
    (v_proc_beruselse_id, 'Grader beruselse',                         'Litt beruset (OK a servere), tydelig beruset (stopp servering), overstadig beruset (nekt servering, tilby vann).', 2, true, 1),
    (v_proc_beruselse_id, 'Dokumenter avslag',                        'Dokumenter tidspunkt og begrunnelse for eventuelt avslag.',                                                     3, true, 2),
    (v_proc_beruselse_id, 'Informer skiftleder ved hendelser',        'Gi beskjed til skiftleder om alle hendelser knyttet til beruselse.',                                           4, true, 1),
    (v_proc_beruselse_id, 'Folg opp gjesten pa en verdig mate',       'Tilby vann, kaffe eller mat. Sorg for trygg hjemreise om nodvendig.',                                          5, true, 2);

  -- 5.3 Skjenketidskontroll
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_skjenketid_id, v_prot_skjenke_id,
    'Skjenketidskontroll',
    'Prosedyre for overholdelse av kommunale skjenketider.',
    'standard', 3);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_skjenketid_id, 'Sjekk kommunale skjenketider',            'Typisk: ol/vin til 01:00, brennevin til 00:00. Sjekk lokale bestemmelser.',                                    1, true, 1),
    (v_proc_skjenketid_id, 'Last call 30 min for stenging',           'Annonser siste bestilling 30 minutter for skjenketid utloper.',                                                 2, true, 1),
    (v_proc_skjenketid_id, 'Stopp servering pa klokkeslett',          'Stopp all alkoholservering nar skjenketiden utloper.',                                                           3, true, 1),
    (v_proc_skjenketid_id, 'Fjern alkohol fra bord',                   'Fjern alle alkoholholdige drikkevarer fra bord innen 30 min etter stengetid.',                                 4, true, 5),
    (v_proc_skjenketid_id, 'Dokumenter forlengelse',                   'Dokumenter eventuell forlengelse ved spesielle bevillinger.',                                                   5, true, 2);

  -- 5.4 Internkontroll alkohol - manedsgjennomgang
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_internkontroll_alk_id, v_prot_skjenke_id,
    'Internkontroll alkohol - manedsgjennomgang',
    'Prosedyre for manedlig gjennomgang av internkontroll etter alkoholloven.',
    'standard', 4);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_internkontroll_alk_id, 'Sjekk at bevilling er gyldig',           'Kontroller at skjenkebevilling er gyldig og oppdatert.',                                                1, true, 2),
    (v_proc_internkontroll_alk_id, 'Verifiser styrer/stedfortreder',          'Verifiser at styrer og stedfortreder er tilgjengelig og godkjent.',                                     2, true, 2),
    (v_proc_internkontroll_alk_id, 'Gjennomga avviksmeldinger',               'Gjennomga alle avviksmeldinger fra siste maned.',                                                       3, true, 10),
    (v_proc_internkontroll_alk_id, 'Kontroller opplaering',                    'Kontroller at alle ansatte har dokumentert opplaering.',                                                4, true, 5),
    (v_proc_internkontroll_alk_id, 'Oppdater rutiner ved regelendringer',      'Sjekk og oppdater rutiner ved endringer i regelverk.',                                                  5, true, 5);

  -- 5.5 Opplaering ansvarlig vertskap
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_ansvarlig_vertskap_id, v_prot_skjenke_id,
    'Opplaering ansvarlig vertskap',
    'Prosedyre for opplaering i ansvarlig vertskap og alkoholloven.',
    'standard', 5);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_ansvarlig_vertskap_id, 'Gjennomfor Ansvarlig Vertskap e-laering', 'Fullfar Ansvarlig Vertskap e-laeringskurs.',                                                            1, true, 60),
    (v_proc_ansvarlig_vertskap_id, 'Besta intern kunnskapstest (80%)',        'Gjennomfor og besta intern kunnskapstest med minimum 80% riktig.',                                       2, true, 20),
    (v_proc_ansvarlig_vertskap_id, 'Kjenn alkoholloven hovedkrav',            'Gjennomga alkohollovens viktigste bestemmelser for serveringssteder.',                                   3, true, 15),
    (v_proc_ansvarlig_vertskap_id, 'Ovelsessituasjoner',                      'Ovelsesoving: alderskontroll, beruselsesvurdering, nektelse av servering.',                              4, true, 20),
    (v_proc_ansvarlig_vertskap_id, 'Signer bekreftelse',                      'Signer bekreftelse pa gjennomfort opplaering i ansvarlig vertskap.',                                    5, true, 2);

  -- =========================================================================
  -- Policy 2: Nattarbeid og arbeidstid (3 procedures)
  -- Ref: Arbeidsmiljoloven §10-11 (nattarbeid), §10-2 (arbeidstid), Riksavtalen
  -- =========================================================================

  -- 5.6 Nattarbeid - vurdering og godkjenning
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_nattarbeid_id, v_prot_nattarbeid_id,
    'Nattarbeid - vurdering og godkjenning',
    'Prosedyre for vurdering, godkjenning og oppfolging av nattarbeid iht. Arbeidsmiljoloven paragraf 10-11.',
    'standard', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_nattarbeid_id, 'Identifiser roller som krever nattarbeid',    'Bartendere, renhold, kokker fredager/lordager - kartlegg hvem som arbeider natt.',                          1, true, 5),
    (v_proc_nattarbeid_id, 'Verifiser at ansatt er over 18',              'Sjekk at alle som jobber natt er over 18 ar.',                                                               2, true, 2),
    (v_proc_nattarbeid_id, 'Tilby helsekontroll',                          'Tilby helsekontroll for tiltredelse til nattarbeid.',                                                       3, true, 5),
    (v_proc_nattarbeid_id, 'Dokumenter samtykke',                          'Dokumenter ansattes samtykke til nattarbeid.',                                                               4, true, 2),
    (v_proc_nattarbeid_id, 'Overvak gjennomsnittlig arbeidstid',           'Kontroller at gjennomsnittlig arbeidstid ikke overstiger 8t/24t over 4 uker.',                             5, true, 5),
    (v_proc_nattarbeid_id, 'Arlig helsekontroll',                          'Gjennomfor arlig helsekontroll for alle nattarbeidere.',                                                    6, true, 5);

  -- 5.7 Mindrearige - arbeidstidsbegrensninger
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_mindrearige_id, v_prot_nattarbeid_id,
    'Mindrearige - arbeidstidsbegrensninger',
    'Prosedyre for overholdelse av arbeidstidsbegrensninger for ansatte under 18 ar.',
    'standard', 2);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_mindrearige_id, 'Sjekk arbeidstid etter kl. 23:00',          'Kontroller at ansatt under 18 ikke arbeider etter kl. 23:00.',                                               1, true, 2),
    (v_proc_mindrearige_id, 'Maks 8 timer per dag, 40 timer per uke',     'Verifiser at daglig og ukentlig arbeidstid overholdes.',                                                     2, true, 2),
    (v_proc_mindrearige_id, 'Ikke nattarbeid mellom 23:00-06:00',          'Kontroller at ingen mindrearige har vakter mellom 23:00-06:00.',                                            3, true, 2),
    (v_proc_mindrearige_id, 'Minimum 12 timer hvile mellom okter',         'Sjekk at det er minimum 12 timer sammenhengende hvile mellom arbeidsokter.',                                4, true, 2),
    (v_proc_mindrearige_id, 'Dokumenter i vaktlisten',                      'Dokumenter alle begrensninger i vaktlisten.',                                                               5, true, 2),
    (v_proc_mindrearige_id, 'Varsle verneombud ved avvik',                  'Meld avvik til verneombud umiddelbart.',                                                                    6, true, 1);

  -- 5.8 Verneombud og HMS-runde
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_verneombud_id, v_prot_nattarbeid_id,
    'Verneombud og HMS-runde',
    'Prosedyre for ukentlig gjennomgang av arbeidstid, hviletid og overtid.',
    'standard', 3);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_verneombud_id, 'Gjennomga arbeidstidsregistreringer',         'Ukentlig gjennomgang av alle ansattes arbeidstidsregistreringer.',                                           1, true, 15),
    (v_proc_verneombud_id, 'Sjekk hviletid',                               'Kontroller at hviletid overholdes (11 timer mellom okter).',                                               2, true, 5),
    (v_proc_verneombud_id, 'Kontroller overtidsbruk',                       'Sjekk overtidsbruk mot lovens grenser.',                                                                   3, true, 5),
    (v_proc_verneombud_id, 'Meld avvik til daglig leder',                   'Rapporter alle avvik til daglig leder.',                                                                   4, true, 2),
    (v_proc_verneombud_id, 'Dokumenter i HMS-logg',                         'For alle funn inn i HMS-loggen.',                                                                          5, true, 3);

  -- =========================================================================
  -- Policy 3: Overtid og merarbeid (2 procedures)
  -- Ref: Arbeidsmiljoloven §10-6 (overtid), §10-6(11) (tillegg)
  -- =========================================================================

  -- 5.9 Overtidsregistrering og godkjenning
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_overtidsreg_id, v_prot_overtid_id,
    'Overtidsregistrering og godkjenning',
    'Prosedyre for registrering og godkjenning av overtid iht. Arbeidsmiljoloven paragraf 10-6.',
    'standard', 1);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_overtidsreg_id, 'Identifiser behov for overtid',              'Behovet ma vaere saerlig og tidsavgrenset.',                                                                 1, true, 2),
    (v_proc_overtidsreg_id, 'Fa godkjenning fra leder',                    'Fa godkjenning fra leder for tiltredelse av overtidsarbeid.',                                               2, true, 2),
    (v_proc_overtidsreg_id, 'Registrer overtidstimer i timeliste',         'Registrer alle overtidstimer i timelisten.',                                                                 3, true, 2),
    (v_proc_overtidsreg_id, 'Beregn mot lovens grenser',                    'Sjekk mot grensene: maks 10t/uke, 25t/4 uker, 200t/ar.',                                                  4, true, 3),
    (v_proc_overtidsreg_id, 'Beregn overtidstillegg minimum 40%',          'Beregn overtidstillegg pa minimum 40% av avtalt timelonn.',                                                 5, true, 2),
    (v_proc_overtidsreg_id, 'Varsle tillitsvalgt',                          'Varsle tillitsvalgt ved systematisk overtidsbruk.',                                                         6, true, 1);

  -- 5.10 Overtidsrapport - manedsgjennomgang
  INSERT INTO public.procedure (procedure_id, protocol_id, name, description, procedure_type, sort_order)
  VALUES (v_proc_overtidsrapport_id, v_prot_overtid_id,
    'Overtidsrapport - manedsgjennomgang',
    'Prosedyre for manedlig gjennomgang og rapportering av overtidsbruk.',
    'standard', 2);

  INSERT INTO public.procedure_step (procedure_id, title, description, step_order, is_required, estimated_minutes) VALUES
    (v_proc_overtidsrapport_id, 'Trekk rapport over overtidstimer',        'Hent rapport over alle ansattes overtidstimer siste maned.',                                                1, true, 5),
    (v_proc_overtidsrapport_id, 'Sjekk mot lovens grenser',                 'Kontroller mot grensene: 10t/uke, 25t/4 uker, 200t/ar.',                                                  2, true, 5),
    (v_proc_overtidsrapport_id, 'Identifiser ansatte naer grensen',         'Finn ansatte som naermer seg overtidsgrensene.',                                                           3, true, 3),
    (v_proc_overtidsrapport_id, 'Planlegg forebyggende tiltak',             'Planlegg tiltak: vikar, vaktbytte, fordeling av arbeidsmengde.',                                           4, true, 5),
    (v_proc_overtidsrapport_id, 'Dokumenter i HMS-system',                  'Dokumenter funn og tiltak i HMS-systemet.',                                                                 5, true, 3),
    (v_proc_overtidsrapport_id, 'Informer verneombud',                      'Informer verneombud om overtidssituasjonen.',                                                               6, true, 2);

  ---------------------------------------------------------------------------
  -- 6. ROUTINES (6)
  ---------------------------------------------------------------------------

  -- 6.1 Alderskontroll sjekk (event-triggered, every_nth: 10)
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency, control_nth)
  VALUES (v_prot_skjenke_id, v_proc_alderskontroll_id,
    'Alderskontroll sjekk',
    'event',
    '{"event": "on_alcohol_order", "description": "Utfores ved alkoholbestilling"}'::jsonb,
    'team', v_team_bar_id, 'every_nth', 10);

  -- 6.2 Beruselsesvurdering kveld (Fri+Sat 22:00)
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_skjenke_id, v_proc_beruselse_id,
    'Beruselsesvurdering kveld',
    'scheduled',
    '{"times": ["22:00"], "days": ["fri","sat"]}'::jsonb,
    'team', v_team_bar_id, 'every_time');

  -- 6.3 Skjenketidskontroll (daily 00:30)
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_skjenke_id, v_proc_skjenketid_id,
    'Skjenketidskontroll',
    'scheduled',
    '{"times": ["00:30"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_bar_id, 'every_time');

  -- 6.4 Arbeidstidskontroll uke (Monday 09:00)
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_nattarbeid_id, v_proc_verneombud_id,
    'Arbeidstidskontroll uke',
    'scheduled',
    '{"times": ["09:00"], "days": ["mon"]}'::jsonb,
    'team', v_team_ledelse_id, 'every_time');

  -- 6.5 Mindrearig vaktsjekk (daily 09:00, ledelsesteam)
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_nattarbeid_id, v_proc_mindrearige_id,
    'Mindrearig vaktsjekk',
    'scheduled',
    '{"times": ["09:00"], "days": ["mon","tue","wed","thu","fri","sat","sun"]}'::jsonb,
    'team', v_team_ledelse_id, 'every_time');

  -- 6.6 Overtidsrapport manedlig (first Monday of month, 09:00)
  INSERT INTO public.routine (protocol_id, procedure_id, name, trigger_type, trigger_config, assigned_to_type, assigned_to_ref, control_frequency)
  VALUES (v_prot_overtid_id, v_proc_overtidsrapport_id,
    'Overtidsrapport manedlig',
    'scheduled',
    '{"times": ["09:00"], "days": ["mon"], "week_of_month": 1}'::jsonb,
    'team', v_team_ledelse_id, 'every_time');

  ---------------------------------------------------------------------------
  -- 7. CONTROL LISTS (4)
  ---------------------------------------------------------------------------

  -- 7.1 Daglig alkoholkontroll
  INSERT INTO public.control_list (protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_prot_skjenke_id,
    'Daglig alkoholkontroll',
    'Daglig sjekkliste for alkoholhandtering og skjenkekontroll.',
    'team_leader', v_team_bar_id,
    '[
      {"label": "Bevilling synlig oppslatt?", "required": true},
      {"label": "Styrer/stedfortreder pa jobb?", "required": true},
      {"label": "Alle bak bar over 18 (ol/vin) / 20 (brennevin)?", "required": true},
      {"label": "ID-sjekk gjennomfort pa alle under 25?", "required": true},
      {"label": "Skjenketider overholdt?", "required": true},
      {"label": "Eventuelle avslag dokumentert?", "required": false}
    ]'::jsonb);

  -- 7.2 Manedlig alkohol-internkontroll
  INSERT INTO public.control_list (protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_prot_skjenke_id,
    'Manedlig alkohol-internkontroll',
    'Manedlig sjekkliste for internkontroll etter alkoholloven.',
    'team_leader', v_team_ledelse_id,
    '[
      {"label": "Skjenkebevilling gyldig?", "required": true},
      {"label": "Styrer bestatt kunnskapsprove?", "required": true},
      {"label": "Stedfortreder bestatt kunnskapsprove?", "required": true},
      {"label": "Alle ansatte har gjennomfort Ansvarlig Vertskap?", "required": true},
      {"label": "Avviksmeldinger gjennomgatt?", "required": true},
      {"label": "Kommunale endringer sjekket?", "required": true}
    ]'::jsonb);

  -- 7.3 Ukentlig arbeidstidskontroll
  INSERT INTO public.control_list (protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_prot_nattarbeid_id,
    'Ukentlig arbeidstidskontroll',
    'Ukentlig sjekkliste for kontroll av arbeidstid, hviletid og nattarbeid.',
    'team_leader', v_team_ledelse_id,
    '[
      {"label": "Alle okter under 10 timer?", "required": true},
      {"label": "Hviletid minimum 11 timer mellom okter?", "required": true},
      {"label": "Mindrearige ikke etter 23:00?", "required": true},
      {"label": "Nattarbeidere under 8t snitt/24t?", "required": true},
      {"label": "Overtid rapportert korrekt?", "required": true},
      {"label": "Verneombud informert om avvik?", "required": false}
    ]'::jsonb);

  -- 7.4 Manedlig overtidskontroll
  INSERT INTO public.control_list (protocol_id, name, description, assigned_to_type, assigned_to_ref, items)
  VALUES (v_prot_overtid_id,
    'Manedlig overtidskontroll',
    'Manedlig sjekkliste for kontroll av overtidsbruk mot lovens grenser.',
    'team_leader', v_team_ledelse_id,
    '[
      {"label": "Alle ansatte under 10t/uke?", "required": true},
      {"label": "Alle under 25t/4 uker?", "required": true},
      {"label": "Arlig overtid under 200t?", "required": true},
      {"label": "40% tillegg beregnet korrekt?", "required": true},
      {"label": "Saerlig behov dokumentert?", "required": true},
      {"label": "Tillitsvalgt informert?", "required": true}
    ]'::jsonb);

  ---------------------------------------------------------------------------
  -- 8. KNOWLEDGE TESTS (2)
  ---------------------------------------------------------------------------

  -- 8.1 Alkoholloven og ansvarlig vertskap (pass: 80%, 8 questions)
  INSERT INTO public.knowledge_test (protocol_id, name, description, pass_threshold, questions)
  VALUES (v_prot_skjenke_id,
    'Alkoholloven og ansvarlig vertskap',
    'Kunnskapstest om alkoholloven, alderskontroll, beruselsesvurdering og internkontroll.',
    80,
    '[
      {
        "question": "Hva er aldersgrense for a bli servert ol/vin?",
        "options": ["16 ar", "18 ar", "20 ar", "21 ar"],
        "correct_index": 1
      },
      {
        "question": "Hva er aldersgrense for brennevin?",
        "options": ["18 ar", "20 ar", "21 ar", "25 ar"],
        "correct_index": 1
      },
      {
        "question": "Hvilke ID er godkjent for alderskontroll?",
        "options": [
          "Kun pass",
          "Pass, forerkort, bankkort med bilde",
          "Studentbevis og bankkort",
          "Alle typer ID med bilde"
        ],
        "correct_index": 1
      },
      {
        "question": "Hva gjor du ved overstadig beruselse?",
        "options": [
          "Serverer en siste drink",
          "Nekt servering iht. paragraf 8-11",
          "Ringer politiet umiddelbart",
          "Ignorerer det"
        ],
        "correct_index": 1
      },
      {
        "question": "Hva er typisk skjenketid for brennevin?",
        "options": [
          "Til kl. 02:00",
          "Til kl. 01:00",
          "Til kl. 00:00",
          "Til kl. 23:00"
        ],
        "correct_index": 2
      },
      {
        "question": "Hvem er ansvarlig for at alkoholloven folges pa stedet?",
        "options": [
          "Bartenderne",
          "Styrer og stedfortreder",
          "Alle ansatte likt",
          "Kommunen"
        ],
        "correct_index": 1
      },
      {
        "question": "Hva kreves for a vaere styrer?",
        "options": [
          "Minimum 2 ars erfaring",
          "Bestatt kunnskapsprove, over 20 ar, vandel",
          "Kun a vaere daglig leder",
          "Bestatt hygienekurs"
        ],
        "correct_index": 1
      },
      {
        "question": "Hva er internkontroll etter alkoholloven?",
        "options": [
          "Arsregnskap for alkoholsalg",
          "Systematisk overvaking av etterlevelse",
          "Telling av flasker daglig",
          "Rapportering til Vinmonopolet"
        ],
        "correct_index": 1
      }
    ]'::jsonb);

  -- 8.2 Arbeidstid og nattarbeid (pass: 75%, 6 questions)
  INSERT INTO public.knowledge_test (protocol_id, name, description, pass_threshold, questions)
  VALUES (v_prot_nattarbeid_id,
    'Arbeidstid og nattarbeid',
    'Kunnskapstest om arbeidstidsregler, nattarbeid og mindrearige iht. Arbeidsmiljoloven.',
    75,
    '[
      {
        "question": "Hva defineres som nattarbeid?",
        "options": [
          "Arbeid mellom 22:00-05:00",
          "Arbeid mellom 21:00-06:00",
          "Arbeid mellom 00:00-06:00",
          "Arbeid mellom 20:00-08:00"
        ],
        "correct_index": 1
      },
      {
        "question": "Maks gjennomsnittlig arbeidstid for nattarbeidere?",
        "options": [
          "10 timer/24 timer over 4 uker",
          "8 timer/24 timer over 4 uker",
          "12 timer/24 timer over 4 uker",
          "8 timer/24 timer over 8 uker"
        ],
        "correct_index": 1
      },
      {
        "question": "Nar ma mindrearige senest arbeide?",
        "options": [
          "Kl. 21:00",
          "Kl. 22:00",
          "Kl. 23:00",
          "Kl. 00:00"
        ],
        "correct_index": 2
      },
      {
        "question": "Hva er minimum hviletid mellom okter?",
        "options": [
          "8 timer",
          "10 timer",
          "11 timer",
          "12 timer"
        ],
        "correct_index": 2
      },
      {
        "question": "Har nattarbeidere rett pa helsekontroll?",
        "options": [
          "Nei, bare ved skade",
          "Ja, for tiltredelse og jevnlig",
          "Kun ved forespursel",
          "Bare det forste aret"
        ],
        "correct_index": 1
      },
      {
        "question": "Kan arbeidsgiver palegge nattarbeid fritt?",
        "options": [
          "Ja, nar som helst",
          "Ja, med 24 timers varsel",
          "Nei, kun nar arbeidets art gjor det nodvendig",
          "Nei, det er alltid frivillig"
        ],
        "correct_index": 2
      }
    ]'::jsonb);

END;
$$;

-- Grant execute to authenticated users (RLS on underlying tables handles access control)
GRANT EXECUTE ON FUNCTION template_restaurant_alcohol_labor(uuid) TO authenticated;
