-- =============================================================================
-- 03 — employment_contract (utvidelse)
-- =============================================================================
-- Eksisterende tabell. Legger til §14-6 (juli 2024-utvidelser),
-- ADR-0001 D2 (employment_role, contract_status), D3 (overtime_cap_policy_id).
--
-- Antagelse: tabellen har allerede minst:
--   id, profile_id, job_title, employment_form, start_date, end_date,
--   monthly_salary, hourly_rate, agreed_weekly_hours, employment_percentage,
--   tariff_id, occupation_code, signed_at, created_at, updated_at,
--   working_hours_scheme, remuneration_type
--
-- ALTER TABLE-rekkefølge er ikke kritisk men FK-er må peke til eksisterende tabeller.

-- =============================================================================
-- ADR-0001 D2: parallelle kontrakter, status-mekanikk
-- =============================================================================

ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS employment_role employment_role
    NOT NULL DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS contract_status contract_status
    NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS superseded_by_contract_id uuid
    REFERENCES employment_contract(id) ON DELETE SET NULL;

-- =============================================================================
-- §14-6 post juli 2024
-- =============================================================================

ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS trial_period_months smallint,
  ADD COLUMN IF NOT EXISTS notice_period_months smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS break_minutes_per_day smallint,
  ADD COLUMN IF NOT EXISTS training_rights text,
  ADD COLUMN IF NOT EXISTS variable_hours_arrangement text,
  ADD COLUMN IF NOT EXISTS end_date_reason text
    REFERENCES end_date_reason(code) ON DELETE RESTRICT;

-- =============================================================================
-- ADR-0001 D3: overtime cap kan utvides per kontrakt (innen lov-grense)
-- =============================================================================

ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS overtime_cap_policy_id uuid
    REFERENCES policy(id) ON DELETE SET NULL;

-- =============================================================================
-- Signerings-felter
-- =============================================================================

ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS signed_by_employee_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by_employer_at timestamptz,
  ADD COLUMN IF NOT EXISTS pdf_url text;

-- =============================================================================
-- Constraints
-- =============================================================================

-- Maks én aktiv main-kontrakt per profil (ADR-0001 D2 invariant)
CREATE UNIQUE INDEX IF NOT EXISTS employment_contract_one_active_main_per_profile
  ON employment_contract (profile_id)
  WHERE employment_role = 'main' AND contract_status = 'active';

-- Temporary må ha end_date
ALTER TABLE employment_contract
  ADD CONSTRAINT employment_contract_temporary_requires_end_date
    CHECK (
      employment_form != 'temporary'
      OR end_date IS NOT NULL
    );

-- Lønn må være satt iht remuneration_type
ALTER TABLE employment_contract
  ADD CONSTRAINT employment_contract_salary_matches_type
    CHECK (
      (remuneration_type = 'monthlyWage' AND monthly_salary IS NOT NULL)
      OR (remuneration_type = 'hourlyWage' AND hourly_rate IS NOT NULL)
      OR (remuneration_type = 'commissionOnly')
    );

-- superseded_by kun ved superseded-status
ALTER TABLE employment_contract
  ADD CONSTRAINT employment_contract_superseded_by_only_when_superseded
    CHECK (
      (contract_status = 'superseded' AND superseded_by_contract_id IS NOT NULL)
      OR (contract_status != 'superseded' AND superseded_by_contract_id IS NULL)
    );

-- Trial period rimelig (norsk lov: max 6 mnd)
ALTER TABLE employment_contract
  ADD CONSTRAINT employment_contract_trial_period_max_6
    CHECK (trial_period_months IS NULL OR trial_period_months <= 6);

-- Notice period positiv
ALTER TABLE employment_contract
  ADD CONSTRAINT employment_contract_notice_period_positive
    CHECK (notice_period_months >= 0);

-- =============================================================================
-- Indekser for performance (architecture §10)
-- =============================================================================

CREATE INDEX IF NOT EXISTS employment_contract_profile_status
  ON employment_contract (profile_id, contract_status);

CREATE INDEX IF NOT EXISTS employment_contract_active_by_date
  ON employment_contract (start_date, end_date)
  WHERE contract_status = 'active';

CREATE INDEX IF NOT EXISTS employment_contract_tariff
  ON employment_contract (tariff_id)
  WHERE tariff_id IS NOT NULL;

-- =============================================================================
-- Comments
-- =============================================================================

COMMENT ON COLUMN employment_contract.employment_role IS
  'main = primær ansettelse. secondary = parallell. temporary_supplement = ekstra-vakter på toppen.';

COMMENT ON COLUMN employment_contract.contract_status IS
  'Livssyklus. draft → pending_signature → active → superseded/terminated/expired.';

COMMENT ON COLUMN employment_contract.superseded_by_contract_id IS
  'Peker til ny kontrakt når denne erstattes (ved stillingsendring som krever ny kontrakt, ikke amendment).';

COMMENT ON COLUMN employment_contract.overtime_cap_policy_id IS
  'Valgfri override av engine-default overtime-tak. Kan kun utvide innenfor Aml. §10-6 absolutte grenser.';

COMMENT ON COLUMN employment_contract.training_rights IS
  '§14-6 post juli 2024: opplysninger om opplærings-rettigheter ansatt har.';

COMMENT ON COLUMN employment_contract.variable_hours_arrangement IS
  '§14-6: beskrivelse av variabel arbeidstid hvis aktuelt.';
