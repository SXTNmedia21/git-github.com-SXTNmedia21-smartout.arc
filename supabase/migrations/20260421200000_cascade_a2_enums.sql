-- ============================================
-- 20260421200000_cascade_a2_enums.sql
-- Cascade A2: 6 framework model enums
-- Spec: Section 3 Phase A, "New Enums" (framework subset)
-- ============================================

-- What triggered the evaluation
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'framework_trigger_type') THEN
    CREATE TYPE public.framework_trigger_type AS ENUM ('operating_hours', 'season_transition', 'template_change', 'event_added', 'manual_override', 'framework_rule_change', 'external_sync');
  END IF;
END $$;;

-- Rule classification
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'framework_rule_type') THEN
    CREATE TYPE public.framework_rule_type AS ENUM ('gate', 'constraint', 'advisory', 'commercial');
  END IF;
END $$;;

-- How a trigger fires
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'framework_trigger_mode') THEN
    CREATE TYPE public.framework_trigger_mode AS ENUM ('state_change', 'time_based', 'threshold', 'external_event');
  END IF;
END $$;;

-- Integration enums: created ahead of A3 tables to stabilize enum ordering
-- and avoid later cross-phase enum migrations. Tables deferred to A3.

-- External system provider
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'external_provider') THEN
    CREATE TYPE public.external_provider AS ENUM ('tripletex', 'planday', 'visma');
  END IF;
END $$;;

-- Sync direction
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_direction') THEN
    CREATE TYPE public.sync_direction AS ENUM ('inbound', 'outbound', 'bidirectional');
  END IF;
END $$;;

-- Sync lifecycle
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_status') THEN
    CREATE TYPE public.sync_status AS ENUM ('pending', 'synced', 'failed', 'conflict');
  END IF;
END $$;;

COMMENT ON TYPE public.framework_trigger_type IS 'Cascade: what triggered a framework evaluation';
COMMENT ON TYPE public.framework_rule_type IS 'Cascade: rule classification — gate/constraint/advisory/commercial';
COMMENT ON TYPE public.framework_trigger_mode IS 'Cascade: how a trigger fires — state_change/time_based/threshold/external_event';
COMMENT ON TYPE public.external_provider IS 'Cascade: external system provider type';
COMMENT ON TYPE public.sync_direction IS 'Cascade: sync event direction';
COMMENT ON TYPE public.sync_status IS 'Cascade: sync event lifecycle';
