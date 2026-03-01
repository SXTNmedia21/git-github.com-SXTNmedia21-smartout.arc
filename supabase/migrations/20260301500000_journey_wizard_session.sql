-- ============================================
-- Journey wizard session table.
-- Stores AI wizard conversations for defining new journeys.
-- Each session tracks the 6-phase wizard flow, persists
-- messages as JSONB, and builds up a draft journey progressively.
-- Connected to: journey table (journey_id set on completion)
-- ============================================

-- Wizard session status
CREATE TYPE wizard_session_status AS ENUM ('active', 'completed', 'abandoned');

-- Wizard phase progression
CREATE TYPE wizard_phase AS ENUM (
  'discovery',
  'classification',
  'steps',
  'testing',
  'documentation',
  'review'
);

-- Wizard session table
CREATE TABLE wizard_session (
  wizard_session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  journey_id uuid REFERENCES journey(journey_id) ON DELETE SET NULL,
  status wizard_session_status NOT NULL DEFAULT 'active',
  current_phase wizard_phase NOT NULL DEFAULT 'discovery',
  messages jsonb NOT NULL DEFAULT '[]',
  draft_journey jsonb NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES user_identity(user_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Indexes
CREATE INDEX idx_wizard_session_workspace ON wizard_session(workspace_id);
CREATE INDEX idx_wizard_session_status ON wizard_session(status);
CREATE INDEX idx_wizard_session_created_by ON wizard_session(created_by);

-- Updated_at trigger
CREATE TRIGGER set_wizard_session_updated_at
  BEFORE UPDATE ON wizard_session
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE wizard_session ENABLE ROW LEVEL SECURITY;

-- Platform admin (godmode) full access
CREATE POLICY "godmode_wizard_session_all" ON wizard_session
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_godmode = true)
  );

-- Workspace-scoped read access
CREATE POLICY "workspace_wizard_session_read" ON wizard_session
  FOR SELECT USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  );
