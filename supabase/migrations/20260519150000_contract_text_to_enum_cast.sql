-- ============================================
-- 20260519150000_contract_text_to_enum_cast.sql
-- Wave 3 (B7) — Migrate employment_contract text columns to enum types
--
-- Follows 20260519100100_contracts_module_foundation.sql which created the
-- enum types (employment_form_enum, working_hours_scheme_enum,
-- remuneration_type_enum) and two CHECK constraints referencing text literals:
--   * employment_contract_temporary_requires_end_date
--       (employment_form NOT IN ('temporary','apprentice','practice'))
--   * employment_contract_salary_matches_type
--       (remuneration_type = 'monthlyWage' / 'hourlyWage' / 'commissionOnly')
--
-- ALTERing the column type to the enum re-validates these CHECKs, which
-- triggers SQLSTATE 42883 ("operator does not exist: <enum> = text") because
-- the literals are typed as text. We DROP both CHECKs before ALTER and
-- recreate them with enum-typed literals after.
--
-- Enum members (per 20260519100100):
--   employment_form_enum:        permanent, temporary, apprentice, practice, freelance
--   working_hours_scheme_enum:   notShiftWork, shiftWork, offshoreWork,
--                                continuousShiftWork335, rotation336
--   remuneration_type_enum:      monthlyWage, hourlyWage, commissionOnly
--
-- Step A normalises any non-enum text values to NULL with NOTICE (safer than
-- a hard error on ALTER). On a fresh CI DB the table is empty — Step A is a
-- no-op there. Production runs of this migration should review the NOTICE
-- output before declaring success.
--
-- ADRs: ADR-0241 (schema foundation), ADR-0243 (field-classification),
--        ADR-0001 (D1 master contract).
-- ============================================

BEGIN;

SET search_path TO public, extensions;

-- ─── Step 0: Drop CHECK constraints that reference text literals ────────────
-- All four CHECKs on these columns must be dropped before ALTER:
--   * employment_contract_employment_form_check    (from 20260515100100, tripletex)
--   * employment_contract_remuneration_type_check  (from 20260515100100, tripletex)
--   * employment_contract_temporary_requires_end_date (from 20260519100100, foundation)
--   * employment_contract_salary_matches_type      (from 20260519100100, foundation)
--
-- Foundation CHECKs are re-added in Step D with enum-typed literals. Tripletex
-- CHECKs are NOT re-added — their value sets ('permanent','temporary' /
-- 'monthly','hourly','commission') were supersetted by the enum members in
-- 20260519100100 and cover only a subset; foundation CHECKs replace them.

ALTER TABLE public.employment_contract
  DROP CONSTRAINT IF EXISTS employment_contract_employment_form_check;

ALTER TABLE public.employment_contract
  DROP CONSTRAINT IF EXISTS employment_contract_remuneration_type_check;

ALTER TABLE public.employment_contract
  DROP CONSTRAINT IF EXISTS employment_contract_temporary_requires_end_date;

ALTER TABLE public.employment_contract
  DROP CONSTRAINT IF EXISTS employment_contract_salary_matches_type;

-- ─── Step A: Normalize text values before cast ─────────────────────────────
-- Any value not in the enum → NULL + NOTICE.

DO $$
DECLARE
  v_row RECORD;
BEGIN
  -- employment_form
  FOR v_row IN
    SELECT contract_id, employment_form
    FROM public.employment_contract
    WHERE employment_form IS NOT NULL
      AND employment_form NOT IN (
        'permanent','temporary','apprentice','practice','freelance'
      )
  LOOP
    RAISE NOTICE 'employment_form: unknown value "%" on contract_id %, setting NULL',
      v_row.employment_form, v_row.contract_id;
    UPDATE public.employment_contract
      SET employment_form = NULL
      WHERE contract_id = v_row.contract_id;
  END LOOP;

  -- working_hours_scheme
  FOR v_row IN
    SELECT contract_id, working_hours_scheme
    FROM public.employment_contract
    WHERE working_hours_scheme IS NOT NULL
      AND working_hours_scheme NOT IN (
        'notShiftWork','shiftWork','offshoreWork',
        'continuousShiftWork335','rotation336'
      )
  LOOP
    RAISE NOTICE 'working_hours_scheme: unknown value "%" on contract_id %, setting NULL',
      v_row.working_hours_scheme, v_row.contract_id;
    UPDATE public.employment_contract
      SET working_hours_scheme = NULL
      WHERE contract_id = v_row.contract_id;
  END LOOP;

  -- remuneration_type
  FOR v_row IN
    SELECT contract_id, remuneration_type
    FROM public.employment_contract
    WHERE remuneration_type IS NOT NULL
      AND remuneration_type NOT IN (
        'monthlyWage','hourlyWage','commissionOnly'
      )
  LOOP
    RAISE NOTICE 'remuneration_type: unknown value "%" on contract_id %, setting NULL',
      v_row.remuneration_type, v_row.contract_id;
    UPDATE public.employment_contract
      SET remuneration_type = NULL
      WHERE contract_id = v_row.contract_id;
  END LOOP;
END;
$$;

-- ─── Step B: ALTER columns to enum types ────────────────────────────────────
-- CHECKs are dropped, remaining values are valid enum members → cast cannot fail.

ALTER TABLE public.employment_contract
  ALTER COLUMN employment_form
    TYPE public.employment_form_enum
    USING employment_form::public.employment_form_enum;

ALTER TABLE public.employment_contract
  ALTER COLUMN working_hours_scheme
    TYPE public.working_hours_scheme_enum
    USING working_hours_scheme::public.working_hours_scheme_enum;

ALTER TABLE public.employment_contract
  ALTER COLUMN remuneration_type
    TYPE public.remuneration_type_enum
    USING remuneration_type::public.remuneration_type_enum;

-- ─── Step C: NOT NULL on employment_form ────────────────────────────────────
-- ADR-0001 D1 requires employment_form to be present on every contract.

DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  SELECT COUNT(*)
    INTO v_null_count
    FROM public.employment_contract
    WHERE employment_form IS NULL;

  IF v_null_count > 0 THEN
    RAISE NOTICE 'employment_form: % rows had NULL; defaulting to ''permanent'' (ADR-0001 D1 fallback)',
      v_null_count;
    UPDATE public.employment_contract
      SET employment_form = 'permanent'::public.employment_form_enum
      WHERE employment_form IS NULL;
  END IF;
END;
$$;

ALTER TABLE public.employment_contract
  ALTER COLUMN employment_form SET NOT NULL;

-- ─── Step D: Re-add CHECK constraints with enum-typed literals ──────────────

ALTER TABLE public.employment_contract
  ADD CONSTRAINT employment_contract_temporary_requires_end_date
    CHECK (
      employment_form NOT IN (
        'temporary'::employment_form_enum,
        'apprentice'::employment_form_enum,
        'practice'::employment_form_enum
      )
      OR end_date IS NOT NULL
    );

ALTER TABLE public.employment_contract
  ADD CONSTRAINT employment_contract_salary_matches_type
    CHECK (
      (remuneration_type = 'monthlyWage'::remuneration_type_enum AND monthly_salary IS NOT NULL)
      OR (remuneration_type = 'hourlyWage'::remuneration_type_enum AND hourly_rate IS NOT NULL)
      OR (
        remuneration_type = 'commissionOnly'::remuneration_type_enum
        AND (
          monthly_salary IS NOT NULL
          OR hourly_rate IS NOT NULL
          OR minimum_guaranteed_amount IS NOT NULL
        )
      )
      OR remuneration_type IS NULL
    );

-- ─── Step E: Comments ────────────────────────────────────────────────────────

COMMENT ON COLUMN public.employment_contract.employment_form IS
  'Employment form (permanent, temporary, apprentice, practice, freelance). '
  'NOT NULL per ADR-0001 D1. Type migrated from text → employment_form_enum '
  'by 20260519150000.';

COMMENT ON COLUMN public.employment_contract.working_hours_scheme IS
  'Working hours scheme (notShiftWork, shiftWork, offshoreWork, '
  'continuousShiftWork335, rotation336). Nullable. Type migrated from '
  'text → working_hours_scheme_enum by 20260519150000.';

COMMENT ON COLUMN public.employment_contract.remuneration_type IS
  'Remuneration type (monthlyWage, hourlyWage, commissionOnly). Nullable. '
  'Type migrated from text → remuneration_type_enum by 20260519150000.';

COMMIT;
