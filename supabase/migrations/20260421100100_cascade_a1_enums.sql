-- ============================================
-- 20260421100100_cascade_a1_enums.sql
-- Cascade A1: 10 domain model enums
-- Spec: Section 3 Phase A, "New Enums"
-- ============================================

-- Department classification
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'department_type') THEN
    CREATE TYPE public.department_type AS ENUM ('operational', 'administrative', 'hybrid');
  END IF;
END $$;;

-- Template shift purpose
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shift_function') THEN
    CREATE TYPE public.shift_function AS ENUM ('opening', 'closing', 'supporting', 'rush_hour', 'sub_supply');
  END IF;
END $$;;

-- Shift time anchoring
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'anchor_type') THEN
    CREATE TYPE public.anchor_type AS ENUM ('fixed', 'open', 'close');
  END IF;
END $$;;

-- Proposal lifecycle
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'change_proposal_status') THEN
    CREATE TYPE public.change_proposal_status AS ENUM ('pending', 'approved', 'applied', 'rejected', 'expired');
  END IF;
END $$;;

-- Event classification
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'planning_event_category') THEN
    CREATE TYPE public.planning_event_category AS ENUM ('external_scraped', 'cultural_commercial', 'internal', 'weather', 'recurring');
  END IF;
END $$;;

-- Event origin
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'planning_event_source') THEN
    CREATE TYPE public.planning_event_source AS ENUM ('manual', 'scraped_municipality', 'scraped_cultural', 'weather_api', 'booking_integration', 'historical_import');
  END IF;
END $$;;

-- Year wheel lifecycle
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'planning_cycle_status') THEN
    CREATE TYPE public.planning_cycle_status AS ENUM ('draft', 'active', 'archived');
  END IF;
END $$;;

-- Proposal origin
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cascade_initiator') THEN
    CREATE TYPE public.cascade_initiator AS ENUM ('cascade_engine', 'admin_manual', 'c1_calibration', 'bootstrap');
  END IF;
END $$;;

-- Rate provenance
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tariff_source') THEN
    CREATE TYPE public.tariff_source AS ENUM ('riksavtalen', 'allmenngjoring', 'internal');
  END IF;
END $$;;

-- Framework evaluation result
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'evaluation_outcome') THEN
    CREATE TYPE public.evaluation_outcome AS ENUM ('allowed', 'allowed_with_exception', 'review_required', 'blocked');
  END IF;
END $$;;

COMMENT ON TYPE public.department_type IS 'Cascade D1: operational/administrative/hybrid department classification';
COMMENT ON TYPE public.shift_function IS 'Cascade D1: template shift purpose — opening/closing/supporting/rush_hour/sub_supply';
COMMENT ON TYPE public.anchor_type IS 'Cascade D1: shift time anchoring — fixed/open/close relative to operating hours';
COMMENT ON TYPE public.change_proposal_status IS 'Cascade C4: proposal lifecycle — pending/approved/applied/rejected/expired';
COMMENT ON TYPE public.planning_event_category IS 'Cascade D4: planning event classification';
COMMENT ON TYPE public.planning_event_source IS 'Cascade D4: planning event origin';
COMMENT ON TYPE public.planning_cycle_status IS 'Cascade D1: year wheel lifecycle — draft/active/archived';
COMMENT ON TYPE public.cascade_initiator IS 'Cascade C4: who originated the proposal';
COMMENT ON TYPE public.tariff_source IS 'Cascade K1a: rate provenance — riksavtalen/allmenngjoring/internal';
COMMENT ON TYPE public.evaluation_outcome IS 'Cascade C4: framework evaluation result — allowed/allowed_with_exception/review_required/blocked';
