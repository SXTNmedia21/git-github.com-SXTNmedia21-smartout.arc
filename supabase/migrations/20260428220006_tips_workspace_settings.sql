-- ============================================
-- 20260428220006_tips_workspace_settings.sql
-- tips_workspace_settings: opt-in toggle for Tips module (1:1 with workspace).
--
-- Deviation from plan (Task 1.7): plan assumed `workspace_setting` table exists.
-- Phase 2.5 fact-check found no global `workspace_setting` table — repo uses
-- per-domain settings tables (e.g., payroll_workspace_settings per
-- 20260422110100_payroll_config_tables.sql). This migration creates
-- `tips_workspace_settings` mirroring that pattern exactly.
--
-- Opt-in model: no row = tips_enabled false (row only created when admin
-- first toggles). No backfill for existing workspaces.
-- Campaign: tips-handling · Sub-sortie: tips-data-model
-- ============================================

SET search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.tips_workspace_settings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  tips_enabled    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tips_settings_workspace UNIQUE (workspace_id)
);

ALTER TABLE tips_workspace_settings ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members can read their settings
DROP POLICY IF EXISTS "jwt_select_tips_workspace_settings" ON tips_workspace_settings;
CREATE POLICY "jwt_select_tips_workspace_settings" ON tips_workspace_settings
  FOR SELECT USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: admin inserts (opt-in creates the row)
DROP POLICY IF EXISTS "jwt_insert_tips_workspace_settings" ON tips_workspace_settings;
CREATE POLICY "jwt_insert_tips_workspace_settings" ON tips_workspace_settings
  FOR INSERT WITH CHECK (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: admin updates (toggle tips_enabled)
DROP POLICY IF EXISTS "jwt_update_tips_workspace_settings" ON tips_workspace_settings;
CREATE POLICY "jwt_update_tips_workspace_settings" ON tips_workspace_settings
  FOR UPDATE USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- API key: workspace-scoped read
DROP POLICY IF EXISTS "api_key_read_tips_workspace_settings" ON tips_workspace_settings;
CREATE POLICY "api_key_read_tips_workspace_settings" ON tips_workspace_settings
  FOR SELECT USING (workspace_id = get_api_workspace_id());

-- Service role: full access
DROP POLICY IF EXISTS "service_role_tips_workspace_settings" ON tips_workspace_settings;
CREATE POLICY "service_role_tips_workspace_settings" ON tips_workspace_settings
  FOR ALL USING (auth.role() = 'service_role');

-- Note: No JWT DELETE policy — intentional. Settings row is 1:1 with workspace and should not be deleted from UI. Reset by setting tips_enabled = false.

DROP TRIGGER IF EXISTS set_tips_workspace_settings_updated_at ON public.tips_workspace_settings;
CREATE TRIGGER set_tips_workspace_settings_updated_at
  BEFORE UPDATE ON public.tips_workspace_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE tips_workspace_settings IS 'Tips module workspace-level settings. 1:1 with workspace (UNIQUE). Opt-in: no row = tips disabled. Row created when admin first toggles tips on.';
COMMENT ON COLUMN tips_workspace_settings.tips_enabled IS 'Master toggle for Tips module. false (default) = Tips UI hidden everywhere. Hooks read false when no row exists for workspace.';
