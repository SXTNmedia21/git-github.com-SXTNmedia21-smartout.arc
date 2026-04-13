-- =============================================================
-- Migration: Add employment_category constraint and template column
-- Purpose: Enforce valid employment category values and extend
--          contract_template to support category-aware template selection
-- =============================================================

-- 1. Add CHECK constraint to employment_contract.employment_category
-- Restricts values to: 'fast', 'deltid', 'tilkalling', or NULL
ALTER TABLE public.employment_contract
  ADD CONSTRAINT check_employment_category
    CHECK (employment_category IS NULL OR employment_category IN ('fast', 'deltid', 'tilkalling'));

COMMENT ON CONSTRAINT check_employment_category ON public.employment_contract IS
  'Validates employment category: fast (permanent), deltid (part-time), tilkalling (on-call)';

-- 2. Add employment_category column to contract_template
-- Same validation constraint as employment_contract
ALTER TABLE public.contract_template
  ADD COLUMN IF NOT EXISTS employment_category text
    CHECK (employment_category IS NULL OR employment_category IN ('fast', 'deltid', 'tilkalling'));

COMMENT ON COLUMN public.contract_template.employment_category IS
  'Employment category this template applies to: fast, deltid, tilkalling, or NULL for non-employment contracts';

-- 3. Update existing system employee templates with their category
UPDATE public.contract_template
  SET employment_category = 'fast'
  WHERE is_system = true
    AND contract_type = 'employee'
    AND name ILIKE '%Fast ansatt%';

UPDATE public.contract_template
  SET employment_category = 'deltid'
  WHERE is_system = true
    AND contract_type = 'employee'
    AND name ILIKE '%Deltid%';

UPDATE public.contract_template
  SET employment_category = 'tilkalling'
  WHERE is_system = true
    AND contract_type = 'employee'
    AND (name ILIKE '%Tilkallingsvikar%' OR name ILIKE '%vikar%');

-- 4. Create index on employment_category for filtering
CREATE INDEX IF NOT EXISTS idx_contract_template_employment_category
  ON public.contract_template(employment_category)
  WHERE employment_category IS NOT NULL;

COMMENT ON INDEX idx_contract_template_employment_category IS
  'Index for fast lookups by employment category (excludes NULL)';
