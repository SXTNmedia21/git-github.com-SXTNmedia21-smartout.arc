-- ============================================
-- 20260424100000_seed_hospitality_framework.sql
-- K1a: Seed hospitality.no.default.v1 framework
-- Seeds: regulatory_framework, framework_rule, framework_trigger, tariff_rate_table
-- Source: Riksavtalen (NHO Reiseliv) + Arbeidsmiljoloven (AML)
-- ============================================

SET search_path TO public, extensions;

-- ============================================================
-- 1. regulatory_framework — hospitality.no.default.v1
-- ============================================================

INSERT INTO regulatory_framework (code, name, description, jurisdiction, industry, version, metadata)
VALUES (
  'hospitality.no.default.v1',
  'Riksavtalen — Restaurant og servering',
  'Norsk rammeverk for restaurant- og serveringsbransjen basert pa Riksavtalen (NHO Reiseliv) og Arbeidsmiljoloven.',
  'NO',
  'hospitality',
  '1.0.0',
  jsonb_build_object(
    'source', 'AML + Riksavtalen',
    'effective_year', 2026,
    'tariff_agreement', 'Riksavtalen for serveringsvirksomheter',
    'labor_law', 'Arbeidsmiljoloven (AML)',
    'seeded_at', now()
  )
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  version = EXCLUDED.version,
  metadata = EXCLUDED.metadata,
  updated_at = now();

-- ============================================================
-- 2. framework_rule — Arbeidsrett / labor law rules
-- ============================================================

-- Grab the framework_id for FK references
DO $$
DECLARE
  fwk_id UUID;
BEGIN
  SELECT framework_id INTO fwk_id
  FROM regulatory_framework
  WHERE code = 'hospitality.no.default.v1';

  IF fwk_id IS NULL THEN
    RAISE EXCEPTION 'hospitality.no.default.v1 framework not found';
  END IF;

  -- ---- GATE rules (hard blocks) ----

  INSERT INTO framework_rule (framework_id, code, rule_type, category, description, description_no, default_outcome, severity, outcome_overridable, evaluation_config, source_reference)
  VALUES
    -- Max daily working hours (AML §10-4)
    (fwk_id, 'aml.max_daily_hours', 'gate', 'working_time',
     'Maximum 9 hours per day for regular work',
     'Maks 9 timer per dag for alminnelig arbeidstid',
     'blocked', 'hard_block', false,
     '{"max_hours": 9, "entity": "schedule_shift", "field": "duration_hours"}'::jsonb,
     'Arbeidsmiljoloven §10-4(1)'),

    -- Max weekly working hours (AML §10-4)
    (fwk_id, 'aml.max_weekly_hours', 'gate', 'working_time',
     'Maximum 40 hours per week',
     'Maks 40 timer per uke',
     'blocked', 'hard_block', false,
     '{"max_hours": 40, "entity": "profile", "period": "week"}'::jsonb,
     'Arbeidsmiljoloven §10-4(1)'),

    -- Max overtime per week (AML §10-6)
    (fwk_id, 'aml.max_overtime_week', 'gate', 'overtime',
     'Maximum 10 hours overtime per 7 days',
     'Maks 10 timer overtid per 7 dager',
     'blocked', 'hard_block', false,
     '{"max_hours": 10, "entity": "profile", "period": "7_days"}'::jsonb,
     'Arbeidsmiljoloven §10-6(4)'),

    -- Max overtime per 4 weeks (AML §10-6)
    (fwk_id, 'aml.max_overtime_4weeks', 'gate', 'overtime',
     'Maximum 25 hours overtime per 4 consecutive weeks',
     'Maks 25 timer overtid per 4 sammenhengende uker',
     'blocked', 'hard_block', false,
     '{"max_hours": 25, "entity": "profile", "period": "4_weeks"}'::jsonb,
     'Arbeidsmiljoloven §10-6(4)'),

    -- Max overtime per year (AML §10-6)
    (fwk_id, 'aml.max_overtime_year', 'gate', 'overtime',
     'Maximum 200 hours overtime per calendar year',
     'Maks 200 timer overtid per kalenderaar',
     'blocked', 'hard_block', false,
     '{"max_hours": 200, "entity": "profile", "period": "year"}'::jsonb,
     'Arbeidsmiljoloven §10-6(4)'),

    -- Min daily rest (AML §10-8)
    (fwk_id, 'aml.min_daily_rest', 'gate', 'rest',
     'Minimum 11 hours continuous rest per 24 hours',
     'Minimum 11 timer sammenhengende hvile per 24 timer',
     'blocked', 'hard_block', false,
     '{"min_hours": 11, "entity": "profile", "period": "24_hours"}'::jsonb,
     'Arbeidsmiljoloven §10-8(1)'),

    -- Min weekly rest (AML §10-8)
    (fwk_id, 'aml.min_weekly_rest', 'gate', 'rest',
     'Minimum 35 hours continuous rest per 7 days, should include Sunday',
     'Minimum 35 timer sammenhengende hvile per 7 dager, bor inkludere sondag',
     'blocked', 'hard_block', false,
     '{"min_hours": 35, "entity": "profile", "period": "7_days", "preferred_day": "sunday"}'::jsonb,
     'Arbeidsmiljoloven §10-8(2)'),

    -- Minimum break (AML §10-9)
    (fwk_id, 'aml.min_break', 'gate', 'rest',
     'Minimum 30 min break if shift > 5.5h. At least 45 min if > 8h and includes meals',
     'Minimum 30 min pause hvis vakt > 5,5t. Minst 45 min hvis > 8t og inkluderer maaltider',
     'blocked', 'hard_block', false,
     '{"thresholds": [{"shift_hours": 5.5, "break_minutes": 30}, {"shift_hours": 8, "break_minutes": 45}]}'::jsonb,
     'Arbeidsmiljoloven §10-9(1)')

  ON CONFLICT ON CONSTRAINT uq_framework_rule DO NOTHING;

  -- ---- CONSTRAINT rules (warnings, can be overridden with reason) ----

  INSERT INTO framework_rule (framework_id, code, rule_type, category, description, description_no, default_outcome, severity, outcome_overridable, config_loosen_allowed, override_min_level, evaluation_config, source_reference)
  VALUES
    -- Average hours over 8 weeks (AML §10-4)
    (fwk_id, 'aml.avg_hours_8weeks', 'constraint', 'working_time',
     'Average max 48 hours per week over 8-week period',
     'Gjennomsnitt maks 48 timer per uke over 8-ukersperiode',
     'review_required', 'soft_block', true, false, 'admin',
     '{"max_avg_hours": 48, "entity": "profile", "period": "8_weeks"}'::jsonb,
     'Arbeidsmiljoloven §10-4(2)'),

    -- Night work restriction (AML §10-11)
    (fwk_id, 'aml.night_work', 'constraint', 'working_time',
     'Night work (21:00-06:00) max 8 hours. Only allowed when nature of work requires it',
     'Nattarbeid (21:00-06:00) maks 8 timer. Kun tillatt nar arbeidets art gjor det nodvendig',
     'review_required', 'soft_block', true, false, 'admin',
     '{"max_hours": 8, "night_start": "21:00", "night_end": "06:00"}'::jsonb,
     'Arbeidsmiljoloven §10-11'),

    -- Sunday/holiday work (AML §10-10)
    (fwk_id, 'aml.sunday_holiday_work', 'constraint', 'working_time',
     'Sunday and holiday work only when nature of work requires it. Compensatory day off within 14 days',
     'Sondags- og helligdagsarbeid kun naar arbeidets art gjor det nodvendig. Kompenserende fridag innen 14 dager',
     'allowed_with_exception', 'advisory', true, true, 'manager',
     '{"compensation_days": 14, "entity": "schedule_shift"}'::jsonb,
     'Arbeidsmiljoloven §10-10')

  ON CONFLICT ON CONSTRAINT uq_framework_rule DO NOTHING;

  -- ---- ADVISORY rules (informational / best practice) ----

  INSERT INTO framework_rule (framework_id, code, rule_type, category, description, description_no, default_outcome, severity, outcome_overridable, evaluation_config, source_reference)
  VALUES
    -- Probation period (AML §15-6)
    (fwk_id, 'aml.probation_period', 'advisory', 'employment',
     'Probation period max 6 months. Must be written in contract',
     'Provetid maks 6 maaneder. Maa vaere skriftlig avtalt',
     'allowed', 'info', true,
     '{"max_months": 6}'::jsonb,
     'Arbeidsmiljoloven §15-6'),

    -- Vacation days (Ferieloven §5)
    (fwk_id, 'ferieloven.vacation_days', 'advisory', 'employment',
     '25 working days vacation per year (4 weeks + 1 day). Extra week for employees over 60',
     '25 virkedager ferie per aar (4 uker + 1 dag). Ekstra uke for ansatte over 60',
     'allowed', 'info', true,
     '{"base_days": 25, "over_60_extra_days": 5}'::jsonb,
     'Ferieloven §5')

  ON CONFLICT ON CONSTRAINT uq_framework_rule DO NOTHING;

  -- ---- COMMERCIAL rules (tariff/compensation) ----

  INSERT INTO framework_rule (framework_id, code, rule_type, category, description, description_no, default_outcome, severity, outcome_overridable, evaluation_config, source_reference)
  VALUES
    -- Kveldstillegg (Riksavtalen)
    (fwk_id, 'riksavtalen.kveldstillegg', 'commercial', 'compensation',
     'Evening supplement 15.65 kr/h between 21:00 and 06:00',
     'Kveldstillegg 15,65 kr/t mellom kl. 21:00 og 06:00',
     'allowed', 'info', false,
     '{"rate": 15.65, "unit": "kr/t", "from_hour": "21:00", "to_hour": "06:00"}'::jsonb,
     'Riksavtalen §6'),

    -- Helgetillegg (Riksavtalen)
    (fwk_id, 'riksavtalen.helgetillegg', 'commercial', 'compensation',
     'Weekend supplement 29.74 kr/h Saturday 15:00 to Sunday 24:00',
     'Helgetillegg 29,74 kr/t lordag 15:00 til sondag 24:00',
     'allowed', 'info', false,
     '{"rate": 29.74, "unit": "kr/t", "from_day": "saturday", "from_hour": "15:00", "to_day": "sunday", "to_hour": "24:00"}'::jsonb,
     'Riksavtalen §6'),

    -- Helligdagstillegg (Riksavtalen)
    (fwk_id, 'riksavtalen.helligdagstillegg', 'commercial', 'compensation',
     'Public holiday supplement 100% of hourly rate',
     'Helligdagstillegg 100% av timelonn',
     'allowed', 'info', false,
     '{"rate": 100, "unit": "percent"}'::jsonb,
     'Riksavtalen §6'),

    -- Overtid 50% (AML §10-6)
    (fwk_id, 'aml.overtime_50', 'commercial', 'compensation',
     'Overtime supplement minimum 40% (Riksavtalen: 50%) for first 2 hours',
     'Overtidstillegg minimum 40% (Riksavtalen: 50%) for forste 2 timer',
     'allowed', 'info', false,
     '{"rate": 50, "unit": "percent", "threshold": "first_2h"}'::jsonb,
     'AML §10-6(11) / Riksavtalen §7'),

    -- Overtid 100% (Riksavtalen)
    (fwk_id, 'riksavtalen.overtime_100', 'commercial', 'compensation',
     'Overtime supplement 100% beyond 2 hours overtime per day',
     'Overtidstillegg 100% utover 2 timer overtid per dag',
     'allowed', 'info', false,
     '{"rate": 100, "unit": "percent", "threshold": "beyond_2h"}'::jsonb,
     'Riksavtalen §7'),

    -- Minimum wage (Riksavtalen)
    (fwk_id, 'riksavtalen.min_wage', 'commercial', 'compensation',
     'Minimum hourly wage: 198.50 kr/h (unskilled), higher rates for certified workers',
     'Minimumslonn: 198,50 kr/t (ufaglaert), hoyere satser for fagarbeidere',
     'blocked', 'hard_block', false,
     '{"min_wage_ufaglart": 198.50, "min_wage_faglart": 210.00, "unit": "kr/t"}'::jsonb,
     'Riksavtalen §4')

  ON CONFLICT ON CONSTRAINT uq_framework_rule DO NOTHING;

  -- ============================================================
  -- 3. framework_trigger — Events that initiate evaluation
  -- ============================================================

  INSERT INTO framework_trigger (framework_id, code, description, description_no, trigger_mode, source_entity_type, evaluation_config, is_enabled, is_disableable, threshold_tune_allowed)
  VALUES
    -- Shift created/modified triggers working time + rest rules
    (fwk_id, 'trigger.shift_created', 'Evaluate working time rules when a shift is created or modified',
     'Evaluer arbeidstidsregler naar en vakt opprettes eller endres',
     'state_change', 'schedule_shift',
     '{"evaluate_rules": ["aml.max_daily_hours", "aml.max_weekly_hours", "aml.min_daily_rest", "aml.min_weekly_rest", "aml.min_break", "aml.night_work"]}'::jsonb,
     true, false, false),

    -- Shift published triggers overtime check
    (fwk_id, 'trigger.shift_published', 'Evaluate overtime limits when shifts are published',
     'Evaluer overtidsgrenser naar vakter publiseres',
     'state_change', 'schedule_shift',
     '{"evaluate_rules": ["aml.max_overtime_week", "aml.max_overtime_4weeks", "aml.max_overtime_year"]}'::jsonb,
     true, false, false),

    -- Shift completed triggers compensation rules
    (fwk_id, 'trigger.shift_completed', 'Calculate supplements and overtime compensation when a shift is completed',
     'Beregn tillegg og overtidskompensasjon naar en vakt er fullfort',
     'state_change', 'schedule_shift',
     '{"evaluate_rules": ["riksavtalen.kveldstillegg", "riksavtalen.helgetillegg", "riksavtalen.helligdagstillegg", "aml.overtime_50", "riksavtalen.overtime_100"]}'::jsonb,
     true, false, false),

    -- Weekly threshold check (time-based, runs on schedule)
    (fwk_id, 'trigger.weekly_hours_check', 'Weekly check for average hours compliance over rolling 8-week period',
     'Ukentlig sjekk av gjennomsnittlig arbeidstid over rullerende 8-ukersperiode',
     'time_based', 'profile',
     '{"evaluate_rules": ["aml.avg_hours_8weeks"], "schedule": "weekly", "day": "monday"}'::jsonb,
     true, true, true),

    -- Employment contract created
    (fwk_id, 'trigger.contract_created', 'Validate employment terms against framework when contract is created',
     'Valider ansettelsesvilkaar mot rammeverket naar kontrakt opprettes',
     'state_change', 'employment_contract',
     '{"evaluate_rules": ["aml.probation_period", "ferieloven.vacation_days", "riksavtalen.min_wage"]}'::jsonb,
     true, false, false),

    -- Season transition
    (fwk_id, 'trigger.season_transition', 'Re-evaluate tariff rates and working time rules on season change',
     'Re-evaluer tariffsatser og arbeidstidsregler ved sesongskifte',
     'state_change', 'season',
     '{"evaluate_rules": ["riksavtalen.kveldstillegg", "riksavtalen.helgetillegg", "riksavtalen.min_wage"]}'::jsonb,
     true, true, false),

    -- Sunday/holiday scheduling
    (fwk_id, 'trigger.sunday_holiday_shift', 'Flag shifts scheduled on Sundays or public holidays for review',
     'Flagg vakter planlagt paa sondager eller helligdager for gjennomgang',
     'state_change', 'schedule_shift',
     '{"evaluate_rules": ["aml.sunday_holiday_work", "riksavtalen.helligdagstillegg"]}'::jsonb,
     true, true, false)

  ON CONFLICT ON CONSTRAINT uq_framework_trigger DO NOTHING;

  -- ============================================================
  -- 4. Link triggers to their rules via linked_rule_ids
  -- ============================================================

  -- shift_created trigger links to working time + rest rules
  UPDATE framework_trigger SET linked_rule_ids = ARRAY(
    SELECT rule_id FROM framework_rule
    WHERE framework_id = fwk_id
    AND code IN ('aml.max_daily_hours', 'aml.max_weekly_hours', 'aml.min_daily_rest', 'aml.min_weekly_rest', 'aml.min_break', 'aml.night_work')
  ) WHERE framework_id = fwk_id AND code = 'trigger.shift_created';

  -- shift_published trigger links to overtime rules
  UPDATE framework_trigger SET linked_rule_ids = ARRAY(
    SELECT rule_id FROM framework_rule
    WHERE framework_id = fwk_id
    AND code IN ('aml.max_overtime_week', 'aml.max_overtime_4weeks', 'aml.max_overtime_year')
  ) WHERE framework_id = fwk_id AND code = 'trigger.shift_published';

  -- shift_completed trigger links to compensation rules
  UPDATE framework_trigger SET linked_rule_ids = ARRAY(
    SELECT rule_id FROM framework_rule
    WHERE framework_id = fwk_id
    AND code IN ('riksavtalen.kveldstillegg', 'riksavtalen.helgetillegg', 'riksavtalen.helligdagstillegg', 'aml.overtime_50', 'riksavtalen.overtime_100')
  ) WHERE framework_id = fwk_id AND code = 'trigger.shift_completed';

  -- weekly_hours_check trigger
  UPDATE framework_trigger SET linked_rule_ids = ARRAY(
    SELECT rule_id FROM framework_rule
    WHERE framework_id = fwk_id AND code = 'aml.avg_hours_8weeks'
  ) WHERE framework_id = fwk_id AND code = 'trigger.weekly_hours_check';

  -- contract_created trigger
  UPDATE framework_trigger SET linked_rule_ids = ARRAY(
    SELECT rule_id FROM framework_rule
    WHERE framework_id = fwk_id
    AND code IN ('aml.probation_period', 'ferieloven.vacation_days', 'riksavtalen.min_wage')
  ) WHERE framework_id = fwk_id AND code = 'trigger.contract_created';

  -- season_transition trigger
  UPDATE framework_trigger SET linked_rule_ids = ARRAY(
    SELECT rule_id FROM framework_rule
    WHERE framework_id = fwk_id
    AND code IN ('riksavtalen.kveldstillegg', 'riksavtalen.helgetillegg', 'riksavtalen.min_wage')
  ) WHERE framework_id = fwk_id AND code = 'trigger.season_transition';

  -- sunday_holiday_shift trigger
  UPDATE framework_trigger SET linked_rule_ids = ARRAY(
    SELECT rule_id FROM framework_rule
    WHERE framework_id = fwk_id
    AND code IN ('aml.sunday_holiday_work', 'riksavtalen.helligdagstillegg')
  ) WHERE framework_id = fwk_id AND code = 'trigger.sunday_holiday_shift';

END $$;

-- ============================================================
-- 5. tariff_rate_table — Platform-level rates (K1a, NULL workspace_id)
-- Riksavtalen 2026 rates for hospitality
-- ============================================================

INSERT INTO tariff_rate_table (workspace_id, rate_type, source, effective_from, effective_until, seniority_years, amount, unit, metadata, provenance)
VALUES
  -- Kveldstillegg: 15.65 kr/t (21:00-06:00)
  (NULL, 'kveldstillegg', 'riksavtalen', '2026-01-01', NULL, NULL,
   15.65, 'kr/t',
   '{"from_hour": "21:00", "to_hour": "06:00"}'::jsonb,
   '{"source": "riksavtalen", "agreement": "NHO Reiseliv", "year": 2026, "seeded_at": "2026-03-24"}'::jsonb),

  -- Helgetillegg: 29.74 kr/t (Sat 15:00 - Sun 24:00)
  (NULL, 'helgetillegg', 'riksavtalen', '2026-01-01', NULL, NULL,
   29.74, 'kr/t',
   '{"from_day": "saturday", "from_hour": "15:00", "to_day": "sunday", "to_hour": "24:00"}'::jsonb,
   '{"source": "riksavtalen", "agreement": "NHO Reiseliv", "year": 2026, "seeded_at": "2026-03-24"}'::jsonb),

  -- Helligdagstillegg: 100% of hourly rate
  (NULL, 'helligdagstillegg', 'riksavtalen', '2026-01-01', NULL, NULL,
   100, 'percent',
   '{}'::jsonb,
   '{"source": "riksavtalen", "agreement": "NHO Reiseliv", "year": 2026, "seeded_at": "2026-03-24"}'::jsonb),

  -- Overtime 50%: first 2 hours
  (NULL, 'overtidstillegg_50', 'riksavtalen', '2026-01-01', NULL, NULL,
   50, 'percent',
   '{"threshold": "first_2h_per_day"}'::jsonb,
   '{"source": "riksavtalen", "agreement": "NHO Reiseliv", "year": 2026, "legal_ref": "AML §10-6(11)", "seeded_at": "2026-03-24"}'::jsonb),

  -- Overtime 100%: beyond 2 hours
  (NULL, 'overtidstillegg_100', 'riksavtalen', '2026-01-01', NULL, NULL,
   100, 'percent',
   '{"threshold": "beyond_2h_per_day"}'::jsonb,
   '{"source": "riksavtalen", "agreement": "NHO Reiseliv", "year": 2026, "seeded_at": "2026-03-24"}'::jsonb),

  -- Min wage: ufaglart (unskilled)
  (NULL, 'minstelonn_ufaglart', 'riksavtalen', '2026-01-01', NULL, NULL,
   198.50, 'kr/t',
   '{"category": "ufaglart"}'::jsonb,
   '{"source": "riksavtalen", "agreement": "NHO Reiseliv", "year": 2026, "seeded_at": "2026-03-24"}'::jsonb),

  -- Min wage: faglart (certified, e.g. fagbrev)
  (NULL, 'minstelonn_faglart', 'riksavtalen', '2026-01-01', NULL, NULL,
   210.00, 'kr/t',
   '{"category": "faglart"}'::jsonb,
   '{"source": "riksavtalen", "agreement": "NHO Reiseliv", "year": 2026, "seeded_at": "2026-03-24"}'::jsonb),

  -- OTP employer contribution (Obligatorisk tjenestepensjon)
  (NULL, 'otp_arbeidsgiver', 'riksavtalen', '2026-01-01', NULL, NULL,
   2.00, 'percent',
   '{"min_percent": 2}'::jsonb,
   '{"source": "OTP-loven", "year": 2026, "seeded_at": "2026-03-24"}'::jsonb),

  -- Employer tax (arbeidsgiveravgift) — zone 1 default
  (NULL, 'arbeidsgiveravgift', 'riksavtalen', '2026-01-01', NULL, NULL,
   14.10, 'percent',
   '{"zone": 1, "note": "Standard sone 1 sats"}'::jsonb,
   '{"source": "Stortinget", "year": 2026, "seeded_at": "2026-03-24"}'::jsonb)

ON CONFLICT DO NOTHING;
