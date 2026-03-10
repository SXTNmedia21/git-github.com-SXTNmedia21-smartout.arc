-- Document extraction logs: persist every AI analysis response
-- Raw response kept for debugging, processed_result is PD-stripped

CREATE TABLE IF NOT EXISTS document_extraction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  storage_paths text[] NOT NULL DEFAULT '{}',
  raw_ai_response jsonb NOT NULL DEFAULT '{}',
  processed_result jsonb NOT NULL DEFAULT '{}',
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE document_extraction_log ENABLE ROW LEVEL SECURITY;

-- JWT policy: workspace members can read their own logs
CREATE POLICY "workspace_member_read_extraction_log"
  ON document_extraction_log FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT policy: workspace members can insert logs (via edge function)
CREATE POLICY "workspace_member_insert_extraction_log"
  ON document_extraction_log FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- Index for workspace lookup
CREATE INDEX idx_extraction_log_workspace ON document_extraction_log(workspace_id);
