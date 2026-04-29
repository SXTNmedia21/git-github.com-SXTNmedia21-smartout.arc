-- =============================================================================
-- *** SUPERSEDED — DO NOT DEPLOY ***
-- =============================================================================
-- Rejected by System Council 2026-04-29 with 9 P0 blockers + 6 P1 + 10 Lovsen amendments.
-- Superseded by: supabase/migrations/20260519100000_contracts_module_foundation.sql
-- ADRs: 0233, 0234, 0235, 0236
-- Kept for reference only.
-- =============================================================================
-- Migration 0001 — Contracts Module: Fase 0a Foundation (SUPERSEDED)
-- =============================================================================
-- Konsolidert atomisk migrasjon for hele Contracts-modulens DB-fundament.
-- Per ADR-0001-anbefaling: én transaksjon, all-or-nothing rollback,
-- riktig FK-rekkefølge.
--
-- Per-table reference DDL ligger i schema/-mappen for dokumentasjon.
-- Denne filen er deploy-artefakten.
--
-- Forutsetning:
--   - profile, policy, protocol, tariff, framework_rule, role_capability,
--     workspace, "user" eksisterer
--   - employment_contract, employee_payroll_profile, contract_template eksisterer
--     (utvides her, opprettes ikke fra scratch)
--   - pgcrypto extension aktivert

BEGIN;

-- =============================================================================
-- 1. ENUMs
-- =============================================================================

CREATE TYPE employment_role AS ENUM ('main', 'secondary', 'temporary_supplement');

CREATE TYPE contract_status AS ENUM (
  'draft', 'pending_signature', 'active', 'superseded', 'terminated', 'expired'
);

CREATE TYPE employment_form AS ENUM (
  'permanent', 'temporary', 'apprentice', 'practice', 'freelance'
);

CREATE TYPE working_hours_scheme AS ENUM (
  'notShiftWork', 'shiftWork', 'offshoreWork', 'continuousShiftWork335', 'rotation336'
);

CREATE TYPE remuneration_type AS ENUM ('monthlyWage', 'hourlyWage', 'commissionOnly');

CREATE TYPE tax_card_type AS ENUM ('percentage', 'table', 'freecard');

CREATE TYPE obligation_type AS ENUM (
  'training_required', 'certification_required', 'activity_required', 'attendance_required'
);

CREATE TYPE obligation_status AS ENUM (
  'pending', 'in_progress', 'completed', 'overdue', 'waived'
);

CREATE TYPE pay_rule_type AS ENUM (
  'base', 'overtime', 'supplement', 'tip', 'commission', 'other'
);

CREATE TYPE rate_type AS ENUM (
  'percent_of_base', 'fixed_per_hour', 'fixed_per_shift', 'fixed_amount'
);

CREATE TYPE tip_distribution_method AS ENUM (
  'per_shift_hours', 'per_position', 'fixed_percentage', 'pool'
);

CREATE TYPE sync_status_enum AS ENUM ('pending', 'synced', 'divergent', 'not_synced');

CREATE TYPE field_classification AS ENUM ('material', 'admin', 'derived', 'system');

CREATE TYPE amendment_status AS ENUM (
  'pending', 'pending_employee_signature', 'accepted', 'rejected', 'expired'
);

-- =============================================================================
-- 2. Lookup-tabeller
-- =============================================================================

CREATE TABLE salary_type (
  code              text PRIMARY KEY,
  display_name_no   text NOT NULL,
  display_name_en   text NOT NULL,
  rule_type         pay_rule_type NOT NULL,
  tripletex_code    text,
  is_active         boolean NOT NULL DEFAULT true,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

INSERT INTO salary_type (code, display_name_no, display_name_en, rule_type, tripletex_code) VALUES
  ('regularSalary',     'Grunnlønn',          'Regular salary',      'base',       'regularSalary'),
  ('overtime50',        '50% overtid',        '50% overtime',        'overtime',   'overtime50'),
  ('overtime100',       '100% overtid',       '100% overtime',       'overtime',   'overtime100'),
  ('eveningSupplement', 'Kveldstillegg',      'Evening supplement',  'supplement', 'eveningSupplement'),
  ('weekendSupplement', 'Helgetillegg',       'Weekend supplement',  'supplement', 'weekendSupplement'),
  ('holidaySupplement', 'Helligdagstillegg',  'Holiday supplement',  'supplement', 'holidaySupplement'),
  ('nightSupplement',   'Nattillegg',         'Night supplement',    'supplement', 'nightSupplement'),
  ('tips',              'Drikkepenger',       'Tips',                'tip',        'tips'),
  ('commission',        'Provisjon',          'Commission',          'commission', 'commission');

CREATE TABLE end_date_reason (
  code              text PRIMARY KEY,
  display_name_no   text NOT NULL,
  description_no    text,
  is_active         boolean NOT NULL DEFAULT true,
  effective_from    date NOT NULL,
  effective_until   date
);

INSERT INTO end_date_reason (code, display_name_no, description_no, effective_from) VALUES
  ('10', 'Oppsigelse fra arbeidsgiver',  'Arbeidsgiver sier opp arbeidsforholdet',     '2024-01-01'),
  ('20', 'Avskjed',                      'Avskjedigelse pga vesentlig mislighold',     '2024-01-01'),
  ('30', 'Oppsigelse fra arbeidstaker',  'Arbeidstaker sier opp selv',                 '2024-01-01'),
  ('40', 'Kontrakt utløpt',              'Midlertidig ansettelse utløpt',              '2024-01-01'),
  ('50', 'Pensjon',                      'Pensjonering',                               '2024-01-01'),
  ('60', 'Sluttavtale',                  'Avtalt opphør',                              '2024-01-01'),
  ('70', 'Permittering',                 'Midlertidig permittering',                   '2024-01-01'),
  ('80', 'Annet',                        'Annen grunn',                                '2024-01-01');

CREATE TABLE field_classification_metadata (
  table_name        text NOT NULL,
  column_name       text NOT NULL,
  classification    field_classification NOT NULL,
  conditional_rule  text,
  notes             text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, column_name)
);

-- =============================================================================
-- 3. pension_scheme (ny)
-- =============================================================================

CREATE TABLE pension_scheme (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                uuid NOT NULL REFERENCES workspace(id) ON DELETE RESTRICT,
  name                        text NOT NULL,
  provider                    text,
  scheme_type                 text NOT NULL,
  employer_contribution_pct   numeric(4,2) NOT NULL,
  employee_contribution_pct   numeric(4,2) NOT NULL DEFAULT 0,
  is_default                  boolean NOT NULL DEFAULT false,
  is_active                   boolean NOT NULL DEFAULT true,
  effective_from              date NOT NULL,
  effective_until             date,
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pension_employer_min_otp
    CHECK (employer_contribution_pct >= 2.00),
  CONSTRAINT pension_pct_range
    CHECK (employer_contribution_pct <= 100.00
       AND employee_contribution_pct >= 0
       AND employee_contribution_pct <= 100.00)
);

CREATE UNIQUE INDEX pension_scheme_one_default_per_workspace
  ON pension_scheme (workspace_id)
  WHERE is_default = true AND is_active = true;

CREATE INDEX pension_scheme_workspace_active
  ON pension_scheme (workspace_id, is_active);

-- =============================================================================
-- 4. profile (utvidelse)
-- =============================================================================

ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS tripletex_employee_id integer UNIQUE,
  ADD COLUMN IF NOT EXISTS tripletex_sync_status sync_status_enum NOT NULL DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS tripletex_last_synced_at timestamptz;

-- =============================================================================
-- 5. employment_contract (utvidelse)
-- =============================================================================

ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS employment_role employment_role NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS contract_status contract_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS superseded_by_contract_id uuid
    REFERENCES employment_contract(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trial_period_months smallint,
  ADD COLUMN IF NOT EXISTS notice_period_months smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS break_minutes_per_day smallint,
  ADD COLUMN IF NOT EXISTS training_rights text,
  ADD COLUMN IF NOT EXISTS variable_hours_arrangement text,
  ADD COLUMN IF NOT EXISTS end_date_reason text
    REFERENCES end_date_reason(code) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS overtime_cap_policy_id uuid
    REFERENCES policy(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signed_by_employee_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by_employer_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_url text;

CREATE UNIQUE INDEX IF NOT EXISTS employment_contract_one_active_main_per_profile
  ON employment_contract (profile_id)
  WHERE employment_role = 'main' AND contract_status = 'active';

ALTER TABLE employment_contract
  ADD CONSTRAINT employment_contract_temporary_requires_end_date
    CHECK (employment_form != 'temporary' OR end_date IS NOT NULL),
  ADD CONSTRAINT employment_contract_salary_matches_type
    CHECK (
      (remuneration_type = 'monthlyWage' AND monthly_salary IS NOT NULL)
      OR (remuneration_type = 'hourlyWage' AND hourly_rate IS NOT NULL)
      OR (remuneration_type = 'commissionOnly')
    ),
  ADD CONSTRAINT employment_contract_superseded_by_only_when_superseded
    CHECK (
      (contract_status = 'superseded' AND superseded_by_contract_id IS NOT NULL)
      OR (contract_status != 'superseded' AND superseded_by_contract_id IS NULL)
    ),
  ADD CONSTRAINT employment_contract_trial_period_max_6
    CHECK (trial_period_months IS NULL OR trial_period_months <= 6),
  ADD CONSTRAINT employment_contract_notice_period_positive
    CHECK (notice_period_months >= 0);

CREATE INDEX IF NOT EXISTS employment_contract_profile_status
  ON employment_contract (profile_id, contract_status);

CREATE INDEX IF NOT EXISTS employment_contract_active_by_date
  ON employment_contract (start_date, end_date)
  WHERE contract_status = 'active';

CREATE INDEX IF NOT EXISTS employment_contract_tariff
  ON employment_contract (tariff_id)
  WHERE tariff_id IS NOT NULL;

-- =============================================================================
-- 6. employee_payroll_profile (utvidelse)
-- =============================================================================

ALTER TABLE employee_payroll_profile
  ADD COLUMN IF NOT EXISTS payday_regular smallint,
  ADD COLUMN IF NOT EXISTS holiday_allowance_pct numeric(4,2) NOT NULL DEFAULT 12.00,
  ADD COLUMN IF NOT EXISTS extra_holiday_week boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_table_number text,
  ADD COLUMN IF NOT EXISTS tax_card_type tax_card_type,
  ADD COLUMN IF NOT EXISTS tax_percentage numeric(4,2),
  ADD COLUMN IF NOT EXISTS tax_card_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS tax_card_year smallint,
  ADD COLUMN IF NOT EXISTS pension_scheme_id uuid
    REFERENCES pension_scheme(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS pension_opt_out boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trade_union_member boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trade_union_fee_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS trade_union_name text,
  ADD COLUMN IF NOT EXISTS employee_number text,
  ADD COLUMN IF NOT EXISTS tripletex_employee_id integer UNIQUE,
  ADD COLUMN IF NOT EXISTS sync_status sync_status_enum NOT NULL DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

ALTER TABLE employee_payroll_profile
  ADD CONSTRAINT employee_payroll_profile_payday_range
    CHECK (payday_regular IS NULL OR (payday_regular BETWEEN 1 AND 31)),
  ADD CONSTRAINT employee_payroll_profile_holiday_allowance_range
    CHECK (holiday_allowance_pct >= 10.20 AND holiday_allowance_pct <= 20.00),
  ADD CONSTRAINT employee_payroll_profile_tax_pct_only_for_pct_card
    CHECK (
      (tax_card_type = 'percentage' AND tax_percentage IS NOT NULL)
      OR (tax_card_type IS NULL OR tax_card_type != 'percentage')
    ),
  ADD CONSTRAINT employee_payroll_profile_tax_pct_range
    CHECK (tax_percentage IS NULL OR (tax_percentage >= 0 AND tax_percentage <= 100));

CREATE UNIQUE INDEX IF NOT EXISTS employee_payroll_profile_profile_unique
  ON employee_payroll_profile (profile_id);

CREATE INDEX IF NOT EXISTS employee_payroll_profile_pension
  ON employee_payroll_profile (pension_scheme_id)
  WHERE pension_scheme_id IS NOT NULL AND pension_opt_out = false;

CREATE INDEX IF NOT EXISTS employee_payroll_profile_sync
  ON employee_payroll_profile (sync_status)
  WHERE sync_status IN ('pending', 'divergent');

-- =============================================================================
-- 7. contract_template (utvidelse)
-- =============================================================================

ALTER TABLE contract_template
  ADD COLUMN IF NOT EXISTS obligations_template jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_pay_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_tip_rule jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_by_template_id uuid
    REFERENCES contract_template(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE contract_template
  ADD CONSTRAINT contract_template_obligations_is_array
    CHECK (jsonb_typeof(obligations_template) = 'array'),
  ADD CONSTRAINT contract_template_pay_rules_is_array
    CHECK (jsonb_typeof(default_pay_rules) = 'array');

CREATE INDEX IF NOT EXISTS contract_template_active
  ON contract_template (workspace_id, is_active);

-- =============================================================================
-- 8. contract_pay_rule (ny)
-- =============================================================================

CREATE TABLE contract_pay_rule (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id         uuid NOT NULL
                        REFERENCES employment_contract(id) ON DELETE CASCADE,
  rule_type           pay_rule_type NOT NULL,
  salary_type_code    text NOT NULL
                        REFERENCES salary_type(code) ON DELETE RESTRICT,
  trigger_condition   jsonb NOT NULL DEFAULT '{}'::jsonb,
  rate_type           rate_type NOT NULL,
  rate_value          numeric(10,4) NOT NULL,
  source_text         text,
  framework_rule_id   uuid,
  effective_from      date NOT NULL,
  effective_until     date,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contract_pay_rule_trigger_is_object
    CHECK (jsonb_typeof(trigger_condition) = 'object'),
  CONSTRAINT contract_pay_rule_rate_value_range
    CHECK (rate_value >= 0 AND rate_value <= 1000000),
  CONSTRAINT contract_pay_rule_effective_order
    CHECK (effective_until IS NULL OR effective_until > effective_from),
  CONSTRAINT contract_pay_rule_percent_only_for_percent_type
    CHECK (rate_type != 'percent_of_base' OR (rate_value >= 0 AND rate_value <= 1000))
);

CREATE INDEX contract_pay_rule_contract_type_effective
  ON contract_pay_rule (contract_id, rule_type, effective_from);

CREATE INDEX contract_pay_rule_active_window
  ON contract_pay_rule (contract_id, effective_from, effective_until);

CREATE INDEX contract_pay_rule_framework
  ON contract_pay_rule (framework_rule_id)
  WHERE framework_rule_id IS NOT NULL;

-- =============================================================================
-- 9. contract_tip_rule (ny)
-- =============================================================================

CREATE TABLE contract_tip_rule (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id           uuid NOT NULL
                          REFERENCES employment_contract(id) ON DELETE CASCADE,
  distribution_method   tip_distribution_method NOT NULL,
  tip_share             numeric(3,2) NOT NULL DEFAULT 1.00,
  tip_share_modifier    text,
  tip_pool_id           uuid,
  taxable               boolean NOT NULL DEFAULT true,
  reporting_method      text NOT NULL DEFAULT '911',
  effective_from        date NOT NULL,
  effective_until       date,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contract_tip_rule_share_range
    CHECK (tip_share >= 0 AND tip_share <= 5.00),
  CONSTRAINT contract_tip_rule_pool_only_for_pool_method
    CHECK (
      (distribution_method = 'pool' AND tip_pool_id IS NOT NULL)
      OR (distribution_method != 'pool')
    ),
  CONSTRAINT contract_tip_rule_effective_order
    CHECK (effective_until IS NULL OR effective_until > effective_from)
);

CREATE INDEX contract_tip_rule_contract_active
  ON contract_tip_rule (contract_id, effective_from, effective_until);

CREATE INDEX contract_tip_rule_pool
  ON contract_tip_rule (tip_pool_id)
  WHERE tip_pool_id IS NOT NULL;

-- =============================================================================
-- 10. contract_obligation (ny)
-- =============================================================================

CREATE TABLE contract_obligation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id         uuid NOT NULL
                        REFERENCES employment_contract(id) ON DELETE CASCADE,
  obligation_type     obligation_type NOT NULL,
  policy_id           uuid REFERENCES policy(id) ON DELETE SET NULL,
  protocol_id         uuid REFERENCES protocol(id) ON DELETE SET NULL,
  due_within_days     smallint,
  due_at              date,
  is_blocker          boolean NOT NULL DEFAULT false,
  reference_text      text NOT NULL,
  status              obligation_status NOT NULL DEFAULT 'pending',
  started_at          timestamptz,
  completed_at        timestamptz,
  waived_at           timestamptz,
  waived_reason       text,
  waived_by_user_id   uuid REFERENCES "user"(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contract_obligation_waive_consistent
    CHECK (
      (status = 'waived' AND waived_at IS NOT NULL AND waived_reason IS NOT NULL AND waived_by_user_id IS NOT NULL)
      OR (status != 'waived' AND waived_at IS NULL)
    ),
  CONSTRAINT contract_obligation_completed_consistent
    CHECK (
      (status = 'completed' AND completed_at IS NOT NULL)
      OR (status != 'completed' AND completed_at IS NULL)
    ),
  CONSTRAINT contract_obligation_has_target
    CHECK (policy_id IS NOT NULL OR protocol_id IS NOT NULL)
);

CREATE OR REPLACE FUNCTION compute_obligation_due_at()
RETURNS trigger AS $$
DECLARE
  contract_start_date date;
BEGIN
  IF NEW.due_within_days IS NULL THEN
    NEW.due_at := NULL;
  ELSE
    SELECT start_date INTO contract_start_date
    FROM employment_contract
    WHERE id = NEW.contract_id;
    NEW.due_at := contract_start_date + NEW.due_within_days;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER contract_obligation_compute_due_at
  BEFORE INSERT OR UPDATE OF due_within_days, contract_id ON contract_obligation
  FOR EACH ROW
  EXECUTE FUNCTION compute_obligation_due_at();

CREATE INDEX contract_obligation_blocker_lookup
  ON contract_obligation (contract_id, status)
  WHERE is_blocker = true AND status IN ('pending', 'in_progress', 'overdue');

CREATE INDEX contract_obligation_status_due
  ON contract_obligation (status, due_at)
  WHERE status IN ('pending', 'in_progress');

CREATE INDEX contract_obligation_due_at
  ON contract_obligation (due_at)
  WHERE status = 'pending' AND due_at IS NOT NULL;

-- =============================================================================
-- 11. contract_amendment (ny)
-- =============================================================================

CREATE TABLE contract_amendment (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id                 uuid NOT NULL
                                REFERENCES employment_contract(id) ON DELETE RESTRICT,
  amendment_date              date NOT NULL DEFAULT CURRENT_DATE,
  change_summary              text NOT NULL,
  field_changes               jsonb NOT NULL,
  requires_resigning          boolean NOT NULL,
  status                      amendment_status NOT NULL DEFAULT 'pending',
  signed_by_employee_at       timestamptz,
  signed_by_employer_at       timestamptz,
  rejected_at                 timestamptz,
  rejection_reason            text,
  expires_at                  timestamptz,
  pdf_url                     text,
  created_by_user_id          uuid NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contract_amendment_field_changes_is_array
    CHECK (jsonb_typeof(field_changes) = 'array'),
  CONSTRAINT contract_amendment_accepted_requires_signatures
    CHECK (
      status != 'accepted'
      OR (signed_by_employee_at IS NOT NULL AND signed_by_employer_at IS NOT NULL)
    ),
  CONSTRAINT contract_amendment_rejected_requires_reason
    CHECK (
      status != 'rejected'
      OR (rejected_at IS NOT NULL AND rejection_reason IS NOT NULL)
    )
);

CREATE INDEX contract_amendment_contract_status
  ON contract_amendment (contract_id, status);

CREATE INDEX contract_amendment_pending_employee
  ON contract_amendment (status, expires_at)
  WHERE status = 'pending_employee_signature';

CREATE INDEX contract_amendment_date
  ON contract_amendment (amendment_date DESC);

-- =============================================================================
-- 12. Seed: field_classification_metadata
-- =============================================================================
-- Innholdet er identisk med schema/99-seed-classifications.sql.
-- Her inkludert for atomisk deploy. Se den filen for full referanse.

\i 99-seed-classifications.sql
-- (Fjern \i hvis ikke psql; kopier inn direkte ellers — se schema/99-seed-classifications.sql)

COMMIT;

-- =============================================================================
-- Rollback (kjør som separat transaction ved trøbbel)
-- =============================================================================
-- BEGIN;
-- DROP TABLE contract_amendment;
-- DROP TABLE contract_obligation;
-- DROP TABLE contract_tip_rule;
-- DROP TABLE contract_pay_rule;
-- DROP TABLE field_classification_metadata;
-- DROP TABLE end_date_reason;
-- DROP TABLE salary_type;
-- DROP TABLE pension_scheme;
-- ALTER TABLE contract_template DROP COLUMN obligations_template, ...;
-- ALTER TABLE employee_payroll_profile DROP COLUMN payday_regular, ...;
-- ALTER TABLE employment_contract DROP COLUMN employment_role, ...;
-- ALTER TABLE profile DROP COLUMN tripletex_employee_id, ...;
-- DROP TYPE amendment_status, field_classification, sync_status_enum,
--           tip_distribution_method, rate_type, pay_rule_type,
--           obligation_status, obligation_type, tax_card_type,
--           remuneration_type, working_hours_scheme, employment_form,
--           contract_status, employment_role;
-- COMMIT;
