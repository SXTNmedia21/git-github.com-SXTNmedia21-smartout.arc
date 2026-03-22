-- Cascade K1a Platform Seed — hospitality.no.default.v1
-- Spec: docs/superpowers/specs/2026-03-22-cascade-foundation-completion-design.md §6
-- Seeds: 1 framework, 8 rules, 8 triggers, 5 tariff rates (correct Riksavtalen)

DO $$
DECLARE
  v_framework_id UUID;
  v_rule_min_rest UUID;
  v_rule_max_daily UUID;
  v_rule_max_weekly UUID;
  v_rule_overtime UUID;
  v_rule_under18_daily UUID;
  v_rule_under18_night UUID;
  v_rule_sunday UUID;
  v_rule_split_shift UUID;
BEGIN

  -- ========================================
  -- 1. Regulatory Framework
  -- ========================================
  INSERT INTO regulatory_framework (code, name, description, jurisdiction, industry, version, is_active, metadata)
  VALUES (
    'hospitality.no.default.v1',
    'Norsk serveringsbransje — grunnpakke',
    'Baseline regulatory framework for Norwegian hospitality. Covers AML shift rules, Riksavtalen tariff supplements, and operational constraints.',
    'NO',
    'hospitality',
    '1',
    true,
    '{"source": "AML + Riksavtalen", "effective_year": 2024}'::jsonb
  )
  ON CONFLICT (code) DO NOTHING
  RETURNING framework_id INTO v_framework_id;

  -- If already existed, fetch the ID
  IF v_framework_id IS NULL THEN
    SELECT framework_id INTO v_framework_id
    FROM regulatory_framework WHERE code = 'hospitality.no.default.v1';
  END IF;

  -- ========================================
  -- 2. Framework Rules (8 rules)
  -- ========================================

  -- Rule 1: Minimum rest between shifts (AML §10-8)
  INSERT INTO framework_rule (framework_id, code, rule_type, category, description, description_no, default_outcome, severity, outcome_overridable, config_loosen_allowed, evaluation_config, source_reference)
  VALUES (v_framework_id, 'min_rest_between_shifts', 'gate', 'working_hours',
    'Minimum 11 hours rest between shifts',
    'Minimum 11 timers hvile mellom vakter',
    'blocked', 'hard_block', false, false,
    '{"threshold_hours": 11, "check": "gap_between_shifts"}'::jsonb,
    'Arbeidsmiljøloven §10-8')
  ON CONFLICT (framework_id, code) DO NOTHING
  RETURNING rule_id INTO v_rule_min_rest;
  IF v_rule_min_rest IS NULL THEN SELECT rule_id INTO v_rule_min_rest FROM framework_rule WHERE framework_id = v_framework_id AND code = 'min_rest_between_shifts'; END IF;

  -- Rule 2: Maximum daily work hours (AML §10-4)
  INSERT INTO framework_rule (framework_id, code, rule_type, category, description, description_no, default_outcome, severity, outcome_overridable, config_loosen_allowed, evaluation_config, source_reference)
  VALUES (v_framework_id, 'max_daily_hours', 'gate', 'working_hours',
    'Maximum 9 hours daily work (10 with written agreement)',
    'Maksimalt 9 timer daglig arbeid (10 med skriftlig avtale)',
    'blocked', 'hard_block', true, true,
    '{"threshold_hours": 9, "threshold_with_agreement": 10, "check": "daily_hours"}'::jsonb,
    'Arbeidsmiljøloven §10-4')
  ON CONFLICT (framework_id, code) DO NOTHING
  RETURNING rule_id INTO v_rule_max_daily;
  IF v_rule_max_daily IS NULL THEN SELECT rule_id INTO v_rule_max_daily FROM framework_rule WHERE framework_id = v_framework_id AND code = 'max_daily_hours'; END IF;

  -- Rule 3: Maximum weekly work hours (AML §10-4)
  INSERT INTO framework_rule (framework_id, code, rule_type, category, description, description_no, default_outcome, severity, outcome_overridable, config_loosen_allowed, evaluation_config, source_reference)
  VALUES (v_framework_id, 'max_weekly_hours', 'gate', 'working_hours',
    'Maximum 40 hours weekly work',
    'Maksimalt 40 timer ukentlig arbeid',
    'blocked', 'hard_block', false, false,
    '{"threshold_hours": 40, "check": "weekly_hours"}'::jsonb,
    'Arbeidsmiljøloven §10-4')
  ON CONFLICT (framework_id, code) DO NOTHING
  RETURNING rule_id INTO v_rule_max_weekly;
  IF v_rule_max_weekly IS NULL THEN SELECT rule_id INTO v_rule_max_weekly FROM framework_rule WHERE framework_id = v_framework_id AND code = 'max_weekly_hours'; END IF;

  -- Rule 4: Overtime requires written agreement (AML §10-6)
  INSERT INTO framework_rule (framework_id, code, rule_type, category, description, description_no, default_outcome, severity, outcome_overridable, config_loosen_allowed, evaluation_config, source_reference)
  VALUES (v_framework_id, 'overtime_requires_agreement', 'gate', 'overtime',
    'Overtime (>9h/day or >40h/week) requires written agreement',
    'Overtid (>9t/dag eller >40t/uke) krever skriftlig avtale',
    'review_required', 'soft_block', true, false,
    '{"threshold_daily": 9, "threshold_weekly": 40, "check": "overtime_agreement"}'::jsonb,
    'Arbeidsmiljøloven §10-6')
  ON CONFLICT (framework_id, code) DO NOTHING
  RETURNING rule_id INTO v_rule_overtime;
  IF v_rule_overtime IS NULL THEN SELECT rule_id INTO v_rule_overtime FROM framework_rule WHERE framework_id = v_framework_id AND code = 'overtime_requires_agreement'; END IF;

  -- Rule 5: Under-18 max daily hours (AML §11-2)
  INSERT INTO framework_rule (framework_id, code, rule_type, category, description, description_no, default_outcome, severity, outcome_overridable, config_loosen_allowed, evaluation_config, source_reference)
  VALUES (v_framework_id, 'under18_max_daily', 'gate', 'age_restriction',
    'Under-18 employees: maximum 8 hours daily',
    'Arbeidstakere under 18 år: maksimalt 8 timer daglig',
    'blocked', 'hard_block', false, false,
    '{"max_age": 17, "threshold_hours": 8, "check": "daily_hours_age"}'::jsonb,
    'Arbeidsmiljøloven §11-2')
  ON CONFLICT (framework_id, code) DO NOTHING
  RETURNING rule_id INTO v_rule_under18_daily;
  IF v_rule_under18_daily IS NULL THEN SELECT rule_id INTO v_rule_under18_daily FROM framework_rule WHERE framework_id = v_framework_id AND code = 'under18_max_daily'; END IF;

  -- Rule 6: Under-18 no night work (AML §11-3)
  INSERT INTO framework_rule (framework_id, code, rule_type, category, description, description_no, default_outcome, severity, outcome_overridable, config_loosen_allowed, evaluation_config, source_reference)
  VALUES (v_framework_id, 'under18_no_night', 'gate', 'age_restriction',
    'Under-18 employees: no work between 21:00 and 06:00',
    'Arbeidstakere under 18 år: ingen arbeid mellom 21:00 og 06:00',
    'blocked', 'hard_block', false, false,
    '{"max_age": 17, "restricted_start": "21:00", "restricted_end": "06:00", "check": "night_work_age"}'::jsonb,
    'Arbeidsmiljøloven §11-3')
  ON CONFLICT (framework_id, code) DO NOTHING
  RETURNING rule_id INTO v_rule_under18_night;
  IF v_rule_under18_night IS NULL THEN SELECT rule_id INTO v_rule_under18_night FROM framework_rule WHERE framework_id = v_framework_id AND code = 'under18_no_night'; END IF;

  -- Rule 7: Sunday/holiday work requires agreement (AML §10-10)
  INSERT INTO framework_rule (framework_id, code, rule_type, category, description, description_no, default_outcome, severity, outcome_overridable, config_loosen_allowed, evaluation_config, source_reference)
  VALUES (v_framework_id, 'sunday_holiday_agreement', 'constraint', 'scheduling',
    'Sunday and public holiday work requires written agreement',
    'Søndags- og helligdagsarbeid krever skriftlig avtale',
    'review_required', 'soft_block', true, false,
    '{"check": "sunday_holiday_shift"}'::jsonb,
    'Arbeidsmiljøloven §10-10')
  ON CONFLICT (framework_id, code) DO NOTHING
  RETURNING rule_id INTO v_rule_sunday;
  IF v_rule_sunday IS NULL THEN SELECT rule_id INTO v_rule_sunday FROM framework_rule WHERE framework_id = v_framework_id AND code = 'sunday_holiday_agreement'; END IF;

  -- Rule 8: Split shift unpaid gap limit (Riksavtalen)
  INSERT INTO framework_rule (framework_id, code, rule_type, category, description, description_no, default_outcome, severity, outcome_overridable, config_loosen_allowed, evaluation_config, source_reference)
  VALUES (v_framework_id, 'split_shift_gap_limit', 'advisory', 'scheduling',
    'Split shift: maximum 2 hours unpaid gap',
    'Delt vakt: maksimalt 2 timer ubetalt pause',
    'allowed_with_exception', 'warning', true, true,
    '{"max_gap_hours": 2, "check": "split_shift_gap"}'::jsonb,
    'Riksavtalen')
  ON CONFLICT (framework_id, code) DO NOTHING
  RETURNING rule_id INTO v_rule_split_shift;
  IF v_rule_split_shift IS NULL THEN SELECT rule_id INTO v_rule_split_shift FROM framework_rule WHERE framework_id = v_framework_id AND code = 'split_shift_gap_limit'; END IF;

  -- ========================================
  -- 3. Framework Triggers (8 triggers)
  -- ========================================

  INSERT INTO framework_trigger (framework_id, code, description, description_no, trigger_mode, source_entity_type, evaluation_config, linked_rule_ids)
  VALUES
    (v_framework_id, 'shift_created', 'Evaluate rules when a new shift is created',
      'Evaluer regler når en ny vakt opprettes',
      'state_change', 'schedule_shift',
      '{"event": "insert"}'::jsonb,
      ARRAY[v_rule_min_rest, v_rule_max_daily, v_rule_max_weekly, v_rule_under18_daily, v_rule_under18_night, v_rule_sunday]),

    (v_framework_id, 'shift_updated', 'Evaluate rules when shift times or assignment changes',
      'Evaluer regler når vakttider eller tildeling endres',
      'state_change', 'schedule_shift',
      '{"event": "update", "watch_columns": ["start_time", "end_time", "profile_id"]}'::jsonb,
      ARRAY[v_rule_min_rest, v_rule_max_daily, v_rule_max_weekly, v_rule_under18_daily, v_rule_under18_night, v_rule_sunday]),

    (v_framework_id, 'schedule_published', 'Evaluate rules when a batch of shifts is published',
      'Evaluer regler når en gruppe vakter publiseres',
      'state_change', 'schedule_shift',
      '{"event": "batch_publish"}'::jsonb,
      ARRAY[v_rule_min_rest, v_rule_max_daily, v_rule_max_weekly, v_rule_overtime]),

    (v_framework_id, 'hours_exceeded_daily', 'Triggered when employee daily hours exceed 9',
      'Utløses når ansattes daglige timer overstiger 9',
      'threshold', 'schedule_shift',
      '{"threshold": 9, "metric": "daily_hours"}'::jsonb,
      ARRAY[v_rule_max_daily, v_rule_overtime]),

    (v_framework_id, 'hours_exceeded_weekly', 'Triggered when employee weekly hours exceed 40',
      'Utløses når ansattes ukentlige timer overstiger 40',
      'threshold', 'schedule_shift',
      '{"threshold": 40, "metric": "weekly_hours"}'::jsonb,
      ARRAY[v_rule_max_weekly, v_rule_overtime]),

    (v_framework_id, 'rest_period_violated', 'Triggered when gap between shifts < 11 hours',
      'Utløses når pause mellom vakter er under 11 timer',
      'threshold', 'schedule_shift',
      '{"threshold": 11, "metric": "rest_hours", "direction": "below"}'::jsonb,
      ARRAY[v_rule_min_rest]),

    (v_framework_id, 'age_restriction_check', 'Triggered when shift is assigned to under-18 profile',
      'Utløses når vakt tildeles ansatt under 18 år',
      'state_change', 'schedule_shift',
      '{"check": "employee_age", "max_age": 17}'::jsonb,
      ARRAY[v_rule_under18_daily, v_rule_under18_night]),

    (v_framework_id, 'holiday_shift_check', 'Triggered when shift is on a public holiday date',
      'Utløses når vakt er på en helligdag',
      'state_change', 'schedule_shift',
      '{"check": "public_holiday_date"}'::jsonb,
      ARRAY[v_rule_sunday])
  ON CONFLICT (framework_id, code) DO NOTHING;

  -- ========================================
  -- 4. Tariff Rate Baseline (Riksavtalen — correct rates)
  -- Platform-level: workspace_id IS NULL
  -- ========================================

  -- kveldstillegg: 15.65 kr/t (21:00-06:00)
  INSERT INTO tariff_rate_table (workspace_id, rate_type, source, effective_from, amount, unit, metadata, provenance)
  VALUES (NULL, 'kveldstillegg', 'riksavtalen', '2024-04-01', 15.65, 'kr/t',
    '{"applies": "21:00-06:00", "description": "Evening supplement"}'::jsonb,
    jsonb_build_object('seed', 'hospitality.no.default.v1', 'version', '1', 'seeded_at', now()))
  ON CONFLICT ON CONSTRAINT excl_tariff_no_overlap DO NOTHING;

  -- helgetillegg: 29.74 kr/t (Sat 15:00 - Sun 24:00)
  INSERT INTO tariff_rate_table (workspace_id, rate_type, source, effective_from, amount, unit, metadata, provenance)
  VALUES (NULL, 'helgetillegg', 'riksavtalen', '2024-04-01', 29.74, 'kr/t',
    '{"applies": "Sat 15:00 - Sun 24:00", "description": "Weekend supplement"}'::jsonb,
    jsonb_build_object('seed', 'hospitality.no.default.v1', 'version', '1', 'seeded_at', now()))
  ON CONFLICT ON CONSTRAINT excl_tariff_no_overlap DO NOTHING;

  -- helligdagstillegg: 100% of base (public holidays)
  INSERT INTO tariff_rate_table (workspace_id, rate_type, source, effective_from, amount, unit, metadata, provenance)
  VALUES (NULL, 'helligdagstillegg', 'riksavtalen', '2024-04-01', 100, 'percent',
    '{"applies": "Public holidays", "description": "Public holiday supplement"}'::jsonb,
    jsonb_build_object('seed', 'hospitality.no.default.v1', 'version', '1', 'seeded_at', now()))
  ON CONFLICT ON CONSTRAINT excl_tariff_no_overlap DO NOTHING;

  -- overtidstillegg_50: 50% of base (first 2h overtime)
  INSERT INTO tariff_rate_table (workspace_id, rate_type, source, effective_from, amount, unit, metadata, provenance)
  VALUES (NULL, 'overtidstillegg_50', 'riksavtalen', '2024-04-01', 50, 'percent',
    '{"applies": "First 2 hours overtime", "description": "Overtime 50% supplement"}'::jsonb,
    jsonb_build_object('seed', 'hospitality.no.default.v1', 'version', '1', 'seeded_at', now()))
  ON CONFLICT ON CONSTRAINT excl_tariff_no_overlap DO NOTHING;

  -- overtidstillegg_100: 100% of base (overtime beyond 2h)
  INSERT INTO tariff_rate_table (workspace_id, rate_type, source, effective_from, amount, unit, metadata, provenance)
  VALUES (NULL, 'overtidstillegg_100', 'riksavtalen', '2024-04-01', 100, 'percent',
    '{"applies": "Overtime beyond 2 hours", "description": "Overtime 100% supplement"}'::jsonb,
    jsonb_build_object('seed', 'hospitality.no.default.v1', 'version', '1', 'seeded_at', now()))
  ON CONFLICT ON CONSTRAINT excl_tariff_no_overlap DO NOTHING;

  RAISE NOTICE 'K1a hospitality.no.default.v1 seed completed: framework=%, rules=8, triggers=8, tariff_rates=5', v_framework_id;

END $$;
