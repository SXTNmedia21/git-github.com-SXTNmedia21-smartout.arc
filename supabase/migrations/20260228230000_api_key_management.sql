-- =============================================================
-- API Key Management System
-- 3-tier: SHA-256 hashed keys (Tier 1+3), Vault for external secrets (Tier 2)
-- Ref: docs/architecture/SMARTOUT_SECRET_API_INFRASTRUCTURE.md
-- =============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- Revoke vault access from public roles
REVOKE ALL ON vault.decrypted_secrets FROM anon, authenticated;

-- ── Enums ──

CREATE TYPE public.api_key_version_status AS ENUM ('current', 'previous', 'revoked');
CREATE TYPE public.api_key_type AS ENUM ('workspace', 'service');

-- ── API Key Registry (Tier 1 + Tier 3) ──

CREATE TABLE public.platform_api_key (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  company_id            uuid REFERENCES public.company(company_id) ON DELETE CASCADE,
  created_by            uuid NOT NULL REFERENCES public.user_identity(user_id),

  -- Identity
  name                  text NOT NULL,
  description           text,
  key_type              api_key_type NOT NULL DEFAULT 'workspace',
  environment           text NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'test')),

  -- Key material (ONLY hash stored, never plaintext)
  key_hash              varchar(64) NOT NULL,
  key_prefix            varchar(40) NOT NULL,

  -- Version & rotation
  version               api_key_version_status NOT NULL DEFAULT 'current',
  rotation_number       integer NOT NULL DEFAULT 1,
  grace_period_ends_at  timestamptz,

  -- Scopes & limits
  scopes                text[] NOT NULL DEFAULT '{}',
  rate_limit_per_minute integer DEFAULT 60,
  allowed_ips           inet[],

  -- Timestamps
  last_used_at          timestamptz,
  demoted_at            timestamptz,
  revoked_at            timestamptz,
  expires_at            timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT uq_key_hash UNIQUE (key_hash),
  CONSTRAINT uq_workspace_version
    UNIQUE (workspace_id, key_type, environment, version)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT chk_workspace_or_service CHECK (
    (key_type = 'workspace' AND workspace_id IS NOT NULL) OR
    (key_type = 'service' AND workspace_id IS NULL)
  )
);

-- Indexes
CREATE INDEX idx_api_key_hash_active
  ON public.platform_api_key (key_hash)
  WHERE version IN ('current', 'previous');

CREATE INDEX idx_api_key_workspace
  ON public.platform_api_key (workspace_id, key_type, environment)
  WHERE version != 'revoked';

CREATE INDEX idx_api_key_grace_expiry
  ON public.platform_api_key (grace_period_ends_at)
  WHERE version = 'previous' AND grace_period_ends_at IS NOT NULL;

-- ── Usage Tracking (hourly buckets, not per-request) ──

CREATE TABLE public.platform_api_key_usage (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id      uuid NOT NULL REFERENCES public.platform_api_key(id) ON DELETE CASCADE,
  period_start    timestamptz NOT NULL,
  request_count   integer NOT NULL DEFAULT 0,
  error_count     integer NOT NULL DEFAULT 0,
  last_endpoint   text,
  last_status     smallint,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_key_period UNIQUE (api_key_id, period_start)
);

CREATE INDEX idx_usage_key_period
  ON public.platform_api_key_usage (api_key_id, period_start DESC);

-- ── External Secret Metadata (Tier 2) ──

CREATE TABLE public.platform_external_secret (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid REFERENCES public.workspace(workspace_id),
  provider              text NOT NULL,
  environment           text NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'test')),
  vault_secret_name     text NOT NULL UNIQUE,
  description           text,

  -- Rotation tracking
  last_rotated_at       timestamptz,
  last_rotated_by       uuid REFERENCES public.user_identity(user_id),
  rotation_reminder_days integer DEFAULT 90,
  expires_at            timestamptz,

  -- Status
  is_active             boolean NOT NULL DEFAULT true,
  last_verified_at      timestamptz,
  last_error_at         timestamptz,
  last_error_message    text,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_external_secret_workspace ON public.platform_external_secret (workspace_id);
CREATE INDEX idx_external_secret_provider ON public.platform_external_secret (provider);
CREATE INDEX idx_external_secret_rotation_due ON public.platform_external_secret (last_rotated_at)
  WHERE is_active = true;

-- ── Updated_at Triggers ──

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.platform_api_key
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.platform_external_secret
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Vault SECURITY DEFINER Wrappers ──
-- PostgREST cannot call vault.create_secret (PGRST202). These allow supabase.rpc().

CREATE OR REPLACE FUNCTION public.get_secret(secret_name text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result text;
BEGIN
  SELECT decrypted_secret INTO result
  FROM vault.decrypted_secrets WHERE name = secret_name;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_secret(
  p_name text, p_secret text, p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_existing_id uuid; v_new_id uuid;
BEGIN
  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = p_name;
  IF v_existing_id IS NOT NULL THEN
    UPDATE vault.secrets SET secret = p_secret WHERE id = v_existing_id;
    RETURN v_existing_id;
  ELSE
    SELECT vault.create_secret(p_secret, p_name, p_description) INTO v_new_id;
    RETURN v_new_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_vault_secret(secret_name text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = secret_name;
  IF v_id IS NULL THEN RETURN false; END IF;
  DELETE FROM vault.secrets WHERE id = v_id;
  RETURN true;
END;
$$;

-- Lock down Vault wrappers: only service_role
REVOKE EXECUTE ON FUNCTION get_secret FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_secret TO service_role;
REVOKE EXECUTE ON FUNCTION upsert_secret FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION upsert_secret TO service_role;
REVOKE EXECUTE ON FUNCTION delete_vault_secret FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_vault_secret TO service_role;

-- ── Key Rotation Function ──

CREATE OR REPLACE FUNCTION public.rotate_api_key(
  p_workspace_id    uuid,
  p_key_type        api_key_type,
  p_environment     text,
  p_new_key_hash    varchar(64),
  p_new_key_prefix  varchar(40),
  p_grace_period    interval DEFAULT '48 hours'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_new_id uuid;
  v_next_rotation integer;
BEGIN
  SELECT COALESCE(MAX(rotation_number), 0) + 1 INTO v_next_rotation
  FROM platform_api_key
  WHERE workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND key_type = p_key_type AND environment = p_environment;

  -- Revoke existing 'previous'
  UPDATE platform_api_key
  SET version = 'revoked', revoked_at = now(), updated_at = now()
  WHERE workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND key_type = p_key_type AND environment = p_environment
    AND version = 'previous';

  -- Demote 'current' to 'previous'
  UPDATE platform_api_key
  SET version = 'previous', demoted_at = now(),
      grace_period_ends_at = now() + p_grace_period, updated_at = now()
  WHERE workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND key_type = p_key_type AND environment = p_environment
    AND version = 'current';

  -- Insert new 'current' (inherit scopes + rate limit from demoted key)
  INSERT INTO platform_api_key (
    workspace_id, company_id, created_by, name, description,
    key_type, environment, key_hash, key_prefix,
    version, rotation_number, scopes, rate_limit_per_minute
  )
  SELECT
    p_workspace_id, company_id, created_by, name, description,
    p_key_type, p_environment, p_new_key_hash, p_new_key_prefix,
    'current', v_next_rotation, scopes, rate_limit_per_minute
  FROM platform_api_key
  WHERE workspace_id IS NOT DISTINCT FROM p_workspace_id
    AND key_type = p_key_type AND environment = p_environment
    AND version = 'previous'
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ── Usage Logging Function (hourly bucket upsert) ──

CREATE OR REPLACE FUNCTION public.log_api_key_usage(
  p_key_id uuid, p_endpoint text, p_status smallint
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_bucket timestamptz := date_trunc('hour', now());
BEGIN
  INSERT INTO platform_api_key_usage (api_key_id, period_start, request_count, error_count, last_endpoint, last_status)
  VALUES (p_key_id, v_bucket, 1, CASE WHEN p_status >= 400 THEN 1 ELSE 0 END, p_endpoint, p_status)
  ON CONFLICT (api_key_id, period_start)
  DO UPDATE SET
    request_count = platform_api_key_usage.request_count + 1,
    error_count = platform_api_key_usage.error_count + CASE WHEN p_status >= 400 THEN 1 ELSE 0 END,
    last_endpoint = p_endpoint,
    last_status = p_status;
END;
$$;

-- ── Grace Period Cleanup ──

CREATE OR REPLACE FUNCTION public.cleanup_expired_api_keys()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_count integer;
BEGIN
  UPDATE platform_api_key
  SET version = 'revoked', revoked_at = now(), updated_at = now()
  WHERE version = 'previous'
    AND grace_period_ends_at IS NOT NULL
    AND grace_period_ends_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── RLS Policies ──

ALTER TABLE public.platform_api_key ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_external_secret ENABLE ROW LEVEL SECURITY;

-- Super-admin: full access to everything
CREATE POLICY "super_admin_all" ON public.platform_api_key FOR ALL
USING (EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_super_admin = true));

CREATE POLICY "super_admin_all" ON public.platform_api_key_usage FOR ALL
USING (EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_super_admin = true));

CREATE POLICY "super_admin_all" ON public.platform_external_secret FOR ALL
USING (EXISTS (SELECT 1 FROM user_identity WHERE user_id = auth.uid() AND is_super_admin = true));

-- Workspace admin/owner: manage their own keys (V2: workspace self-service)
CREATE POLICY "workspace_admin_keys" ON public.platform_api_key FOR ALL
USING (
  workspace_id IN (
    SELECT p.workspace_id FROM profile p
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'owner')
  )
);

CREATE POLICY "workspace_admin_usage" ON public.platform_api_key_usage FOR SELECT
USING (
  api_key_id IN (
    SELECT pak.id FROM platform_api_key pak
    JOIN profile p ON p.workspace_id = pak.workspace_id
    WHERE p.user_id = auth.uid() AND p.role IN ('admin', 'owner')
  )
);

CREATE POLICY "owner_external_secrets" ON public.platform_external_secret FOR ALL
USING (
  workspace_id IN (
    SELECT p.workspace_id FROM profile p
    WHERE p.user_id = auth.uid() AND p.role = 'owner'
  )
);

-- Service role bypasses RLS for Edge Function validation
