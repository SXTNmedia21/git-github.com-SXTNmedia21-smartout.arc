-- Financial Close Configuration — per-workspace tolerance and approval settings.
-- 1:1 with workspace. Seeded by bootstrap or created on first admin visit.

CREATE TABLE IF NOT EXISTS financial_close_config (
  config_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  tolerance_type text NOT NULL DEFAULT 'fixed' CHECK (tolerance_type IN ('fixed', 'percentage')),
  tolerance_value numeric(10,2) NOT NULL DEFAULT 50,
  require_cash_count boolean NOT NULL DEFAULT true,
  cash_tolerance_type text NOT NULL DEFAULT 'fixed' CHECK (cash_tolerance_type IN ('fixed', 'percentage')),
  cash_tolerance_value numeric(10,2) NOT NULL DEFAULT 20,
  approval_required boolean NOT NULL DEFAULT true,
  approval_deadline_hours integer NOT NULL DEFAULT 24,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE financial_close_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_read_close_config"
  ON financial_close_config FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

CREATE POLICY "workspace_admin_write_close_config"
  ON financial_close_config FOR INSERT
  WITH CHECK (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "workspace_admin_update_close_config"
  ON financial_close_config FOR UPDATE
  USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON financial_close_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
