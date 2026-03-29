-- ShiftClock configuration table — cascading: team > department > workspace
--
-- Stores per-workspace (and optionally per-department or per-team) settings
-- that control GPS enforcement, ad-hoc shift creation, and the punch window.
-- The UNIQUE constraint on (workspace_id, department_id, team_id) ensures
-- exactly one config row per scope level.

-- Table may already exist from 20260324100001_shift_clock_mobile_fixes.sql
-- Use DROP + re-create to ensure FK constraints (ON DELETE CASCADE) and policies are correct
DROP TABLE IF EXISTS shift_clock_config CASCADE;

CREATE TABLE shift_clock_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id            UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id           UUID REFERENCES department(department_id) ON DELETE CASCADE,
  team_id                 UUID REFERENCES team(team_id) ON DELETE CASCADE,
  gps_required            BOOLEAN NOT NULL DEFAULT false,
  gps_radius_meters       INT NOT NULL DEFAULT 200,
  gps_reference_lat       NUMERIC(10,7),
  gps_reference_lng       NUMERIC(10,7),
  adhoc_shifts_enabled    BOOLEAN NOT NULL DEFAULT false,
  adhoc_requires_approval BOOLEAN NOT NULL DEFAULT true,
  punch_window_minutes    INT NOT NULL DEFAULT 30,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_shift_clock_config UNIQUE (workspace_id, department_id, team_id)
);

CREATE TRIGGER set_shift_clock_config_updated_at
  BEFORE UPDATE ON shift_clock_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE shift_clock_config ENABLE ROW LEVEL SECURITY;

-- JWT: all workspace members can read (needed to render punch UI with correct settings)
CREATE POLICY "jwt_read_shift_clock_config" ON shift_clock_config
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: admins can manage (create, update, delete config per scope)
CREATE POLICY "jwt_manage_shift_clock_config" ON shift_clock_config
  FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

-- API key: workspace-scoped read for external integrations
CREATE POLICY "api_key_read_shift_clock_config" ON shift_clock_config
  FOR SELECT USING (workspace_id = get_api_workspace_id());
