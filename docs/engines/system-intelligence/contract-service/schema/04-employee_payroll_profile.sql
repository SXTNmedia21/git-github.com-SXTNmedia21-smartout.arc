-- =============================================================================
-- 04 — employee_payroll_profile (utvidelse)
-- =============================================================================
-- Eksisterende tabell. Utvides med Tripletex-aligned felt.
-- Live-objekt — ikke snapshot. Endring krever IKKE ny kontrakt-signering
-- (med unntak av seniority_start_date som er MATERIAL).
--
-- Antagelse: tabellen har allerede minst:
--   id, profile_id, salary_type, tariff_category, agreed_weekly_hours,
--   sector_experience_years, has_fagbrev, seniority_start_date, tariff_override_id,
--   created_at, updated_at

-- =============================================================================
-- Lønningsdag og feriepenger
-- =============================================================================

ALTER TABLE employee_payroll_profile
  ADD COLUMN IF NOT EXISTS payday_regular smallint,
  ADD COLUMN IF NOT EXISTS holiday_allowance_pct numeric(4,2)
    NOT NULL DEFAULT 12.00,
  ADD COLUMN IF NOT EXISTS extra_holiday_week boolean
    NOT NULL DEFAULT false,
  ADD CONSTRAINT employee_payroll_profile_payday_range
    CHECK (payday_regular IS NULL OR (payday_regular BETWEEN 1 AND 31));

-- 12.00% ferielov, 14.30% for ansatte over 60 (ekstra uke)
ALTER TABLE employee_payroll_profile
  ADD CONSTRAINT employee_payroll_profile_holiday_allowance_range
    CHECK (holiday_allowance_pct >= 10.20 AND holiday_allowance_pct <= 20.00);

-- =============================================================================
-- Skatteetaten (DERIVED — fylles av integrasjon, ikke av admin i prod)
-- =============================================================================

ALTER TABLE employee_payroll_profile
  ADD COLUMN IF NOT EXISTS tax_table_number text,
  ADD COLUMN IF NOT EXISTS tax_card_type tax_card_type,
  ADD COLUMN IF NOT EXISTS tax_percentage numeric(4,2),
  ADD COLUMN IF NOT EXISTS tax_card_fetched_at timestamptz,
  ADD COLUMN IF NOT EXISTS tax_card_year smallint;

ALTER TABLE employee_payroll_profile
  ADD CONSTRAINT employee_payroll_profile_tax_pct_only_for_pct_card
    CHECK (
      (tax_card_type = 'percentage' AND tax_percentage IS NOT NULL)
      OR (tax_card_type IS NULL OR tax_card_type != 'percentage')
    );

ALTER TABLE employee_payroll_profile
  ADD CONSTRAINT employee_payroll_profile_tax_pct_range
    CHECK (tax_percentage IS NULL OR (tax_percentage >= 0 AND tax_percentage <= 100));

-- =============================================================================
-- Pensjon, fagforening
-- =============================================================================

ALTER TABLE employee_payroll_profile
  ADD COLUMN IF NOT EXISTS pension_scheme_id uuid
    REFERENCES pension_scheme(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS pension_opt_out boolean
    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trade_union_member boolean
    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS trade_union_fee_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS trade_union_name text;

-- =============================================================================
-- Tripletex-mapping
-- =============================================================================

ALTER TABLE employee_payroll_profile
  ADD COLUMN IF NOT EXISTS employee_number text,
  ADD COLUMN IF NOT EXISTS tripletex_employee_id integer UNIQUE,
  ADD COLUMN IF NOT EXISTS sync_status sync_status_enum
    NOT NULL DEFAULT 'not_synced',
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- =============================================================================
-- Indekser
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS employee_payroll_profile_profile_unique
  ON employee_payroll_profile (profile_id);

CREATE INDEX IF NOT EXISTS employee_payroll_profile_pension
  ON employee_payroll_profile (pension_scheme_id)
  WHERE pension_scheme_id IS NOT NULL AND pension_opt_out = false;

CREATE INDEX IF NOT EXISTS employee_payroll_profile_sync
  ON employee_payroll_profile (sync_status)
  WHERE sync_status IN ('pending', 'divergent');

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON COLUMN employee_payroll_profile.tax_table_number IS
  'DERIVED. Hentes fra Skatteetaten via skattekort-API. Manuell overstyring kun i Fase 0.';

COMMENT ON COLUMN employee_payroll_profile.holiday_allowance_pct IS
  '12.00% standard, 14.30% for 60+ (med ekstra ferieuke).';

COMMENT ON COLUMN employee_payroll_profile.pension_opt_out IS
  'Ansatt-initiert opt-out fra pensjonsordning. Trekk stoppes, men ordning forblir koblet.';

COMMENT ON COLUMN employee_payroll_profile.tripletex_employee_id IS
  'Speilet fra profile.tripletex_employee_id for redundans i payroll-context. App må holde dem i sync.';
