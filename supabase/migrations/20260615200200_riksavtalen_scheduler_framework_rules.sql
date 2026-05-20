-- ============================================================
-- 20260615200200_riksavtalen_scheduler_framework_rules.sql
--
-- K1a: Seed Riksavtalen-basert constraint rows for the greedy scheduler.
-- These rows use the rule_type values expected by packages/ai/src/scheduler/eligibility.ts:
--   aml_daily_max_hours   → eligibility.ts:194 (dailyMaxHours)
--   aml_weekly_max_hours  → eligibility.ts:195 (weeklyMaxHours)
--   aml_weekly_min_hours_floor → eligibility.ts: future (floor guard)
--   tariff_min_rest_hours → eligibility.ts:196 (minRestHours)
--
-- WHY: The existing 20260424100000 seed stores AML hour-cap rules as
-- rule_type='gate' (for contract validation via legal capability).
-- The scheduler eligibility helper queries by specific rule_type strings.
-- A second set of rows with the solver-expected types is needed so the
-- scheduler can load constraints without ambiguity.
--
-- ADR-0307 (greedy V1) §"Hard Constraints" — Aml §10 daily/weekly caps +
-- Riksavtalen §4 minimum rest.
-- ADR-0309 §"V1 Persistence Shape" — tariff_rule_ids recorded in JSONB.
-- PLAN-scheduler-greedy.md Task 0.
-- ============================================================

SET search_path TO public, extensions;

DO $$
DECLARE
  fwk_id UUID;
BEGIN
  -- Require the hospitality.no.default.v1 framework (seeded in 20260424100000).
  SELECT framework_id INTO fwk_id
  FROM regulatory_framework
  WHERE code = 'hospitality.no.default.v1';

  IF fwk_id IS NULL THEN
    RAISE EXCEPTION 'hospitality.no.default.v1 framework not found — run 20260424100000 first';
  END IF;

  -- ── Scheduler constraint rows ──────────────────────────────────────────────
  -- rule_type values exactly match FrameworkRule.rule_type union in eligibility.ts.
  -- ON CONFLICT DO NOTHING = idempotent, safe to re-apply.

  -- AML §10 nr. 1: daglig arbeidstid maks 9 timer (alminnelig arbeidstid)
  INSERT INTO framework_rule (
    framework_id, code, rule_type, category,
    description, description_no,
    default_outcome, severity,
    outcome_overridable, evaluation_config, source_reference
  ) VALUES (
    fwk_id,
    'aml.scheduler.daily_max_hours',
    'aml_daily_max_hours',
    'working_time',
    'AML §10-4(1): Maximum 9 hours ordinary daily working time. Scheduler hard cap.',
    'AML §10-4(1): Maks 9 timers alminnelig daglig arbeidstid. Planlegger-grense.',
    'blocked', 'hard_block', false,
    jsonb_build_object(
      'value_hours', 9.0,
      'rule_class', 'aml_daily_max_hours',
      'solver_readable', true,
      'description_no', 'Daglig maksgrense for alminnelig arbeidstid per AML §10-4'
    ),
    'Arbeidsmiljoloven §10-4 nr. 1'
  )
  ON CONFLICT (framework_id, code) DO NOTHING;

  -- AML §10 nr. 1: ukentlig arbeidstid maks 40 timer (alminnelig arbeidstid)
  INSERT INTO framework_rule (
    framework_id, code, rule_type, category,
    description, description_no,
    default_outcome, severity,
    outcome_overridable, evaluation_config, source_reference
  ) VALUES (
    fwk_id,
    'aml.scheduler.weekly_max_hours',
    'aml_weekly_max_hours',
    'working_time',
    'AML §10-4(1): Maximum 40 hours ordinary weekly working time. Scheduler hard cap.',
    'AML §10-4(1): Maks 40 timers alminnelig ukentlig arbeidstid. Planlegger-grense.',
    'blocked', 'hard_block', false,
    jsonb_build_object(
      'value_hours', 40.0,
      'rule_class', 'aml_weekly_max_hours',
      'solver_readable', true,
      'description_no', 'Ukentlig maksgrense for alminnelig arbeidstid per AML §10-4'
    ),
    'Arbeidsmiljoloven §10-4 nr. 1'
  )
  ON CONFLICT (framework_id, code) DO NOTHING;

  -- AML §10 nr. 2: gjennomsnittlig ukentlig arbeidstid (gulv — ikke under 35t ved
  -- avtalte skiftordninger). Soft floor for fairness scoring, not a hard block in V1.
  INSERT INTO framework_rule (
    framework_id, code, rule_type, category,
    description, description_no,
    default_outcome, severity,
    outcome_overridable, evaluation_config, source_reference
  ) VALUES (
    fwk_id,
    'aml.scheduler.weekly_min_hours_floor',
    'aml_weekly_min_hours_floor',
    'working_time',
    'AML §10-4(2): Average 35 hours per week over scheduling period (minimum floor).',
    'AML §10-4(2): Gjennomsnittlig 35 timer per uke over planleggingsperioden (gulv).',
    'allowed', 'soft',  true,
    jsonb_build_object(
      'value_hours', 35.0,
      'rule_class', 'aml_weekly_min_hours_floor',
      'solver_readable', true,
      'description_no', 'Laveste gjennomsnittlige ukentlige arbeidstid per AML §10-4 nr. 2'
    ),
    'Arbeidsmiljoloven §10-4 nr. 2'
  )
  ON CONFLICT (framework_id, code) DO NOTHING;

  -- Riksavtalen §4.6: Minimum 8 timers hvile mellom vakter (tariff rest period).
  -- Stricter than AML §10-8 (11h) BUT hospitality rotation agreements can reduce
  -- AML to 8h; Riksavtalen sets 8h as the practical floor for the sector.
  INSERT INTO framework_rule (
    framework_id, code, rule_type, category,
    description, description_no,
    default_outcome, severity,
    outcome_overridable, evaluation_config, source_reference
  ) VALUES (
    fwk_id,
    'riksavtalen.scheduler.min_rest_hours',
    'tariff_min_rest_hours',
    'rest',
    'Riksavtalen §4.6: Minimum 8 hours rest between consecutive shifts.',
    'Riksavtalen §4.6: Minimum 8 timers hvile mellom sammenhengende vakter.',
    'blocked', 'hard_block', false,
    jsonb_build_object(
      'value_hours', 8.0,
      'rule_class', 'tariff_min_rest_hours',
      'solver_readable', true,
      'description_no', 'Minimumshvile mellom vakter per Riksavtalen §4.6 (8 timer)'
    ),
    'Riksavtalen for serveringsvirksomheter §4.6'
  )
  ON CONFLICT (framework_id, code) DO NOTHING;

  RAISE NOTICE 'Scheduler framework_rule seed complete (4 rows, hospitality.no.default.v1 fwk_id=%).',
    fwk_id;
END;
$$;

-- ── COMMENT: taxonomy note ───────────────────────────────────────────────────
-- rule_type values 'aml_daily_max_hours', 'aml_weekly_max_hours',
-- 'aml_weekly_min_hours_floor', 'tariff_min_rest_hours' are a distinct
-- sub-taxonomy from the 'gate' rule_type used by the legal/validate_aml_14_6
-- capability. The two sets coexist on the same framework_id without collision:
-- legal reads rule_type='gate'; scheduler reads the four solver-typed rules.
-- If the rule_type column is made an enum in a future migration, all four
-- values must be added. (L-0248: provenance in JSONB > enum extension).
