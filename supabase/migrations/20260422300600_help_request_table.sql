-- Komm Redesign — Help Request table for help desk tickets
-- Employees can create help requests, managers/admins can resolve them

CREATE TABLE IF NOT EXISTS help_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(workspace_id),
  profile_id uuid NOT NULL REFERENCES profile(profile_id) ON DELETE RESTRICT,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  resolved_by uuid REFERENCES profile(profile_id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE help_request ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_help_request_workspace ON help_request(workspace_id);
CREATE INDEX idx_help_request_profile ON help_request(profile_id);
CREATE INDEX idx_help_request_status ON help_request(status) WHERE status != 'closed';

CREATE TRIGGER set_updated_at BEFORE UPDATE ON help_request
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Workspace members can see all help requests in their workspace
CREATE POLICY "help_request_jwt_select" ON help_request FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- Users can create help requests for themselves
CREATE POLICY "help_request_jwt_insert" ON help_request FOR INSERT WITH CHECK (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
  AND workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);

-- Only managers/admins/owners can update (resolve) help requests
CREATE POLICY "help_request_jwt_update" ON help_request FOR UPDATE USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM profile
    WHERE user_id = auth.uid()
      AND workspace_id = help_request.workspace_id
      AND role IN ('manager', 'admin', 'owner')
  )
);

-- API key access
CREATE POLICY "help_request_api_select" ON help_request FOR SELECT
  USING (workspace_id = get_api_workspace_id());
