-- 20260515100100_employment_contract_tripletex_columns.sql
-- M2: extend public.employment_contract with Tripletex-required columns.
-- Council 2026-04-15: CHECK constraints over enums (NULL-tolerant for volunteers + no tx trap).
-- NB: existing employment_percentage (00012) is canonical FTE — no duplicate column added.

ALTER TABLE public.employment_contract
  ADD COLUMN IF NOT EXISTS occupation_code          text,
  ADD COLUMN IF NOT EXISTS employment_form          text,
  ADD COLUMN IF NOT EXISTS remuneration_type        text,
  ADD COLUMN IF NOT EXISTS working_hours_scheme     text,
  ADD COLUMN IF NOT EXISTS employee_type_id         uuid REFERENCES public.employee_type(employee_type_id);

-- CHECK constraints — NULL allowed (volunteer semantic: do-not-sync-to-Tripletex signal)
ALTER TABLE public.employment_contract
  ADD CONSTRAINT employment_contract_employment_form_check
    CHECK (employment_form IS NULL OR employment_form IN ('permanent','temporary'));

ALTER TABLE public.employment_contract
  ADD CONSTRAINT employment_contract_remuneration_type_check
    CHECK (remuneration_type IS NULL OR remuneration_type IN ('monthly','hourly','commission'));

-- STYRK-08 is a 7-digit code (validated at Tripletex sync time, not in DB)
ALTER TABLE public.employment_contract
  ADD CONSTRAINT employment_contract_occupation_code_format_check
    CHECK (occupation_code IS NULL OR occupation_code ~ '^[0-9]{7}$');

-- Index for employee_type FK lookups (Tripletex derivation + admin UI filter)
CREATE INDEX IF NOT EXISTS idx_employment_contract_employee_type
  ON public.employment_contract (employee_type_id) WHERE employee_type_id IS NOT NULL;

-- Index for working_hours_scheme (Tripletex scheme grouping)
CREATE INDEX IF NOT EXISTS idx_employment_contract_working_hours_scheme
  ON public.employment_contract (working_hours_scheme) WHERE working_hours_scheme IS NOT NULL;

COMMENT ON COLUMN public.employment_contract.occupation_code IS
  'STYRK-08 7-digit occupation code for Tripletex + a-melding. Validated at sync time.';
COMMENT ON COLUMN public.employment_contract.employment_form IS
  'Tripletex employment form: permanent | temporary | NULL (volunteer — excluded from Tripletex sync).';
COMMENT ON COLUMN public.employment_contract.remuneration_type IS
  'Tripletex remuneration: monthly | hourly | commission | NULL (unpaid/volunteer).';
COMMENT ON COLUMN public.employment_contract.working_hours_scheme IS
  'Tripletex working hours scheme: dagtid/skift/turnus/etc. Free-text lookup.';
COMMENT ON COLUMN public.employment_contract.employee_type_id IS
  'FK to employee_type K1a taxonomy. Derives employment_form + remuneration_type defaults.';
