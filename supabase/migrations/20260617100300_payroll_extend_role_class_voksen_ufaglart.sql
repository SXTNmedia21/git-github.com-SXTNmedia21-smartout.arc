-- 20260616140000_payroll_extend_role_class_voksen_ufaglart.sql
--
-- PURPOSE: Extend public.tariff_rate_table.role_class CHECK constraint to
--          include 'voksen_ufaglart' and 'voksen_faglart' as valid values.
--
-- CONTEXT (E5): The B1 seed migration (20260616120000) could not set
--   role_class on the two minstelonn fixture rows (trt-min-001, trt-min-002)
--   because the existing CHECK constraint only allows:
--     'kokk_m_fagbrev' | 'kokk_u_fagbrev' | 'øvrig_m_fagbrev' | 'øvrig_u_fagbrev'
--   The fixture's employee profiles use tariff_category='voksen_ufaglart'
--   (and 'voksen_faglart' after E1 fix), which are the correct Riksavtalen §3
--   role designations for adult non-cook workers.
--
-- EXTENSION: Add 'voksen_ufaglart' and 'voksen_faglart' to the allowed set.
--   These are canonical Riksavtalen §3 designations:
--     voksen_ufaglart — adult without trade certificate (øvrig u/fagbrev equivalent)
--     voksen_faglart  — adult with trade certificate (øvrig m/fagbrev equivalent)
--
-- BACKFILL: Update trt-min-001 and trt-min-002 fixture rows to set role_class
--   directly (no longer requires provenance workaround).
--
-- L-0042 COMPLIANT: 20260616140000 > 20260616130000 (current local tip).
-- DO NOT regenerate database.types.ts — role_class is TEXT, not enum.

SET search_path TO public, extensions;

-- Step 1: Drop existing role_class CHECK constraint on tariff_rate_table
ALTER TABLE public.tariff_rate_table
  DROP CONSTRAINT IF EXISTS tariff_rate_table_role_class_check;

-- Step 2: Recreate with extended set including voksen_ufaglart + voksen_faglart
ALTER TABLE public.tariff_rate_table
  ADD CONSTRAINT tariff_rate_table_role_class_check
  CHECK (role_class IS NULL OR role_class IN (
    'kokk_m_fagbrev',
    'kokk_u_fagbrev',
    'øvrig_m_fagbrev',
    'øvrig_u_fagbrev',
    'voksen_ufaglart',
    'voksen_faglart'
  ));

COMMENT ON COLUMN public.tariff_rate_table.role_class IS
  'Minstelonn role class discriminator per Riksavtalen §3: '
  'kokk_m_fagbrev | kokk_u_fagbrev | oevrig_m_fagbrev | oevrig_u_fagbrev '
  '(cook/other × with/without trade cert) + voksen_ufaglart | voksen_faglart '
  '(adult-centric designations per §3.3 used in fixture profiles). '
  'NULL for supplement and overtime rate rows.';

-- Step 3: Backfill trt-min-001 and trt-min-002 fixture rows
--   These were seeded with role_class=NULL and provenance->>'fixture_role_class'
--   as a workaround. Now set role_class directly.
UPDATE public.tariff_rate_table
SET role_class = 'voksen_ufaglart'
WHERE id IN (
  'd2c4e4b4-4209-5301-8780-667e8adbd056'::uuid,  -- trt-min-001 (begynner)
  '965bc0de-1a7b-5013-9edf-57244c275947'::uuid   -- trt-min-002 (2+ aar)
)
AND role_class IS NULL;  -- idempotent: only set if not already set

-- Sanity check: both rows should now have role_class set
DO $$
DECLARE
  unset_count INT;
BEGIN
  SELECT COUNT(*) INTO unset_count
  FROM public.tariff_rate_table
  WHERE id IN (
    'd2c4e4b4-4209-5301-8780-667e8adbd056'::uuid,
    '965bc0de-1a7b-5013-9edf-57244c275947'::uuid
  )
  AND role_class IS NULL;

  IF unset_count > 0 THEN
    RAISE WARNING 'E5 backfill INCOMPLETE: % trt-min rows still have NULL role_class (may not exist yet in this env)', unset_count;
    -- WARNING not EXCEPTION: rows may not exist in env without B1 seed (test envs)
  END IF;
END;
$$;
