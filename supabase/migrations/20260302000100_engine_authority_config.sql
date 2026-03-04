SET search_path TO public, extensions;

-- 20260302000100_engine_authority_config.sql
-- Per-workspace, per-capability authority configuration for Mr. Botsson.

CREATE TABLE IF NOT EXISTS engine_authority_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspace(workspace_id),
  capability    TEXT NOT NULL,
  level         TEXT NOT NULL DEFAULT 'read_only'
                  CHECK (level IN ('autonomous', 'confirm', 'suggest', 'read_only', 'disabled')),
  updated_by    UUID NOT NULL REFERENCES user_identity(user_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_workspace_capability UNIQUE (workspace_id, capability)
);

ALTER TABLE engine_authority_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_authority" ON engine_authority_config;
CREATE POLICY "admin_manage_authority" ON engine_authority_config
FOR ALL USING (
  workspace_id IN (
    SELECT workspace_id FROM public.profile
    WHERE user_id = auth.uid() AND is_active = true AND role IN ('admin', 'owner')
  )
);

DROP POLICY IF EXISTS "api_key_read_authority" ON engine_authority_config;
CREATE POLICY "api_key_read_authority" ON engine_authority_config
FOR SELECT USING (
  workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);

DROP POLICY IF EXISTS "service_manage_authority" ON engine_authority_config;
CREATE POLICY "service_manage_authority" ON engine_authority_config
FOR ALL USING (
  auth.role() = 'service_role'
);

CREATE INDEX IF NOT EXISTS idx_authority_workspace ON engine_authority_config (workspace_id);
