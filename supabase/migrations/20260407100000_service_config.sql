-- Service configuration tables for platform admin service management
-- No workspace_id — this is platform-level config

-- Service type enum
CREATE TYPE service_type AS ENUM ('docker', 'vercel', 'edge-function', 'external');

-- Service status enum
CREATE TYPE service_status AS ENUM ('active', 'stopped', 'error', 'unconfigured');

-- Config change type (runtime = no restart needed, restart = needs restart)
CREATE TYPE config_change_type AS ENUM ('runtime', 'restart');

-- Main table
CREATE TABLE service_config (
  service_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  type                service_type NOT NULL,
  status              service_status NOT NULL DEFAULT 'unconfigured',
  description         TEXT,
  host_url            TEXT,
  health_endpoint     TEXT DEFAULT '/health',
  docker_service_name TEXT,
  docker_image        TEXT,
  vercel_project_id   TEXT,

  -- Config: non-secret key-value pairs (URLs, ports, feature flags)
  config              JSONB NOT NULL DEFAULT '{}',

  -- Which env vars this service needs (schema definition, not values)
  env_schema          JSONB NOT NULL DEFAULT '[]',

  -- Vault secret names this service uses (references platform_external_secret)
  vault_secrets       TEXT[] NOT NULL DEFAULT '{}',

  -- Metadata
  version             TEXT,
  port                INTEGER,
  tags                TEXT[] NOT NULL DEFAULT '{}',
  is_critical         BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: only super admins (is_godmode)
ALTER TABLE service_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_full_access" ON service_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_identity
      WHERE user_id = auth.uid() AND is_godmode = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_identity
      WHERE user_id = auth.uid() AND is_godmode = true
    )
  );

-- Service role bypass for backend reads
CREATE POLICY "service_role_access" ON service_config
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Updated_at trigger (reuses existing public.set_updated_at())
CREATE TRIGGER set_service_config_updated_at
  BEFORE UPDATE ON service_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Config change log (audit trail)
CREATE TABLE service_config_log (
  log_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id    UUID NOT NULL REFERENCES service_config(service_id) ON DELETE CASCADE,
  changed_by    UUID NOT NULL REFERENCES auth.users(id),
  change_type   config_change_type NOT NULL,
  field_name    TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  applied       BOOLEAN NOT NULL DEFAULT false,
  applied_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE service_config_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_read_log" ON service_config_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_identity
      WHERE user_id = auth.uid() AND is_godmode = true
    )
  );

CREATE POLICY "service_role_full_log" ON service_config_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_service_config_slug ON service_config(slug);
CREATE INDEX idx_service_config_log_service ON service_config_log(service_id, created_at DESC);
