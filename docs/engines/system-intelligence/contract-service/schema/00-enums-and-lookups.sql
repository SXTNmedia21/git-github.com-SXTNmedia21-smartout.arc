-- =============================================================================
-- 00 — Enums og lookup-tabeller for Contracts Module
-- =============================================================================
-- Forutsetning: pgcrypto extension for gen_random_uuid()
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
--
-- Kjøres FØR alle andre contracts-module DDL.
-- Referanser: ADR-0001, ARCHITECTURE-contracts-module.md §3.

-- =============================================================================
-- ENUM-typer
-- =============================================================================

CREATE TYPE employment_role AS ENUM (
  'main',
  'secondary',
  'temporary_supplement'
);

CREATE TYPE contract_status AS ENUM (
  'draft',
  'pending_signature',
  'active',
  'superseded',
  'terminated',
  'expired'
);

CREATE TYPE employment_form AS ENUM (
  'permanent',
  'temporary',
  'apprentice',
  'practice',
  'freelance'
);

CREATE TYPE working_hours_scheme AS ENUM (
  'notShiftWork',
  'shiftWork',
  'offshoreWork',
  'continuousShiftWork335',
  'rotation336'
);

CREATE TYPE remuneration_type AS ENUM (
  'monthlyWage',
  'hourlyWage',
  'commissionOnly'
);

CREATE TYPE tax_card_type AS ENUM (
  'percentage',
  'table',
  'freecard'
);

CREATE TYPE obligation_type AS ENUM (
  'training_required',
  'certification_required',
  'activity_required',
  'attendance_required'
);

CREATE TYPE obligation_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'overdue',
  'waived'
);

CREATE TYPE pay_rule_type AS ENUM (
  'base',
  'overtime',
  'supplement',
  'tip',
  'commission',
  'other'
);

CREATE TYPE rate_type AS ENUM (
  'percent_of_base',
  'fixed_per_hour',
  'fixed_per_shift',
  'fixed_amount'
);

CREATE TYPE tip_distribution_method AS ENUM (
  'per_shift_hours',
  'per_position',
  'fixed_percentage',
  'pool'
);

CREATE TYPE sync_status_enum AS ENUM (
  'pending',
  'synced',
  'divergent',
  'not_synced'
);

CREATE TYPE field_classification AS ENUM (
  'material',
  'admin',
  'derived',
  'system'
);

CREATE TYPE amendment_status AS ENUM (
  'pending',
  'pending_employee_signature',
  'accepted',
  'rejected',
  'expired'
);

-- =============================================================================
-- Lookup-tabell: salary_type (Tripletex-aligned)
-- =============================================================================
-- Brukes av contract_pay_rule.salary_type_code som FK.
-- Kan utvides med nye lønnstyper uten DDL-endring.

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

COMMENT ON TABLE salary_type IS
  'Tripletex-aligned salaryType-koder. Strikt kontrollert verdimengde for contract_pay_rule.';

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

-- =============================================================================
-- Lookup-tabell: end_date_reason (A-melding-koder)
-- =============================================================================
-- Offisiell Skatteetaten-liste. Refresh ved årlig forskrifts-endring.

CREATE TABLE end_date_reason (
  code              text PRIMARY KEY,
  display_name_no   text NOT NULL,
  description_no    text,
  is_active         boolean NOT NULL DEFAULT true,
  effective_from    date NOT NULL,
  effective_until   date
);

COMMENT ON TABLE end_date_reason IS
  'A-melding-koder for opphør. Brukes av employment_contract.end_date_reason.';

INSERT INTO end_date_reason (code, display_name_no, description_no, effective_from) VALUES
  ('10', 'Oppsigelse fra arbeidsgiver',  'Arbeidsgiver sier opp arbeidsforholdet',     '2024-01-01'),
  ('20', 'Avskjed',                      'Avskjedigelse pga vesentlig mislighold',     '2024-01-01'),
  ('30', 'Oppsigelse fra arbeidstaker',  'Arbeidstaker sier opp selv',                 '2024-01-01'),
  ('40', 'Kontrakt utløpt',              'Midlertidig ansettelse utløpt',              '2024-01-01'),
  ('50', 'Pensjon',                      'Pensjonering',                               '2024-01-01'),
  ('60', 'Sluttavtale',                  'Avtalt opphør',                              '2024-01-01'),
  ('70', 'Permittering',                 'Midlertidig permittering',                   '2024-01-01'),
  ('80', 'Annet',                        'Annen grunn',                                '2024-01-01');

-- =============================================================================
-- Felt-klassifiserings-metadata (driver amendment-handler)
-- =============================================================================
-- Populert fra ADR-0001 felt-klassifisering. Kan endres uten DDL.

CREATE TABLE field_classification_metadata (
  table_name        text NOT NULL,
  column_name       text NOT NULL,
  classification    field_classification NOT NULL,
  conditional_rule  text,
  notes             text,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, column_name)
);

COMMENT ON TABLE field_classification_metadata IS
  'Driver amendment-handler. Hver kolonne i kontrakt-relevante tabeller har klassifisering '
  '(material/admin/derived/system) som styrer om endring krever re-signering.';

-- Seeding gjøres i 99-seed-classifications.sql etter alle tabeller er opprettet.
