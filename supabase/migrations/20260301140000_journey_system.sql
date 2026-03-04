SET search_path TO public, extensions;

-- ============================================
-- 20260301140000_journey_system.sql
-- Creates the journey tracking system: 7 enums, 4 tables,
-- indexes, updated_at triggers, and RLS policies.
-- The journey system tracks the 68 user journeys through
-- a 13-status lifecycle during the Bubble.io migration.
-- Connected to: packages/types/src/journey.ts (Zod schemas)
-- ============================================

-- Journey system enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journey_status') THEN
    CREATE TYPE journey_status AS ENUM (
  'idea', 'wizard', 'defined',
  'ready_impl', 'building', 'review',
  'ready_test', 'testing', 'ready_validation',
  'implemented', 'active', 'inactive', 'broken'
);
  END IF;
END $$;;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journey_actor') THEN
    CREATE TYPE journey_actor AS ENUM (
  'employee', 'trainee', 'manager', 'admin', 'owner', 'all'
);
  END IF;
END $$;;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journey_platform') THEN
    CREATE TYPE journey_platform AS ENUM ('mobile', 'desktop', 'both');
  END IF;
END $$;;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journey_priority') THEN
    CREATE TYPE journey_priority AS ENUM ('P0', 'P1', 'P2', 'P3');
  END IF;
END $$;;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journey_module') THEN
    CREATE TYPE journey_module AS ENUM (
  'core', 'onboarding', 'org', 'scheduling', 'operations',
  'haccp', 'training', 'absence', 'payroll', 'communication',
  'reports', 'settings', 'ai', 'season', 'governance',
  'contracts', 'certifications', 'meta'
);
  END IF;
END $$;;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journey_event_type') THEN
    CREATE TYPE journey_event_type AS ENUM (
  'status_change', 'test_run', 'output_generated', 'edit', 'comment'
);
  END IF;
END $$;;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'journey_test_result') THEN
    CREATE TYPE journey_test_result AS ENUM ('pass', 'fail', 'skip', 'running');
  END IF;
END $$;;

-- Main journey table
CREATE TABLE IF NOT EXISTS journey (
  journey_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  code text NOT NULL,                         -- "J-001"
  title text NOT NULL,                        -- "Sign Up & Create Workspace"
  slug text NOT NULL,                         -- "sign-up-create-workspace"
  module journey_module NOT NULL,
  actor journey_actor NOT NULL,
  platform journey_platform NOT NULL DEFAULT 'both',
  priority public.journey_priority NOT NULL DEFAULT 'P1',
  status public.journey_status NOT NULL DEFAULT 'idea',
  tags text[] NOT NULL DEFAULT '{}',
  trigger_description text,                   -- What initiates this journey
  preconditions text[] NOT NULL DEFAULT '{}',
  test_assertion text,                        -- One-line E2E assertion
  doc_title text,                             -- Norwegian doc title
  outcomes_success text,
  outcomes_empty text,
  outcomes_error text,
  related_journeys uuid[] NOT NULL DEFAULT '{}',
  blocked_by uuid[] NOT NULL DEFAULT '{}',
  assignee_id uuid REFERENCES user_identity(user_id),
  linear_issue_id text,
  last_test_result journey_test_result,
  last_test_run_at timestamptz,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, slug),
  UNIQUE(workspace_id, code)
);

-- Journey steps
CREATE TABLE IF NOT EXISTS journey_step (
  journey_step_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey(journey_id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  title text NOT NULL,
  action text NOT NULL,                       -- What the user does
  expects text,                               -- Expected system response
  screen text,                                -- Route: "/shifts/:id"
  component text,                             -- "ShiftDetailModal"
  data_reads text[] NOT NULL DEFAULT '{}',
  data_writes text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(journey_id, step_order)
);

-- Audit log for status changes and events
CREATE TABLE IF NOT EXISTS journey_event (
  journey_event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey(journey_id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  event_type journey_event_type NOT NULL,
  from_status public.journey_status,
  to_status public.journey_status,
  actor_id uuid REFERENCES user_identity(user_id),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Test run history
CREATE TABLE IF NOT EXISTS journey_test_run (
  journey_test_run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id uuid NOT NULL REFERENCES journey(journey_id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  result journey_test_result NOT NULL,
  duration_ms integer,
  error_message text,
  test_output jsonb,
  triggered_by uuid REFERENCES user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_journey_workspace ON journey(workspace_id);
CREATE INDEX IF NOT EXISTS idx_journey_module ON journey(module);
CREATE INDEX IF NOT EXISTS idx_journey_status ON journey(status);
CREATE INDEX IF NOT EXISTS idx_journey_priority ON journey(priority);
CREATE INDEX IF NOT EXISTS idx_journey_step_journey ON journey_step(journey_id);
CREATE INDEX IF NOT EXISTS idx_journey_event_journey ON journey_event(journey_id);
CREATE INDEX IF NOT EXISTS idx_journey_event_created ON journey_event(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_test_run_journey ON journey_test_run(journey_id);

-- Updated_at triggers
DROP TRIGGER IF EXISTS set_journey_updated_at ON journey;
CREATE TRIGGER set_journey_updated_at
  BEFORE UPDATE ON journey
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_journey_step_updated_at ON journey_step;
CREATE TRIGGER set_journey_step_updated_at
  BEFORE UPDATE ON journey_step
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE journey ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_step ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_event ENABLE ROW LEVEL SECURITY;
ALTER TABLE journey_test_run ENABLE ROW LEVEL SECURITY;

-- Platform admin (godmode) full access
DROP POLICY IF EXISTS "godmode_journey_all" ON journey;
CREATE POLICY "godmode_journey_all" ON journey
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );

DROP POLICY IF EXISTS "godmode_journey_step_all" ON journey_step;
CREATE POLICY "godmode_journey_step_all" ON journey_step
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );

DROP POLICY IF EXISTS "godmode_journey_event_all" ON journey_event;
CREATE POLICY "godmode_journey_event_all" ON journey_event
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );

DROP POLICY IF EXISTS "godmode_journey_test_run_all" ON journey_test_run;
CREATE POLICY "godmode_journey_test_run_all" ON journey_test_run
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );

-- Workspace-scoped read access (admins can view)
DROP POLICY IF EXISTS "workspace_journey_read" ON journey;
CREATE POLICY "workspace_journey_read" ON journey
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "workspace_journey_step_read" ON journey_step;
CREATE POLICY "workspace_journey_step_read" ON journey_step
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "workspace_journey_event_read" ON journey_event;
CREATE POLICY "workspace_journey_event_read" ON journey_event
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );

DROP POLICY IF EXISTS "workspace_journey_test_run_read" ON journey_test_run;
CREATE POLICY "workspace_journey_test_run_read" ON journey_test_run
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
