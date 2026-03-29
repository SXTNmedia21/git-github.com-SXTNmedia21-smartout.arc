-- ============================================
-- 20260421100300_cascade_a1_alter_existing.sql
-- Cascade A1: New fields on existing tables
-- Spec: Section 3 Phase A, "New Fields on Existing Tables"
-- ============================================

SET search_path TO public, extensions;

-- --------------------------------------------------------
-- 1. department — add department_type classification
-- --------------------------------------------------------
ALTER TABLE department
  ADD COLUMN IF NOT EXISTS department_type department_type;

COMMENT ON COLUMN department.department_type IS 'Cascade D1: operational/administrative/hybrid classification. NULL = unclassified (legacy).';

-- --------------------------------------------------------
-- 2. season — link to year wheel
-- --------------------------------------------------------
ALTER TABLE season
  ADD COLUMN IF NOT EXISTS planning_cycle_id UUID REFERENCES planning_cycle(planning_cycle_id) ON DELETE SET NULL;

COMMENT ON COLUMN season.planning_cycle_id IS 'Cascade D1: Links season to year wheel (planning_cycle).';

CREATE INDEX IF NOT EXISTS idx_season_planning_cycle
  ON season (planning_cycle_id) WHERE planning_cycle_id IS NOT NULL;

-- Note: season.is_active boolean from spec is INTENTIONALLY OMITTED.
-- Season already has status enum (draft/active/archived) — use status = active instead.

-- --------------------------------------------------------
-- 3. employment_contract — add agreed weekly hours
-- --------------------------------------------------------
ALTER TABLE employment_contract
  ADD COLUMN IF NOT EXISTS agreed_weekly_hours NUMERIC(4,2);

COMMENT ON COLUMN employment_contract.agreed_weekly_hours IS 'Cascade D3: Contractual weekly hours. Critical for overtime calculation.';

-- --------------------------------------------------------
-- 4. profile — add seniority and trade cert
-- --------------------------------------------------------
ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS seniority_start_date DATE;

ALTER TABLE profile
  ADD COLUMN IF NOT EXISTS has_fagbrev BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN profile.seniority_start_date IS 'Cascade D2: Ansiennitet start date for wage step lookup.';
COMMENT ON COLUMN profile.has_fagbrev IS 'Cascade D2: Fagbrev/non-fagbrev rate distinction.';

-- --------------------------------------------------------
-- 5. department_session — planned operating hours
-- --------------------------------------------------------
ALTER TABLE department_session
  ADD COLUMN IF NOT EXISTS planned_open TIME;

ALTER TABLE department_session
  ADD COLUMN IF NOT EXISTS planned_close TIME;

COMMENT ON COLUMN department_session.planned_open IS 'Cascade D1: Set from resolve_hours() at session creation.';
COMMENT ON COLUMN department_session.planned_close IS 'Cascade D1: Set from resolve_hours() at session creation.';

-- --------------------------------------------------------
-- 6. schedule_shift — direct dept/location FK
-- --------------------------------------------------------
ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES department(department_id) ON DELETE SET NULL;

ALTER TABLE schedule_shift
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES location(location_id) ON DELETE SET NULL;

COMMENT ON COLUMN schedule_shift.department_id IS 'Cascade D1: Direct department FK (backfill from position). Enables direct department-level queries.';
COMMENT ON COLUMN schedule_shift.location_id IS 'Cascade D1: Direct location FK for location scoping.';

CREATE INDEX IF NOT EXISTS idx_schedule_shift_department
  ON schedule_shift (department_id) WHERE department_id IS NOT NULL;

-- --------------------------------------------------------
-- 7. schedule_template — add department FK
-- --------------------------------------------------------
ALTER TABLE schedule_template
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES department(department_id) ON DELETE SET NULL;

COMMENT ON COLUMN schedule_template.department_id IS 'Cascade D1: Department FK (replaces plain TEXT department column). Legacy TEXT column preserved for backwards compat.';

-- --------------------------------------------------------
-- 8. schedule_template_shift — add cascade fields + missing codebase norms
-- --------------------------------------------------------

-- First: add missing codebase-standard columns
ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspace(workspace_id) ON DELETE CASCADE;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Then: add cascade-specific fields
ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS shift_function shift_function;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS start_anchor_type anchor_type;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS start_offset_min INTEGER;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS end_anchor_type anchor_type;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS end_offset_min INTEGER;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS slot_order INTEGER;

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS label TEXT;

-- Add updated_at trigger (idempotent)
DROP TRIGGER IF EXISTS set_template_shift_updated_at ON public.schedule_template_shift;
CREATE TRIGGER set_template_shift_updated_at
  BEFORE UPDATE ON public.schedule_template_shift
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add provenance to tables that need it (spec Section 4.4)
ALTER TABLE schedule_template
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}';

ALTER TABLE schedule_template_shift
  ADD COLUMN IF NOT EXISTS provenance JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN schedule_template_shift.shift_function IS 'Cascade D1: opening/closing/supporting/rush_hour/sub_supply.';
COMMENT ON COLUMN schedule_template_shift.start_anchor_type IS 'Cascade D1: How start time is calculated — fixed/open/close.';
COMMENT ON COLUMN schedule_template_shift.end_anchor_type IS 'Cascade D1: How end time is calculated — fixed/open/close.';
COMMENT ON COLUMN schedule_template_shift.slot_order IS 'Cascade D1: Display order in vaktlista.';
