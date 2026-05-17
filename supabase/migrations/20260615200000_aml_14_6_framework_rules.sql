-- ============================================
-- 20260615200000_aml_14_6_framework_rules.sql
-- K1a: Seed AML §14-6 (post-July 2024 revision) 17-bokstav rules
-- into the platform-level hospitality.no.default.v1 framework.
-- ADR-0310: rule-table-driven AML validation (see PLAN-contracts-compliance-cluster.md §1).
-- ============================================
-- Why: SMA-306 — validate_aml_14_6 tool reads these rows instead of
--      hardcoded TS logic. 17 bokstaver (a–q) per post-2024 lov-revisjon.
--      Bokstav m (vaktendringer §10-3) is required_when hospitality+rotation.
--      Bokstav p (kompetanseutvikling) is optional per lovtekst.
-- Pattern: matches 20260424100000_seed_hospitality_framework.sql:56-122.
-- ============================================

SET search_path TO public, extensions;

DO $$
DECLARE
  fwk_id UUID;
BEGIN
  SELECT framework_id INTO fwk_id
  FROM regulatory_framework
  WHERE code = 'hospitality.no.default.v1';

  IF fwk_id IS NULL THEN
    RAISE EXCEPTION 'hospitality.no.default.v1 framework not found — run 20260424100000 first';
  END IF;

  -- ── AML §14-6 bokstav a–q — ansettelsesavtalens innhold ────────────────────
  -- All rules at code LIKE 'aml.14_6.%' for K1a platform-level statute.
  -- validate_aml_14_6 tool loads these by framework_id + code pattern.
  -- ON CONFLICT DO NOTHING = idempotent seed (safe to re-apply).

  INSERT INTO framework_rule (
    framework_id, code, rule_type, category,
    description, description_no,
    default_outcome, severity,
    outcome_overridable, evaluation_config, source_reference
  ) VALUES

  -- a: Partenes identitet — identifikasjon av arbeidsgiver og arbeidstaker
  (fwk_id, 'aml.14_6.a', 'gate', 'contract_content',
   'Parties identity — employer and employee must be identified in contract',
   'Partenes identitet — arbeidsgiver og arbeidstaker skal identifiseres i kontrakten',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'a',
     'field', 'workspace_id',
     'required', true,
     'description_no', 'Partenes navn og adresse (arbeidsgiver og arbeidstaker) må fremgå av kontrakten'
   ),
   'Arbeidsmiljoloven §14-6 bokstav a'),

  -- b: Arbeidsplassen — stedet for utforelse av arbeidet
  (fwk_id, 'aml.14_6.b', 'gate', 'contract_content',
   'Workplace — the place where work is performed must be stated',
   'Arbeidsplassen — stedet der arbeidet skal utfores ma fremga av kontrakten',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'b',
     'field', 'location_id',
     'required', true,
     'description_no', 'Arbeidssted eller avdeling der den ansatte normalt skal arbeide'
   ),
   'Arbeidsmiljoloven §14-6 bokstav b'),

  -- c: Arbeid/tittel/stilling — beskrivelse av arbeid eller stillingstittel
  (fwk_id, 'aml.14_6.c', 'gate', 'contract_content',
   'Work description or job title must be stated in the contract',
   'Beskrivelse av arbeidet eller stillingstittel ma fremga av kontrakten',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'c',
     'field', 'position_title',
     'required', true,
     'description_no', 'Stillingstittel eller beskrivelse av arbeidet'
   ),
   'Arbeidsmiljoloven §14-6 bokstav c'),

  -- d: Arbeidsforholdets begynnelse — tiltredelsdato
  (fwk_id, 'aml.14_6.d', 'gate', 'contract_content',
   'Start date of the employment relationship must be stated',
   'Arbeidsforholdets begynnelse (tiltredelsesdato) ma fremga av kontrakten',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'd',
     'field', 'start_date',
     'required', true,
     'description_no', 'Dato for tiltredelse (start av arbeidsforholdet)'
   ),
   'Arbeidsmiljoloven §14-6 bokstav d'),

  -- e: Forventet varighet — for midlertidige ansettelser
  (fwk_id, 'aml.14_6.e', 'gate', 'contract_content',
   'Expected duration — required for temporary employment contracts',
   'Forventet varighet ma fremga av kontrakten for midlertidig ansettelse',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'e',
     'field', 'end_date',
     'required', false,
     'required_when', jsonb_build_object('employment_form', 'temporary'),
     'description_no', 'Forventet varighet og grunnlag for midlertidigheten'
   ),
   'Arbeidsmiljoloven §14-6 bokstav e'),

  -- f: Provetidsbestemmelser — proveperiode ved tiltredelse
  (fwk_id, 'aml.14_6.f', 'gate', 'contract_content',
   'Trial period terms — required when trial period is active',
   'Provetidsbestemmelser ma fremga av kontrakten nar provetid gjelder',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'f',
     'field', 'trial_period_months',
     'required', false,
     'required_when', jsonb_build_object('trial_period_active', true),
     'description_no', 'Provetid og lengde pa provetidsperioden'
   ),
   'Arbeidsmiljoloven §14-6 bokstav f'),

  -- g: Ferie og feriepenger + betalt fravær
  (fwk_id, 'aml.14_6.g', 'gate', 'contract_content',
   'Holiday entitlement and holiday pay — must be stated in contract',
   'Ferie og feriepenger, samt annet betalt fravær, ma fremga av kontrakten',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'g',
     'field', 'holiday_allowance_pct',
     'required', true,
     'description_no', 'Rett til ferie og feriepenger (ferieloven)'
   ),
   'Arbeidsmiljoloven §14-6 bokstav g'),

  -- h: Oppsigelsesfrister og fremgangsmate ved opphor
  (fwk_id, 'aml.14_6.h', 'gate', 'contract_content',
   'Notice periods and termination procedures must be stated',
   'Oppsigelsesfrister og fremgangsmate ved opphevelse av arbeidsforholdet ma fremga',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'h',
     'field', 'notice_period_months',
     'required', true,
     'description_no', 'Oppsigelsesfrist for begge parter og fremgangsmate'
   ),
   'Arbeidsmiljoloven §14-6 bokstav h'),

  -- i: Lonn og tillegg — avlonning
  (fwk_id, 'aml.14_6.i', 'gate', 'contract_content',
   'Wage and supplements — salary or hourly rate must be stated',
   'Lonn og tillegg — avlonning ma fremga av kontrakten',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'i',
     'field', 'monthly_salary',
     'field_alt', 'hourly_rate',
     'required', true,
     'description_no', 'Lonn (manedslnn eller timelon) og eventuelle tillegg'
   ),
   'Arbeidsmiljoloven §14-6 bokstav i'),

  -- j: Daglig og ukentlig arbeidstid
  (fwk_id, 'aml.14_6.j', 'gate', 'contract_content',
   'Daily and weekly working hours must be stated in contract',
   'Daglig og ukentlig arbeidstid ma fremga av kontrakten',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'j',
     'field', 'agreed_weekly_hours',
     'required', true,
     'description_no', 'Avtalt daglig og ukentlig arbeidstid'
   ),
   'Arbeidsmiljoloven §14-6 bokstav j'),

  -- k: Pauser — bestemmelser om pauser
  (fwk_id, 'aml.14_6.k', 'gate', 'contract_content',
   'Break arrangements must be stated in contract',
   'Bestemmelser om pauser ma fremga av kontrakten',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'k',
     'field', 'break_rule_id',
     'required', true,
     'description_no', 'Pauseordning eller referanse til gjeldende pauseregler'
   ),
   'Arbeidsmiljoloven §14-6 bokstav k'),

  -- l: Saerlig arbeidstidsordning — for turnusarbeid o.l.
  (fwk_id, 'aml.14_6.l', 'gate', 'contract_content',
   'Special working time arrangements — required when applicable',
   'Saerlig arbeidstidsordning ma fremga nar det er avtalt turnusarbeid o.l.',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'l',
     'field', 'working_hours_scheme',
     'required', false,
     'required_when', jsonb_build_object('has_special_scheme', true),
     'description_no', 'Saerlig arbeidstidsordning (turnus, skift, etc.)'
   ),
   'Arbeidsmiljoloven §14-6 bokstav l'),

  -- m: Vaktendringer (§10-3) og overtid-ordninger — NY post-2024
  -- Pontus Phase 6 approved: auto-required for hospitality + rotation schedule.
  (fwk_id, 'aml.14_6.m', 'gate', 'contract_content',
   'Schedule change terms (§10-3) and overtime arrangements — new post-July 2024',
   'Bestemmelser om vaktendringer (§10-3) og overtid-ordninger ma fremga — ny etter juli 2024',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'm',
     'field', 'schedule_change_terms',
     'required', false,
     'required_when', jsonb_build_object(
       'industry', 'hospitality',
       'schedule_type', 'rotation'
     ),
     'description_no', 'Vaktendringer etter §10-3 og overtidsordninger (ny bokstav 2024)'
   ),
   'Arbeidsmiljoloven §14-6 bokstav m (2024-revisjon)'),

  -- n: Tariffavtaler — gjeldende tariffavtale
  (fwk_id, 'aml.14_6.n', 'gate', 'contract_content',
   'Collective agreements — required when tariff agreement applies',
   'Gjeldende tariffavtale ma angis i kontrakten nar den gjelder',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'n',
     'field', 'tariff_framework',
     'required', false,
     'required_when', jsonb_build_object('has_tariff', true),
     'description_no', 'Referanse til gjeldende tariffavtale'
   ),
   'Arbeidsmiljoloven §14-6 bokstav n'),

  -- o: Innleier-informasjon — for bemanningsforetak
  (fwk_id, 'aml.14_6.o', 'gate', 'contract_content',
   'Hiring-out information — required for temp agency employment',
   'Informasjon om innleier ma fremga ved ansettelse via bemanningsforetak',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'o',
     'field', 'hire_in_workspace_id',
     'required', false,
     'required_when', jsonb_build_object('employment_form', 'temp_agency'),
     'description_no', 'Innleiers navn og adresse ved vikarbyra-ansettelse'
   ),
   'Arbeidsmiljoloven §14-6 bokstav o'),

  -- p: Kompetanseutvikling — valgfri per lovtekst (Lovsen Phase 3 verdict)
  (fwk_id, 'aml.14_6.p', 'constraint', 'contract_content',
   'Competency development terms — optional per law text',
   'Kompetanseutvikling og opplaeringstiltak — valgfri per lovtekst',
   'allowed', 'advisory', true,
   jsonb_build_object(
     'bokstav', 'p',
     'field', 'competency_dev_terms',
     'required', false,
     'description_no', 'Bestemmelser om kompetanseutvikling (valgfri etter lovtekst)'
   ),
   'Arbeidsmiljoloven §14-6 bokstav p'),

  -- q: Sosiale ytelser og pensjonsinstitusjoner — OTP obligatorisk
  (fwk_id, 'aml.14_6.q', 'gate', 'contract_content',
   'Social benefits and pension — OTP is mandatory for all employees',
   'Sosiale ytelser og pensjonsinstitusjoner — OTP obligatorisk for alle ansatte',
   'blocked', 'hard_block', false,
   jsonb_build_object(
     'bokstav', 'q',
     'field', 'otp_terms',
     'required', true,
     'description_no', 'Pensjonsordning (OTP) og andre sosiale ytelser'
   ),
   'Arbeidsmiljoloven §14-6 bokstav q + Lov om obligatorisk tjenestepensjon')

  ON CONFLICT ON CONSTRAINT uq_framework_rule DO NOTHING;

END;
$$;
