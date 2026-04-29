-- ============================================
-- 20260519110000_contract_text_to_enum_cast.sql
-- Wave 3 (B7) — Migrate employment_contract text columns to enum types
--
-- Follows 20260519100100_contracts_module_foundation.sql which created the
-- enum types (employment_form_enum, working_hours_scheme_enum,
-- remuneration_type_enum) but left the parent columns as TEXT to avoid
-- a COMMIT→ALTER TYPE→BEGIN ordering problem in the same transaction.
--
-- This migration:
--   A. Maps any non-enum-compatible text values to nearest valid enum value
--   B. ALTERs the three columns to their respective enum types
--   C. Adds NOT NULL constraint on employment_form (required per ADR-0001 D1)
--
-- ADRs: ADR-0233 (schema foundation), ADR-0235 (field-classification),
--        ADR-0001 (D1 master contract).
--
-- Mapping decisions (documented per task requirement):
--   employment_form:
--     'full_time'        → 'full_time'         (direct match)
--     'part_time'        → 'part_time'          (direct match)
--     'temporary'        → 'temporary'          (direct match)
--     'on_call'          → 'on_call'            (direct match)
--     'apprentice'       → 'apprentice'         (direct match)
--     'freelance'        → 'freelance'          (direct match)
--     'intern'           → 'intern'             (direct match)
--     ANY other value    → NULL with NOTICE     (safer than silent wrong cast)
--     NULL               → NULL                 (preserved)
--
--   working_hours_scheme:
--     'fixed_day'        → 'fixed_day'          (direct match)
--     'rotating_shifts'  → 'rotating_shifts'    (direct match)
--     'compressed'       → 'compressed'         (direct match)
--     'flexible'         → 'flexible'           (direct match)
--     'split_shift'      → 'split_shift'        (direct match)
--     'on_demand'        → 'on_demand'          (direct match)
--     ANY other          → NULL with NOTICE
--     NULL               → NULL
--
--   remuneration_type:
--     'monthly_salary'       → 'monthly_salary'
--     'hourly_wage'          → 'hourly_wage'
--     'commission_only'      → 'commission_only'
--     'salary_plus_tips'     → 'salary_plus_tips'
--     'collective_agreement' → 'collective_agreement'
--     ANY other              → NULL with NOTICE
--     NULL                   → NULL
--
-- employment_form is made NOT NULL after cast (ADR-0001 D1 requirement).
-- working_hours_scheme and remuneration_type remain nullable.
-- ============================================

-- Run outside transaction so the USING cast can reference the new enum
-- (Postgres 14+ enum values used in USING must exist before the transaction;
-- since the enum types were created in 20260519100000 which committed,
-- we can USING-cast them safely here in a normal transaction).

BEGIN;

SET search_path TO public, extensions;

-- ─── Step A: Normalize text values before cast ─────────────────────────────
-- Any value not in the enum → NULL + NOTICE. Safer than a hard error on
-- the ALTER TABLE which would block the entire migration.
-- These DO blocks run in PL/pgSQL so we can RAISE NOTICE per unknown value.

DO $$
DECLARE
  v_row RECORD;
  v_valid_employment_forms TEXT[] := ARRAY[
    'full_time','part_time','temporary','on_call',
    'apprentice','freelance','intern'
  ];
  v_valid_hours_schemes TEXT[] := ARRAY[
    'fixed_day','rotating_shifts','compressed',
    'flexible','split_shift','on_demand'
  ];
  v_valid_remuneration_types TEXT[] := ARRAY[
    'monthly_salary','hourly_wage','commission_only',
    'salary_plus_tips','collective_agreement'
  ];
BEGIN
  -- employment_form: null out unmappable values
  FOR v_row IN
    SELECT contract_id, employment_form
    FROM public.employment_contract
    WHERE employment_form IS NOT NULL
      AND employment_form NOT IN (
        'full_time','part_time','temporary','on_call',
        'apprentice','freelance','intern'
      )
  LOOP
    RAISE NOTICE 'employment_form: unknown value "%" on contract_id %, setting NULL',
      v_row.employment_form, v_row.contract_id;
    UPDATE public.employment_contract
      SET employment_form = NULL
      WHERE contract_id = v_row.contract_id;
  END LOOP;

  -- working_hours_scheme: null out unmappable values
  FOR v_row IN
    SELECT contract_id, working_hours_scheme
    FROM public.employment_contract
    WHERE working_hours_scheme IS NOT NULL
      AND working_hours_scheme NOT IN (
        'fixed_day','rotating_shifts','compressed',
        'flexible','split_shift','on_demand'
      )
  LOOP
    RAISE NOTICE 'working_hours_scheme: unknown value "%" on contract_id %, setting NULL',
      v_row.working_hours_scheme, v_row.contract_id;
    UPDATE public.employment_contract
      SET working_hours_scheme = NULL
      WHERE contract_id = v_row.contract_id;
  END LOOP;

  -- remuneration_type: null out unmappable values
  FOR v_row IN
    SELECT contract_id, remuneration_type
    FROM public.employment_contract
    WHERE remuneration_type IS NOT NULL
      AND remuneration_type NOT IN (
        'monthly_salary','hourly_wage','commission_only',
        'salary_plus_tips','collective_agreement'
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
-- At this point every remaining non-NULL value is a valid enum member,
-- so the USING cast cannot fail.

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
-- If any rows still have NULL employment_form after Step A, set a safe
-- default before adding the constraint. Log the count for auditability.

DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  SELECT COUNT(*)
    INTO v_null_count
    FROM public.employment_contract
    WHERE employment_form IS NULL;

  IF v_null_count > 0 THEN
    RAISE NOTICE 'employment_form: % rows had NULL; defaulting to ''full_time'' (ADR-0001 D1 fallback)',
      v_null_count;
    UPDATE public.employment_contract
      SET employment_form = 'full_time'::public.employment_form_enum
      WHERE employment_form IS NULL;
  END IF;
END;
$$;

ALTER TABLE public.employment_contract
  ALTER COLUMN employment_form SET NOT NULL;

-- ─── Step D: Comments ────────────────────────────────────────────────────────

COMMENT ON COLUMN public.employment_contract.employment_form IS
  'Employment form (e.g. full_time, part_time). NOT NULL per ADR-0001 D1. '
  'Type migrated from text → employment_form_enum by 20260519110000. '
  'Mapping: non-enum values nulled with RAISE NOTICE then defaulted to full_time.';

COMMENT ON COLUMN public.employment_contract.working_hours_scheme IS
  'Working hours scheme (e.g. fixed_day, rotating_shifts). Nullable. '
  'Type migrated from text → working_hours_scheme_enum by 20260519110000.';

COMMENT ON COLUMN public.employment_contract.remuneration_type IS
  'Remuneration type (e.g. monthly_salary, hourly_wage). Nullable. '
  'Type migrated from text → remuneration_type_enum by 20260519110000.';

COMMIT;
