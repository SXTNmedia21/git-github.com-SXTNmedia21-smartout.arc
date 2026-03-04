SET search_path TO public, extensions;

-- ============================================
-- create_custom_report.sql
-- Stores AI-generated custom reports per workspace.
-- Each report has a JSONB config describing data source,
-- metrics, grouping, filters, and visualization type.
-- Connected to: packages/ai/src/tools/report/ (AI report builder)
-- ============================================

CREATE TABLE IF NOT EXISTS custom_report (
  report_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(workspace_id),
  name         TEXT NOT NULL,
  description  TEXT,
  config       JSONB NOT NULL,
  created_by   UUID NOT NULL REFERENCES profile(profile_id),
  updated_by   UUID REFERENCES profile(profile_id),
  is_pinned    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: workspace-scoped (JWT auth only — internal dashboard feature)
ALTER TABLE custom_report ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_member_read" ON custom_report;
CREATE POLICY "workspace_member_read" ON custom_report
  FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "workspace_member_insert" ON custom_report;
CREATE POLICY "workspace_member_insert" ON custom_report
  FOR INSERT
  WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "workspace_member_update" ON custom_report;
CREATE POLICY "workspace_member_update" ON custom_report
  FOR UPDATE
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "workspace_member_delete" ON custom_report;
CREATE POLICY "workspace_member_delete" ON custom_report
  FOR DELETE
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- Auto-update updated_at on row changes
DROP TRIGGER IF EXISTS set_updated_at ON custom_report;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON custom_report
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
