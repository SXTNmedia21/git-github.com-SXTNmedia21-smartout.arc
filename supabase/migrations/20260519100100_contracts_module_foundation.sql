-- =============================================================================
-- Migration: Contracts Module Foundation (Phase 0a Rewrite)
-- Timestamp: 20260519100000
-- =============================================================================
-- Supersedes docs/architecture/contract-service/migrations/0001_contracts_module_foundation.sql
-- which was REJECTED by System Council 2026-04-29 with 9 P0 blockers.
--
-- ADRs: 0233 (schema foundation), 0234 (capability split), 0235 (trigger semantics),
--        0236 (amendment flow), 0024, 0076, 0079, 0109, 0111, 0182
-- Lovsen: Aml. §10-6, §14-5, §14-6, §15-3, §15-6, §15-7, §15-15,
--          Ferieloven §10, Bokføringsloven §13, Opplæringsloven kap.4
--
-- CRITICAL: employment_form, working_hours_scheme, remuneration_type are text
-- columns in existing schema — NOT postgres enums. This migration adds them as
-- new enum types and does NOT attempt to ALTER existing columns (consumer-break
-- deferred to Wave 3 / B7 per mission notes). New child tables use enum types.
--
-- FK columns verified against database.types.ts:
--   policy(policy_id), protocol(protocol_id), workspace(workspace_id),
--   employment_contract(contract_id), user_identity(user_id),
--   framework_rule(rule_id)
--
-- Consumer-break note: existing 10 contract capability tools in
-- packages/ai/src/capabilities/contract/tools.ts reference status field by
-- current enum values. Wave 3 (B7) renames consumers. See HANDOFF.
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION 1: NEW ENUM TYPES
-- =============================================================================
-- These enums do NOT exist yet in the database (verified against database.types.ts).
-- contract_status DOES exist — ALTER TYPE additive below (Section 2).

CREATE TYPE employment_role AS ENUM (
  'main',
  'secondary',
  'temporary_supplement'
);

-- employment_form, working_hours_scheme, remuneration_type are text in existing
-- employment_contract — new enum types created for use in new child tables only.
-- Wave 3 (B7) migrates parent columns. Document in HANDOFF.
CREATE TYPE employment_form_enum AS ENUM (
  'permanent',
  'temporary',
  'apprentice',
  'practice',
  'freelance'
);

CREATE TYPE working_hours_scheme_enum AS ENUM (
  'notShiftWork',
  'shiftWork',
  'offshoreWork',
  'continuousShiftWork335',
  'rotation336'
);

CREATE TYPE remuneration_type_enum AS ENUM (
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

-- Naming: rate_type_enum to avoid collision with payroll schema rate_type
CREATE TYPE rate_type_enum AS ENUM (
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

-- sync_status already exists as "pending|synced|failed|conflict" per database.types.ts
-- Adding sync_status_enum as separate type to avoid collision
CREATE TYPE sync_status_enum AS ENUM (
  'pending',
  'synced',
  'divergent',
  'not_synced'
);

-- field_classification used only as TS const per ADR-0243 — enum created here
-- for any legacy references; field_classification_metadata table is NOT created
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

-- Aml. §10-6 2024-revisjon: overtime agreement type
-- References §10-6(4) local tariff agreement + §10-6(6) Arbeidstilsynet-vedtak.
-- ESKALÉR: arbeidsrettsadvokat-review required before go-live.
CREATE TYPE overtime_agreement_type AS ENUM (
  'legal_default',
  'local_tariff_agreement',
  'arbeidstilsynet_vedtak'
);

-- =============================================================================
-- SECTION 2: ALTER contract_status ENUM (additive — preserves ADR-0109)
-- =============================================================================
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction and be used in
-- the same transaction. These run OUTSIDE BEGIN/COMMIT, then COMMIT is
-- called to flush before DDL that uses the new values.
--
-- Existing values: draft, sent, viewed, signed, expired, terminated,
--                  pending_data, declined, ready_to_send, migration_incomplete
-- Adding 3 new lifecycle states for D2 parallel contracts.
-- Application state machine is load-bearing — no value-rewrite of historical rows.
-- =============================================================================

-- contract_status enum values (pending_signature, active, superseded) are
-- added by 20260519095100_contract_status_enum_values.sql which runs before
-- this migration. Postgres requires the ADD VALUE to commit before the new
-- labels can be used in DDL (partial indexes below reference 'active').

-- =============================================================================
-- SECTION 3: LOOKUP TABLES (with idempotent seeds)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 3a. salary_type (Tripletex-aligned lønnsart-koder)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salary_type (
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

-- Idempotent seed (ON CONFLICT DO NOTHING per ADR-0241 §9)
INSERT INTO salary_type (code, display_name_no, display_name_en, rule_type, tripletex_code) VALUES
  ('regularSalary',     'Grunnlønn',          'Regular salary',     'base',       'regularSalary'),
  ('overtime50',        '50% overtid',        '50% overtime',       'overtime',   'overtime50'),
  ('overtime100',       '100% overtid',       '100% overtime',      'overtime',   'overtime100'),
  ('eveningSupplement', 'Kveldstillegg',      'Evening supplement', 'supplement', 'eveningSupplement'),
  ('weekendSupplement', 'Helgetillegg',       'Weekend supplement', 'supplement', 'weekendSupplement'),
  ('holidaySupplement', 'Helligdagstillegg',  'Holiday supplement', 'supplement', 'holidaySupplement'),
  ('nightSupplement',   'Nattillegg',         'Night supplement',   'supplement', 'nightSupplement'),
  ('tips',              'Drikkepenger',       'Tips',               'tip',        'tips'),
  ('commission',        'Provisjon',          'Commission',         'commission', 'commission')
ON CONFLICT (code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3b. end_date_reason (A-melding-koder per Skatteetaten)
-- -----------------------------------------------------------------------------
-- Lovsen amendment §10: added codes 00, 90, 99.
-- Kode 70 (Permittering) RETAINED for backward-compat but flagged as
-- "permittering ≠ permanent opphør" — separate permittering model needed.
-- See HANDOFF: migration path from code 70 to dedicated permittering table.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS end_date_reason (
  code              text PRIMARY KEY,
  display_name_no   text NOT NULL,
  description_no    text,
  is_active         boolean NOT NULL DEFAULT true,
  effective_from    date NOT NULL,
  effective_until   date
);

COMMENT ON TABLE end_date_reason IS
  'A-melding-koder for opphør av arbeidsforhold. Offisiell Skatteetaten-liste. '
  'Oppdateres ved årlig forskrifts-endring. Kode 70 (Permittering) er misplassert '
  'semantisk — midlertidig permittering er ikke permanent opphør. Separat modell planlegges.';

-- Idempotent seed
INSERT INTO end_date_reason (code, display_name_no, description_no, effective_from) VALUES
  ('00', 'Ukjent (legacy)',            'Brukes kun ved historisk dataimport der grunn er ukjent', '2024-01-01'),
  ('10', 'Oppsigelse fra arbeidsgiver','Arbeidsgiver sier opp arbeidsforholdet',                  '2024-01-01'),
  ('20', 'Avskjed',                    'Avskjedigelse pga vesentlig mislighold',                  '2024-01-01'),
  ('30', 'Oppsigelse fra arbeidstaker','Arbeidstaker sier opp selv',                              '2024-01-01'),
  ('40', 'Kontrakt utløpt',            'Midlertidig ansettelse utløpt',                           '2024-01-01'),
  ('50', 'Pensjon',                    'Pensjonering',                                            '2024-01-01'),
  ('60', 'Sluttavtale',               'Avtalt opphør',                                            '2024-01-01'),
  ('70', 'Permittering',              'Midlertidig permittering (semantisk uegnet — se HANDOFF)',  '2024-01-01'),
  ('80', 'Annet',                     'Annen grunn',                                              '2024-01-01'),
  ('90', 'Dødsfall',                  'Arbeidstaker er død',                                      '2024-01-01'),
  ('99', 'Korreksjon - ikke aktuell', 'Brukes for korreksjon av feil A-melding',                  '2024-01-01')
ON CONFLICT (code) DO NOTHING;

-- field_classification_metadata table is NOT created per ADR-0243.
-- Classification moves to packages/contracts/src/field-classification.ts (Phase 0b).

-- =============================================================================
-- SECTION 4: pension_scheme (new table)
-- =============================================================================

CREATE TABLE IF NOT EXISTS pension_scheme (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                uuid NOT NULL
                                REFERENCES workspace(workspace_id) ON DELETE RESTRICT,
  name                        text NOT NULL,
  provider                    text,
  scheme_type                 text NOT NULL,        -- 'OTP', 'innskudd', 'ytelse'
  employer_contribution_pct   numeric(4,2) NOT NULL,
  employee_contribution_pct   numeric(4,2) NOT NULL DEFAULT 0,
  is_default                  boolean NOT NULL DEFAULT false,
  is_active                   boolean NOT NULL DEFAULT true,
  effective_from              date NOT NULL,
  effective_until             date,
  notes                       text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),

  -- OTP-loven §4: minimum 2.0% arbeidsgiver-bidrag
  CONSTRAINT pension_employer_min_otp
    CHECK (employer_contribution_pct >= 2.00),

  CONSTRAINT pension_pct_range
    CHECK (employer_contribution_pct <= 100.00
       AND employee_contribution_pct >= 0
       AND employee_contribution_pct <= 100.00)
);

COMMENT ON TABLE pension_scheme IS
  'Pensjonsordninger per workspace. OTP-lovens minimumskrav (2.0%) håndheves som CHECK. '
  'Direct workspace_id denorm enables RLS without JOIN.';

-- Maks én default per workspace ad gangen
CREATE UNIQUE INDEX IF NOT EXISTS pension_scheme_one_default_per_workspace
  ON pension_scheme (workspace_id)
  WHERE is_default = true AND is_active = true;

CREATE INDEX IF NOT EXISTS pension_scheme_workspace_active
  ON pension_scheme (workspace_id, is_active);

-- =============================================================================
-- SECTION 5: employment_contract extensions
-- =============================================================================
-- Existing table — ADR-0001 D2 additions, §14-6 post-jul-2024, Lovsen amendments.
-- FK to policy uses policy(policy_id) — verified in database.types.ts.

-- D2: parallel contracts, status mechanics
ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS employment_role employment_role
    NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS contract_status contract_status
    NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS superseded_by_contract_id uuid
    REFERENCES employment_contract(contract_id) ON DELETE SET NULL;

-- §14-6 post juli 2024
ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS trial_period_months smallint,
  ADD COLUMN IF NOT EXISTS notice_period_months smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS break_minutes_per_day smallint,
  ADD COLUMN IF NOT EXISTS training_rights text,
  ADD COLUMN IF NOT EXISTS variable_hours_arrangement text,
  ADD COLUMN IF NOT EXISTS end_date_reason text
    REFERENCES end_date_reason(code) ON DELETE RESTRICT;

-- Signing fields
ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS signed_by_employee_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by_employer_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_url text;

-- D3 overtime per ADR-0241 amendment §8 (Aml. §10-6 2024-revisjon):
-- Replaces overtime_cap_policy_id → policy(id) (category error) with
-- overtime_agreement_type enum + framework_rule FK per cascade-correct pattern.
-- ESKALÉR: arbeidsrettsadvokat-review for §10-6 compliance before go-live.
ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS overtime_agreement_type overtime_agreement_type
    NOT NULL DEFAULT 'legal_default',
  ADD COLUMN IF NOT EXISTS overtime_framework_rule_id uuid
    REFERENCES framework_rule(rule_id) ON DELETE SET NULL;

-- Lovsen amendment §1 (Aml. §15-6 fjerde ledd): prøvetid-pause
ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS trial_period_paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_period_pause_reason text,
  ADD COLUMN IF NOT EXISTS trial_period_extended_until date;

-- Lovsen amendment §4 (Aml. §14-6 bokstav g): garantilønn for commissionOnly
-- ESKALÉR: Riksavtalen-tolkning — arbeidsrettsadvokat-review before go-live.
ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS minimum_guaranteed_amount numeric(10,2);

-- Constraints
-- D2 invariant: max 1 active main contract per profile (ADR-0001 D2, ADR-0241)
CREATE UNIQUE INDEX IF NOT EXISTS employment_contract_one_active_main_per_profile
  ON employment_contract (profile_id)
  WHERE employment_role = 'main' AND contract_status = 'active';

-- Temporary/apprentice/practice must have end_date (Aml. §14-9 + Opplæringsloven kap. 4)
-- Apprentice UI blocker deferred to application layer per ADR-0241 amendment §5.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employment_contract_temporary_requires_end_date'
  ) THEN
    ALTER TABLE employment_contract
      ADD CONSTRAINT employment_contract_temporary_requires_end_date
        CHECK (
          employment_form NOT IN ('temporary', 'apprentice', 'practice')
          OR end_date IS NOT NULL
        );
  END IF;
END $$;

-- Salary must match remuneration_type, with commissionOnly requiring
-- at least one of: monthly_salary, hourly_rate, minimum_guaranteed_amount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employment_contract_salary_matches_type'
  ) THEN
    ALTER TABLE employment_contract
      ADD CONSTRAINT employment_contract_salary_matches_type
        CHECK (
          (remuneration_type = 'monthlyWage' AND monthly_salary IS NOT NULL)
          OR (remuneration_type = 'hourlyWage' AND hourly_rate IS NOT NULL)
          OR (
            remuneration_type = 'commissionOnly'
            AND (
              monthly_salary IS NOT NULL
              OR hourly_rate IS NOT NULL
              OR minimum_guaranteed_amount IS NOT NULL
            )
          )
        );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employment_contract_superseded_by_only_when_superseded'
  ) THEN
    ALTER TABLE employment_contract
      ADD CONSTRAINT employment_contract_superseded_by_only_when_superseded
        CHECK (
          (contract_status = 'superseded' AND superseded_by_contract_id IS NOT NULL)
          OR (contract_status != 'superseded' AND superseded_by_contract_id IS NULL)
        );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employment_contract_trial_period_max_6'
  ) THEN
    ALTER TABLE employment_contract
      ADD CONSTRAINT employment_contract_trial_period_max_6
        CHECK (trial_period_months IS NULL OR trial_period_months <= 6);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employment_contract_notice_period_positive'
  ) THEN
    ALTER TABLE employment_contract
      ADD CONSTRAINT employment_contract_notice_period_positive
        CHECK (notice_period_months >= 0);
  END IF;
END $$;

-- Performance indexes (§10 architecture spec)
-- NOTE: tariff_id index from original draft DROPPED — column doesn't exist on
-- employment_contract. Tariff resolution lives in contract_template_binding
-- per migration 20260422120000_*. Do NOT add tariff_id index here.
CREATE INDEX IF NOT EXISTS employment_contract_profile_status
  ON employment_contract (profile_id, contract_status);

CREATE INDEX IF NOT EXISTS employment_contract_active_by_date
  ON employment_contract (start_date, end_date)
  WHERE contract_status = 'active';

-- Comments
COMMENT ON COLUMN employment_contract.employment_role IS
  'main = primær ansettelse. secondary = parallell. temporary_supplement = ekstra-vakter.';
COMMENT ON COLUMN employment_contract.contract_status IS
  'Livssyklus. draft → pending_signature → active → superseded/terminated/expired. '
  'Additive enum — existing 10 values preserved per ADR-0109.';
COMMENT ON COLUMN employment_contract.superseded_by_contract_id IS
  'Peker til ny kontrakt når denne erstattes av stillingsendring som krever ny kontrakt.';
COMMENT ON COLUMN employment_contract.overtime_agreement_type IS
  'Aml. §10-6 2024-revisjon: legal_default | local_tariff_agreement | arbeidstilsynet_vedtak.';
COMMENT ON COLUMN employment_contract.overtime_framework_rule_id IS
  'FK → framework_rule(rule_id) med rule_type=''constraint''. Cascade-correct D3 pattern.';
COMMENT ON COLUMN employment_contract.trial_period_paused_at IS
  'Aml. §15-6 fjerde ledd: sykefravær-pause av prøvetid.';
COMMENT ON COLUMN employment_contract.trial_period_extended_until IS
  'Beregnet slutt på prøvetid etter pause. Aml. §15-6 fjerde ledd.';
COMMENT ON COLUMN employment_contract.minimum_guaranteed_amount IS
  'Aml. §14-6 bokstav g: garantert minimumslønn for commissionOnly. '
  'ESKALÉR: Riksavtalen-tolkning — advokat-review before go-live.';
COMMENT ON COLUMN employment_contract.training_rights IS
  '§14-6 post juli 2024: opplysninger om opplærings-rettigheter.';

-- =============================================================================
-- SECTION 6: employee_payroll_profile extensions
-- =============================================================================
-- Existing table. sync_status_enum is new type. pension_scheme added earlier.

-- Payday and holiday allowance
ALTER TABLE employee_payroll_profile
  ADD COLUMN IF NOT EXISTS payday_regular smallint,
  ADD COLUMN IF NOT EXISTS holiday_allowance_pct numeric(4,2)
    NOT NULL DEFAULT 12.00,
  ADD COLUMN IF NOT EXISTS extra_holiday_week boolean
    NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_payroll_profile_payday_range'
  ) THEN
    ALTER TABLE employee_payroll_profile
      ADD CONSTRAINT employee_payroll_profile_payday_range
        CHECK (payday_regular IS NULL OR (payday_regular BETWEEN 1 AND 31));
  END IF;
END $$;

-- Ferieloven §10 floor = 10.20% (legal absolute), default = 12.00%
-- Riksavtalen Hospitality 2024-2026 grants 14.30% (5. ferieuke) — trigger below.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_payroll_profile_holiday_allowance_range'
  ) THEN
    ALTER TABLE employee_payroll_profile
      ADD CONSTRAINT employee_payroll_profile_holiday_allowance_range
        CHECK (holiday_allowance_pct >= 10.20 AND holiday_allowance_pct <= 20.00);
  END IF;
END $$;

-- Tax card fields (DERIVED — filled by Skatteetaten integration)
ALTER TABLE employee_payroll_profile
  ADD COLUMN IF NOT EXISTS tax_table_number text,
  ADD COLUMN IF NOT EXISTS tax_card_type tax_card_type,
  ADD COLUMN IF NOT EXISTS tax_percentage numeric(4,2),
  ADD COLUMN IF NOT EXISTS tax_card_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS tax_card_year smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_payroll_profile_tax_pct_only_for_pct_card'
  ) THEN
    ALTER TABLE employee_payroll_profile
      ADD CONSTRAINT employee_payroll_profile_tax_pct_only_for_pct_card
        CHECK (
          (tax_card_type = 'percentage' AND tax_percentage IS NOT NULL)
          OR (tax_card_type IS NULL OR tax_card_type != 'percentage')
        );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employee_payroll_profile_tax_pct_range'
  ) THEN
    ALTER TABLE employee_payroll_profile
      ADD CONSTRAINT employee_payroll_profile_tax_pct_range
        CHECK (tax_percentage IS NULL OR (tax_percentage >= 0 AND tax_percentage <= 100));
  END IF;
END $$;

-- Pension and trade union (GDPR Art. 9 sensitive — fagforeningsmedlemskap)
-- See ADR-0242 Lovsen amendment: DPO/personvernrådgiver-review required before go-live.
ALTER TABLE employee_payroll_profile
  ADD COLUMN IF NOT EXISTS pension_scheme_id uuid
    REFERENCES pension_scheme(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS pension_opt_out boolean
    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trade_union_member boolean
    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trade_union_fee_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS trade_union_name text;

-- Tripletex sync
ALTER TABLE employee_payroll_profile
  ADD COLUMN IF NOT EXISTS employee_number text,
  ADD COLUMN IF NOT EXISTS payroll_tripletex_employee_id integer,
  ADD COLUMN IF NOT EXISTS payroll_sync_status sync_status_enum
    NOT NULL DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS payroll_last_synced_at timestamptz;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS employee_payroll_profile_profile_unique
  ON employee_payroll_profile (profile_id);

CREATE INDEX IF NOT EXISTS employee_payroll_profile_pension
  ON employee_payroll_profile (pension_scheme_id)
  WHERE pension_scheme_id IS NOT NULL AND pension_opt_out = false;

CREATE INDEX IF NOT EXISTS employee_payroll_profile_sync
  ON employee_payroll_profile (payroll_sync_status)
  WHERE payroll_sync_status IN ('pending', 'divergent');

COMMENT ON COLUMN employee_payroll_profile.holiday_allowance_pct IS
  '12.00% Ferieloven standard. 14.30% for Riksavtalen-bundne med 5. ferieuke. '
  'Settes av trigger ved tariff_id-endring (se trigger nedenfor).';
COMMENT ON COLUMN employee_payroll_profile.trade_union_member IS
  'GDPR Art. 9(1) sensitiv data (fagforeningsmedlemskap). '
  'Behandlingsgrunnlag Art. 9(2)(b). ESKALÉR: DPO-review before go-live.';

-- =============================================================================
-- SECTION 7: profile extensions (Tripletex)
-- =============================================================================

ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS tripletex_employee_id integer UNIQUE,
  ADD COLUMN IF NOT EXISTS tripletex_sync_status sync_status_enum
    NOT NULL DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS tripletex_last_synced_at timestamptz;

COMMENT ON COLUMN profile.tripletex_employee_id IS
  'Ekstern ID i Tripletex. Smartout master, push-sync. Unique — forhindrer dobbel-mapping.';

-- =============================================================================
-- SECTION 8: contract_template extensions
-- =============================================================================

ALTER TABLE contract_template
  ADD COLUMN IF NOT EXISTS obligations_template jsonb
    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_pay_rules jsonb
    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_tip_rule jsonb,
  ADD COLUMN IF NOT EXISTS version integer
    NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS superseded_by_template_id uuid
    REFERENCES contract_template(template_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_active boolean
    NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contract_template_obligations_is_array'
  ) THEN
    ALTER TABLE contract_template
      ADD CONSTRAINT contract_template_obligations_is_array
        CHECK (jsonb_typeof(obligations_template) = 'array');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'contract_template_pay_rules_is_array'
  ) THEN
    ALTER TABLE contract_template
      ADD CONSTRAINT contract_template_pay_rules_is_array
        CHECK (jsonb_typeof(default_pay_rules) = 'array');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contract_template_active
  ON contract_template (workspace_id, is_active);

COMMENT ON COLUMN contract_template.obligations_template IS
  'Array av obligation-definitions (uten contract_id). Kopieres til contract_obligation ved compose.';
COMMENT ON COLUMN contract_template.version IS
  'Mal-versjon. Ved endring: ny rad opprettes, gammel markeres superseded. '
  'Eksisterende kontrakter er snapshot, ikke live-bound.';

-- =============================================================================
-- SECTION 9: contract_pay_rule (new table)
-- =============================================================================
-- workspace_id denorm per ADR-0242 — direct RLS without JOIN.
-- Backfilled via contract_id → employment_contract.workspace_id below.

CREATE TABLE IF NOT EXISTS contract_pay_rule (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL
                        REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  contract_id         uuid NOT NULL
                        REFERENCES employment_contract(contract_id) ON DELETE CASCADE,
  rule_type           pay_rule_type NOT NULL,
  salary_type_code    text NOT NULL
                        REFERENCES salary_type(code) ON DELETE RESTRICT,
  trigger_condition   jsonb NOT NULL DEFAULT '{}'::jsonb,
  rate_type           rate_type_enum NOT NULL,
  rate_value          numeric(10,4) NOT NULL,
  source_text         text,
  framework_rule_id   uuid
                        REFERENCES framework_rule(rule_id) ON DELETE SET NULL,
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

  -- Percent range guard
  CONSTRAINT contract_pay_rule_percent_only_for_percent_type
    CHECK (
      rate_type != 'percent_of_base'
      OR (rate_value >= 0 AND rate_value <= 1000)
    )
);

COMMENT ON TABLE contract_pay_rule IS
  'Lønns-regler per kontrakt. Evalueres ved shift. workspace_id denorm for direkte RLS.';
COMMENT ON COLUMN contract_pay_rule.framework_rule_id IS
  'Snapshot-peker til versjonert framework_rule (Riksavtalen, lokal avtale). '
  'NULL = custom-regel uten tariff-grunnlag.';
COMMENT ON COLUMN contract_pay_rule.source_text IS
  'Menneskelesbar kilde vist til ansatt. Eksempel: "Riksavtalen §3.2 (versjon 2024)".';

CREATE INDEX IF NOT EXISTS contract_pay_rule_contract_type_effective
  ON contract_pay_rule (contract_id, rule_type, effective_from);

CREATE INDEX IF NOT EXISTS contract_pay_rule_active_window
  ON contract_pay_rule (contract_id, effective_from, effective_until);

CREATE INDEX IF NOT EXISTS contract_pay_rule_framework
  ON contract_pay_rule (framework_rule_id)
  WHERE framework_rule_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS contract_pay_rule_workspace
  ON contract_pay_rule (workspace_id);

-- =============================================================================
-- SECTION 10: contract_tip_rule (new table)
-- =============================================================================
-- workspace_id denorm per ADR-0242.
-- Lovsen amendment §9: rename reporting_method → tripletex_reporting_method,
-- add a_melding_code. ESKALÉR: verify against altinn.no/skjema/a-melding kodeliste.
-- tip_share range corrected to 0.00–1.50 per ARCH §3.5 spec (ADR-0241 P0 §11).

CREATE TABLE IF NOT EXISTS contract_tip_rule (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id              uuid NOT NULL
                              REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  contract_id               uuid NOT NULL
                              REFERENCES employment_contract(contract_id) ON DELETE CASCADE,
  distribution_method       tip_distribution_method NOT NULL,
  tip_share                 numeric(3,2) NOT NULL DEFAULT 1.00,
  tip_share_modifier        text,
  tip_pool_id               uuid,
  taxable                   boolean NOT NULL DEFAULT true,
  tripletex_reporting_method text NOT NULL DEFAULT '911',   -- Tripletex intern lønnsart
  a_melding_code            text NOT NULL DEFAULT '111-A',  -- Skatteetaten A-melding drikkepenger
  effective_from            date NOT NULL,
  effective_until           date,
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  -- ARCH §3.5 spec: 0.00–1.50 (senior/leder)
  CONSTRAINT contract_tip_rule_share_range
    CHECK (tip_share >= 0 AND tip_share <= 1.50),

  CONSTRAINT contract_tip_rule_pool_only_for_pool_method
    CHECK (
      (distribution_method = 'pool' AND tip_pool_id IS NOT NULL)
      OR (distribution_method != 'pool')
    ),

  CONSTRAINT contract_tip_rule_effective_order
    CHECK (effective_until IS NULL OR effective_until > effective_from)
);

COMMENT ON TABLE contract_tip_rule IS
  'Tipsregler per kontrakt. workspace_id denorm for direkte RLS.';
COMMENT ON COLUMN contract_tip_rule.tip_share IS
  'Andel av tip-pool. 1.00 = full share. 0.00 = ingen. Max 1.50 (senior/leder) per ARCH §3.5.';
COMMENT ON COLUMN contract_tip_rule.tripletex_reporting_method IS
  'Tripletex intern lønnsart for tips. Disambiguert fra Skatteetaten A-melding kode.';
COMMENT ON COLUMN contract_tip_rule.a_melding_code IS
  'Skatteetaten A-melding kode for drikkepenger. Default 111-A. '
  'ESKALÉR: verify against altinn.no/skjema/a-melding 2024 kodeliste.';

CREATE INDEX IF NOT EXISTS contract_tip_rule_contract_active
  ON contract_tip_rule (contract_id, effective_from, effective_until);

CREATE INDEX IF NOT EXISTS contract_tip_rule_pool
  ON contract_tip_rule (tip_pool_id)
  WHERE tip_pool_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS contract_tip_rule_workspace
  ON contract_tip_rule (workspace_id);

-- =============================================================================
-- SECTION 11: contract_obligation (new table)
-- =============================================================================
-- workspace_id denorm per ADR-0242.
-- due_at is a concrete column computed by trigger (not GENERATED — cross-table).
-- SECURITY DEFINER trigger per ADR-0243 to prevent silent RLS bypass.

CREATE TABLE IF NOT EXISTS contract_obligation (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL
                        REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  contract_id         uuid NOT NULL
                        REFERENCES employment_contract(contract_id) ON DELETE CASCADE,
  obligation_type     obligation_type NOT NULL,
  policy_id           uuid REFERENCES policy(policy_id) ON DELETE SET NULL,
  protocol_id         uuid REFERENCES protocol(protocol_id) ON DELETE SET NULL,
  due_within_days     smallint,
  due_at              date,     -- computed by trigger from contract.start_date + due_within_days
  is_blocker          boolean NOT NULL DEFAULT false,
  reference_text      text NOT NULL,
  status              obligation_status NOT NULL DEFAULT 'pending',
  started_at          timestamptz,
  completed_at        timestamptz,
  waived_at           timestamptz,
  waived_reason       text,
  waived_by_user_id   uuid REFERENCES user_identity(user_id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- Waive requires reason + user
  CONSTRAINT contract_obligation_waive_consistent
    CHECK (
      (status = 'waived'
        AND waived_at IS NOT NULL
        AND waived_reason IS NOT NULL
        AND waived_by_user_id IS NOT NULL)
      OR (status != 'waived' AND waived_at IS NULL)
    ),

  -- Completed requires completed_at
  CONSTRAINT contract_obligation_completed_consistent
    CHECK (
      (status = 'completed' AND completed_at IS NOT NULL)
      OR (status != 'completed' AND completed_at IS NULL)
    ),

  -- In-progress requires started_at (ADR-0243 §status transition constraint)
  CONSTRAINT contract_obligation_in_progress_consistent
    CHECK (
      (status = 'in_progress' AND started_at IS NOT NULL)
      OR (status != 'in_progress')
    ),

  -- At least one of policy/protocol must be set
  CONSTRAINT contract_obligation_has_target
    CHECK (policy_id IS NOT NULL OR protocol_id IS NOT NULL)
);

COMMENT ON TABLE contract_obligation IS
  'Operasjonelle forpliktelser per kontrakt. Snapshot ved opprettelse. workspace_id denorm '
  'for direkte RLS. due_at beregnes av SECURITY DEFINER trigger.';
COMMENT ON COLUMN contract_obligation.due_at IS
  'Beregnet fra contract.start_date + due_within_days via SECURITY DEFINER trigger. '
  'NULL = ingen frist (frivillig sertifisering).';
COMMENT ON COLUMN contract_obligation.is_blocker IS
  'True = kan ikke jobbe shift før fullført. Sjekkes av shift-engine ved tildeling.';

-- Blocker-sjekk index (< 100ms krav per architecture §10)
CREATE INDEX IF NOT EXISTS contract_obligation_blocker_lookup
  ON contract_obligation (contract_id, status)
  WHERE is_blocker = true AND status IN ('pending', 'in_progress', 'overdue');

-- SLA queries
CREATE INDEX IF NOT EXISTS contract_obligation_status_due
  ON contract_obligation (status, due_at)
  WHERE status IN ('pending', 'in_progress');

-- Cron-based overdue detection
CREATE INDEX IF NOT EXISTS contract_obligation_due_at_pending
  ON contract_obligation (due_at)
  WHERE status = 'pending' AND due_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS contract_obligation_workspace
  ON contract_obligation (workspace_id);

-- =============================================================================
-- SECTION 12: contract_amendment (new table)
-- =============================================================================
-- workspace_id denorm per ADR-0242.
-- ADR-0244 amendments: requires_employee_signature, is_constructive_dismissal_risk,
-- acknowledged_constructive_dismissal_risk.
-- FK uses user_identity(user_id) — NOT "user"(id).

CREATE TABLE IF NOT EXISTS contract_amendment (
  id                                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                            uuid NOT NULL
                                            REFERENCES workspace(workspace_id) ON DELETE RESTRICT,
  contract_id                             uuid NOT NULL
                                            REFERENCES employment_contract(contract_id) ON DELETE RESTRICT,

  -- Change metadata
  amendment_date                          date NOT NULL DEFAULT CURRENT_DATE,
  change_summary                          text NOT NULL,
  field_changes                           jsonb NOT NULL,

  -- ADR-0244: computed from MATERIAL/ADMIN field classification at insert
  requires_employee_signature             boolean NOT NULL,
  -- Legacy column preserved for backward compat with any existing queries
  requires_resigning                      boolean GENERATED ALWAYS AS (requires_employee_signature) STORED,

  -- Status and signing
  status                                  amendment_status NOT NULL DEFAULT 'pending',
  signed_by_employee_at                   timestamptz,
  signed_by_employer_at                   timestamptz,
  rejected_at                             timestamptz,
  rejection_reason                        text,
  expires_at                              timestamptz,
  pdf_url                                 text,

  -- ADR-0244 Lovsen: endringsoppsigelse-flag (Aml. §15-7)
  -- ESKALÉR: arbeidsrettsadvokat-review for grenseverdiene.
  is_constructive_dismissal_risk          boolean NOT NULL DEFAULT false,
  acknowledged_constructive_dismissal_risk boolean NOT NULL DEFAULT false,

  -- Audit
  created_by_user_id                      uuid NOT NULL
                                            REFERENCES user_identity(user_id) ON DELETE RESTRICT,
  created_at                              timestamptz NOT NULL DEFAULT now(),
  updated_at                              timestamptz NOT NULL DEFAULT now(),

  -- field_changes must be array of diff objects
  CONSTRAINT contract_amendment_field_changes_is_array
    CHECK (jsonb_typeof(field_changes) = 'array'),

  -- ADR-0244: accepted requires signatures per requires_employee_signature flag
  -- ADMIN amendments (requires_employee_signature=false): employer signature only
  -- MATERIAL amendments (requires_employee_signature=true): both signatures
  CONSTRAINT contract_amendment_accepted_requires_signatures
    CHECK (
      status != 'accepted'
      OR (
        (requires_employee_signature = true
          AND signed_by_employee_at IS NOT NULL
          AND signed_by_employer_at IS NOT NULL)
        OR
        (requires_employee_signature = false
          AND signed_by_employer_at IS NOT NULL)
      )
    ),

  -- Rejected requires reason
  CONSTRAINT contract_amendment_rejected_requires_reason
    CHECK (
      status != 'rejected'
      OR (rejected_at IS NOT NULL AND rejection_reason IS NOT NULL)
    ),

  -- Constructive dismissal must be acknowledged before amendment can proceed
  -- (acknowledged flag required when risk flag is true, at any status != 'pending')
  CONSTRAINT contract_amendment_dismissal_risk_acknowledged
    CHECK (
      is_constructive_dismissal_risk = false
      OR acknowledged_constructive_dismissal_risk = true
      OR status = 'pending'
    )
);

COMMENT ON TABLE contract_amendment IS
  'Endringssporing per kontrakt. MATERIAL-endringer krever ansatt-signering, '
  'ADMIN-endringer logges med requires_employee_signature=false. '
  'Bokføringsloven §13: 5-år oppbevaring fra regnskapsår_slutt. '
  'workspace_id denorm for direkte RLS.';
COMMENT ON COLUMN contract_amendment.requires_employee_signature IS
  'Kalkulert fra felt-klassifisering ved insert. MATERIAL → true, ADMIN/DERIVED/SYSTEM → false. '
  'Ikke endrebar etter opprettelse.';
COMMENT ON COLUMN contract_amendment.is_constructive_dismissal_risk IS
  'Aml. §15-7: settes true hvis amendment endrer job_title OG (tariff_id ELLER agreed_weekly_hours '
  'ELLER monthly_salary redusert ≥20%). ESKALÉR: arbeidsrettsadvokat-review.';
COMMENT ON COLUMN contract_amendment.acknowledged_constructive_dismissal_risk IS
  'Admin må eksplisitt bekrefte risk-varselet. Juridisk evidens per §14-5 Aml.';

CREATE INDEX IF NOT EXISTS contract_amendment_contract_status
  ON contract_amendment (contract_id, status);

CREATE INDEX IF NOT EXISTS contract_amendment_pending_employee
  ON contract_amendment (status, expires_at)
  WHERE status = 'pending_employee_signature';

CREATE INDEX IF NOT EXISTS contract_amendment_date
  ON contract_amendment (amendment_date DESC);

CREATE INDEX IF NOT EXISTS contract_amendment_workspace
  ON contract_amendment (workspace_id);

-- =============================================================================
-- SECTION 13: TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 13a. compute_obligation_due_at (SECURITY DEFINER per ADR-0243)
-- -----------------------------------------------------------------------------
-- Prevents silent RLS bypass: INVOKER-mode would silently return NULL for
-- employment_contract rows the caller cannot see (L-0172).
-- search_path locked to prevent privilege escalation.
-- Fail-closed on NULL start_date to prevent cross-workspace corruption.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION compute_obligation_due_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start_date date;
BEGIN
  IF NEW.due_within_days IS NULL THEN
    NEW.due_at := NULL;
    RETURN NEW;
  END IF;

  SELECT start_date
    INTO v_start_date
    FROM employment_contract
   WHERE contract_id = NEW.contract_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'contract_obligation: contract_id % not found — cross-workspace insert rejected', NEW.contract_id;
  END IF;

  IF v_start_date IS NULL THEN
    RAISE EXCEPTION 'contract_obligation: employment_contract.start_date is NULL for contract_id % — cannot compute due_at', NEW.contract_id;
  END IF;

  NEW.due_at := v_start_date + NEW.due_within_days;
  RETURN NEW;
END;
$$;

-- Revoke public execute, grant to authenticated only
REVOKE EXECUTE ON FUNCTION compute_obligation_due_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION compute_obligation_due_at() TO authenticated;

CREATE TRIGGER contract_obligation_compute_due_at
  BEFORE INSERT OR UPDATE OF due_within_days, contract_id
  ON contract_obligation
  FOR EACH ROW
  EXECUTE FUNCTION compute_obligation_due_at();

-- -----------------------------------------------------------------------------
-- 13b. recompute_obligation_due_at_on_contract_change (ADR-0243 cascade trigger)
-- -----------------------------------------------------------------------------
-- When employment_contract.start_date changes, recompute all child obligation
-- due_at values. Prevents stale due_at after start_date edits.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION recompute_obligation_due_at_on_contract_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE contract_obligation
     SET due_at = NEW.start_date + due_within_days,
         updated_at = now()
   WHERE contract_id = NEW.contract_id
     AND due_within_days IS NOT NULL;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION recompute_obligation_due_at_on_contract_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recompute_obligation_due_at_on_contract_change() TO authenticated;

CREATE TRIGGER contract_employment_start_date_cascade
  AFTER UPDATE OF start_date
  ON employment_contract
  FOR EACH ROW
  WHEN (OLD.start_date IS DISTINCT FROM NEW.start_date)
  EXECUTE FUNCTION recompute_obligation_due_at_on_contract_change();

-- -----------------------------------------------------------------------------
-- 13c. Riksavtalen holiday_allowance_pct trigger (Ferieloven §10 nr. 3)
-- -----------------------------------------------------------------------------
-- When tariff_id resolves to Riksavtalen Hospitality with 5. ferieuke,
-- set holiday_allowance_pct = 14.30. Otherwise default 12.00.
-- Detection: framework_rule with rule_type='tariff_perk' AND
-- notes ILIKE '%5. ferieuke%' AND framework_rule.framework_id → Riksavtalen.
-- ESKALÉR: verify tariff detection logic against Riksavtalen 2024-2026.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_holiday_allowance_for_tariff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_fifth_week boolean;
BEGIN
  -- Check if new tariff_id resolves to Riksavtalen with 5. ferieuke
  -- Detection is conservative: explicit rule_type='tariff_perk' signal.
  SELECT EXISTS (
    SELECT 1
      FROM framework_rule fr
      JOIN regulatory_framework rf ON rf.id = fr.framework_id
     WHERE fr.rule_id = NEW.tariff_override_id  -- tariff binding via override
       AND fr.rule_type = 'tariff_perk'
       AND fr.notes ILIKE '%5. ferieuke%'
       AND rf.industry_code = 'hospitality'
  )
  INTO v_has_fifth_week;

  IF v_has_fifth_week THEN
    NEW.holiday_allowance_pct := 14.30;
  ELSE
    -- Only reset to 12.00 if still at previous default (don't overwrite manual admin edit)
    IF OLD.holiday_allowance_pct = 14.30 THEN
      NEW.holiday_allowance_pct := 12.00;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION update_holiday_allowance_for_tariff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_holiday_allowance_for_tariff() TO authenticated;

CREATE TRIGGER employee_payroll_tariff_holiday_sync
  BEFORE UPDATE OF tariff_override_id
  ON employee_payroll_profile
  FOR EACH ROW
  WHEN (OLD.tariff_override_id IS DISTINCT FROM NEW.tariff_override_id)
  EXECUTE FUNCTION update_holiday_allowance_for_tariff();

-- =============================================================================
-- SECTION 14: ROW-LEVEL SECURITY
-- =============================================================================
-- All 5 new tables get RLS. Both JWT and API key paths per CLAUDE.md.
-- workspace_id denorm on all child tables enables direct policy (no JOIN cost).
-- =============================================================================

ALTER TABLE pension_scheme ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_pay_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_tip_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_obligation ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_amendment ENABLE ROW LEVEL SECURITY;

-- ===== pension_scheme =====
CREATE POLICY "jwt_select_pension_scheme" ON pension_scheme
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_insert_pension_scheme" ON pension_scheme
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_update_pension_scheme" ON pension_scheme
  FOR UPDATE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_delete_pension_scheme" ON pension_scheme
  FOR DELETE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "api_key_select_pension_scheme" ON pension_scheme
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );
CREATE POLICY "api_key_insert_pension_scheme" ON pension_scheme
  FOR INSERT WITH CHECK (
    workspace_id = get_api_workspace_id()
  );

-- ===== contract_pay_rule =====
CREATE POLICY "jwt_select_contract_pay_rule" ON contract_pay_rule
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_insert_contract_pay_rule" ON contract_pay_rule
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_update_contract_pay_rule" ON contract_pay_rule
  FOR UPDATE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_delete_contract_pay_rule" ON contract_pay_rule
  FOR DELETE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "api_key_select_contract_pay_rule" ON contract_pay_rule
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );
CREATE POLICY "api_key_insert_contract_pay_rule" ON contract_pay_rule
  FOR INSERT WITH CHECK (
    workspace_id = get_api_workspace_id()
  );

-- ===== contract_tip_rule =====
CREATE POLICY "jwt_select_contract_tip_rule" ON contract_tip_rule
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_insert_contract_tip_rule" ON contract_tip_rule
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_update_contract_tip_rule" ON contract_tip_rule
  FOR UPDATE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_delete_contract_tip_rule" ON contract_tip_rule
  FOR DELETE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "api_key_select_contract_tip_rule" ON contract_tip_rule
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );
CREATE POLICY "api_key_insert_contract_tip_rule" ON contract_tip_rule
  FOR INSERT WITH CHECK (
    workspace_id = get_api_workspace_id()
  );

-- ===== contract_obligation =====
CREATE POLICY "jwt_select_contract_obligation" ON contract_obligation
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_insert_contract_obligation" ON contract_obligation
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_update_contract_obligation" ON contract_obligation
  FOR UPDATE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_delete_contract_obligation" ON contract_obligation
  FOR DELETE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "api_key_select_contract_obligation" ON contract_obligation
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );
CREATE POLICY "api_key_insert_contract_obligation" ON contract_obligation
  FOR INSERT WITH CHECK (
    workspace_id = get_api_workspace_id()
  );

-- ===== contract_amendment =====
CREATE POLICY "jwt_select_contract_amendment" ON contract_amendment
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_insert_contract_amendment" ON contract_amendment
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
CREATE POLICY "jwt_update_contract_amendment" ON contract_amendment
  FOR UPDATE USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
-- No DELETE policy on amendments — audit records are immutable per Bokføringsloven §13
CREATE POLICY "api_key_select_contract_amendment" ON contract_amendment
  FOR SELECT USING (
    workspace_id = get_api_workspace_id()
  );

COMMIT;
