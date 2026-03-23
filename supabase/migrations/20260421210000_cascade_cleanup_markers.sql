-- ============================================
-- 20260421210000_cascade_cleanup_markers.sql
-- Cascade cleanup safety rails
-- Marks legacy structures as non-authoritative runtime sources
-- ============================================

SET search_path TO public, extensions;

-- company_opening_hours remains join-intake only
COMMENT ON TABLE company_opening_hours IS
  'LEGACY: onboarding intake only. Not a runtime source of truth after Cascade A1. Runtime hours must read department_operating_hours.';

-- operating_hours deprecated
COMMENT ON TABLE operating_hours IS
  'LEGACY: deprecated by Cascade A1. Runtime reads must use department_operating_hours.';

-- season.opening_hours deprecated (conditional — column may not exist in all environments)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'season' AND column_name = 'opening_hours') THEN
    COMMENT ON COLUMN season.opening_hours IS
      'LEGACY: deprecated by Cascade A1. Runtime reads must use department_operating_hours.';
  END IF;
END $$;;

-- schedule_template.department TEXT is compatibility only
COMMENT ON COLUMN schedule_template.department IS
  'LEGACY: compatibility-only text field. New runtime code must use department_id.';
