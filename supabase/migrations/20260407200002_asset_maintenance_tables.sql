SET search_path TO public, extensions;

-- ============================================
-- Equipment/asset lifecycle: maintenance logs + downtime.
-- Extends existing asset table with operational tracking.
-- ============================================

-- 1. Add API key RLS to existing asset table (missing)
DROP POLICY IF EXISTS "api_key_read_asset" ON asset;
CREATE POLICY "api_key_read_asset" ON asset
  FOR SELECT USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

-- 2. Add columns to asset table for richer equipment data
ALTER TABLE asset ADD COLUMN IF NOT EXISTS asset_type TEXT;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS serial_number TEXT;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC(12,2);
ALTER TABLE asset ADD COLUMN IF NOT EXISTS warranty_expires DATE;
ALTER TABLE asset ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES department(department_id);

-- 3. Maintenance log
CREATE TABLE IF NOT EXISTS public.asset_maintenance (
  maintenance_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  asset_id          UUID NOT NULL REFERENCES asset(asset_id) ON DELETE CASCADE,
  maintenance_type  TEXT NOT NULL,
  description       TEXT NOT NULL,
  cost              NUMERIC(10,2),
  performed_by      TEXT,
  performed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_scheduled    TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE asset_maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_asset_maintenance" ON asset_maintenance;
CREATE POLICY "jwt_read_asset_maintenance" ON asset_maintenance
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_manage_asset_maintenance" ON asset_maintenance;
CREATE POLICY "jwt_manage_asset_maintenance" ON asset_maintenance
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

DROP POLICY IF EXISTS "api_key_read_asset_maintenance" ON asset_maintenance;
CREATE POLICY "api_key_read_asset_maintenance" ON asset_maintenance
  FOR SELECT USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

DROP POLICY IF EXISTS "service_role_asset_maintenance" ON asset_maintenance;
CREATE POLICY "service_role_asset_maintenance" ON asset_maintenance
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_asset_maintenance_asset ON asset_maintenance (asset_id, performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_maintenance_workspace ON asset_maintenance (workspace_id, performed_at DESC);
CREATE TRIGGER set_asset_maintenance_updated_at BEFORE UPDATE ON asset_maintenance FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 4. Downtime tracking
CREATE TABLE IF NOT EXISTS public.asset_downtime (
  downtime_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  asset_id          UUID NOT NULL REFERENCES asset(asset_id) ON DELETE CASCADE,
  started_at        TIMESTAMPTZ NOT NULL,
  ended_at          TIMESTAMPTZ,
  reason            TEXT NOT NULL,
  impact_description TEXT,
  estimated_revenue_impact NUMERIC(12,2),
  reported_by       UUID REFERENCES profile(profile_id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE asset_downtime ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jwt_read_asset_downtime" ON asset_downtime;
CREATE POLICY "jwt_read_asset_downtime" ON asset_downtime
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "jwt_manage_asset_downtime" ON asset_downtime;
CREATE POLICY "jwt_manage_asset_downtime" ON asset_downtime
  FOR ALL USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

DROP POLICY IF EXISTS "api_key_read_asset_downtime" ON asset_downtime;
CREATE POLICY "api_key_read_asset_downtime" ON asset_downtime
  FOR SELECT USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);

DROP POLICY IF EXISTS "service_role_asset_downtime" ON asset_downtime;
CREATE POLICY "service_role_asset_downtime" ON asset_downtime
  FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_asset_downtime_asset ON asset_downtime (asset_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_downtime_active ON asset_downtime (workspace_id)
  WHERE ended_at IS NULL;
CREATE TRIGGER set_asset_downtime_updated_at BEFORE UPDATE ON asset_downtime FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE asset_maintenance IS 'Equipment maintenance log: repairs, inspections, scheduled service.';
COMMENT ON TABLE asset_downtime IS 'Equipment downtime tracking with revenue impact estimation.';
