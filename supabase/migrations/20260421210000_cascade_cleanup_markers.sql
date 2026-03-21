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

-- season.opening_hours deprecated
COMMENT ON COLUMN season.opening_hours IS
  'LEGACY: deprecated by Cascade A1. Runtime reads must use department_operating_hours.';

-- schedule_template.department TEXT is compatibility only
COMMENT ON COLUMN schedule_template.department IS
  'LEGACY: compatibility-only text field. New runtime code must use department_id.';
