-- ============================================
-- 20260428220000_tips_enums.sql
-- Tips campaign Sortie 1 — three new enums.
-- Campaign: tips-handling · Sub-sortie: tips-data-model
-- ============================================

SET search_path TO public, extensions;

DO $$ BEGIN
  CREATE TYPE tip_pool_status AS ENUM ('recorded', 'approved', 'paid', 'voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tip_distribution_status AS ENUM ('calculated', 'approved', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tip_algorithm AS ENUM ('equal', 'by_hours', 'by_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON TYPE tip_pool_status IS 'Tip pool lifecycle: recorded → approved → paid (paid set by future payroll-campaign). voided = leader confirmed no tips that evening.';
COMMENT ON TYPE tip_distribution_status IS 'Per-employee distribution status. paid set by future payroll-campaign.';
COMMENT ON TYPE tip_algorithm IS 'How a pool is split: equal share, by hours worked, or weighted by role.';
