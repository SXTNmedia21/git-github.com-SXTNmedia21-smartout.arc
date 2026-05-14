-- ============================================================
-- 20260611120050_wfm_vault_helper.sql
-- Per-workspace POS OAuth credential helpers (Vault Tier 2)
--
-- PURPOSE
-- -------
-- Ships two SECURITY DEFINER functions for storing and resolving
-- per-workspace Lightspeed OAuth tokens in Supabase Vault (pgsodium).
--
-- Why separate from 20260611120000_wfm_foundation.sql?
-- Vault helper functions are a distinct concern:
-- (a) they require vault.* schema access via SECURITY DEFINER,
-- (b) they can be replaced/extended independently of table DDL,
-- (c) the protocol doc update ("first-of-kind Vault Tier 2 precedent")
--     is cleaner in its own migration comment block.
--
-- Per-workspace external API credentials MUST use Vault Tier 2 (Supabase
-- pgsodium vault), NOT op:// per-workspace secrets (op:// is for server-wide
-- config, not per-tenant runtime credentials). See secrets-protocol skill,
-- §"Vault Tier 2 — per-workspace external API credentials".
--
-- FUNCTIONS SHIPPED
-- -----------------
-- fn_pos_credentials_upsert(workspace_id, vendor, token) → UUID
--   Creates or replaces the Vault secret and updates pos_account.credentials_vault_id.
--   Called by: admin OAuth connect flow (C1 sortie Edge Function).
--   Caller must be service_role.
--
-- fn_pos_credentials_resolve(workspace_id, vendor) → TEXT
--   Returns decrypted OAuth token for pos-sync Edge Function.
--   Returns NULL if no vault secret exists (pos-sync early-exits on NULL).
--   Caller must be service_role.
--
-- SECURITY MODEL
-- --------------
-- Both functions are SECURITY DEFINER (run as owner, which is postgres).
-- Callers are restricted to service_role via runtime CHECK.
-- This pattern mirrors the activity_trail platform-actor pattern (L-0activity-trail-platform-actor).
-- The vault.decrypted_secrets view handles pgsodium decryption transparently.
--
-- IDEMPOTENCY
-- -----------
-- fn_pos_credentials_upsert: name-based lookup → update if exists, create if not.
-- fn_pos_credentials_resolve: always reads vault.decrypted_secrets; no side effects.
-- Both functions survive db reset + replay (CREATE OR REPLACE).
--
-- References:
--   ADR-0305 (POS adapter pattern — credentials model)
--   secrets-protocol (Vault Tier 2 — pgsodium for per-tenant credentials)
--   smartout-edge-function-guide (§"API Key Tiers", Tier 2 = Supabase Vault)
--   L-0activity-trail-platform-actor (SECURITY DEFINER + activity_trail INSERT pattern)
-- ============================================================

SET search_path TO public, extensions;

-- ─── fn_pos_credentials_upsert ────────────────────────────────────────────────
-- Creates or replaces the Vault secret for a workspace+vendor combination.
-- Secret name convention: 'pos:<workspace_id>:<vendor>' (unique, searchable).
-- Updates pos_account.credentials_vault_id to point at the vault secret UUID.
-- Writes activity_trail row for audit (SECURITY DEFINER bypasses RLS so the
-- trigger cannot rely on auth.uid() — we pass actor_id explicitly).
--
-- Returns: vault.secrets.id UUID (the secret identifier, NOT the token).

CREATE OR REPLACE FUNCTION public.fn_pos_credentials_upsert(
  p_workspace_id  UUID,
  p_vendor        TEXT,
  p_token         TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_secret_name TEXT;
  v_secret_id   UUID;
  v_description TEXT;
BEGIN
  -- Caller must be service_role (OAuth connect flow from Edge Function).
  -- Plain users must never call this directly.
  IF current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'fn_pos_credentials_upsert: caller must be service_role';
  END IF;

  -- Validate inputs — fail-fast per L-0177
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'fn_pos_credentials_upsert: p_workspace_id must not be NULL';
  END IF;
  IF p_vendor IS NULL OR p_vendor = '' THEN
    RAISE EXCEPTION 'fn_pos_credentials_upsert: p_vendor must not be NULL or empty';
  END IF;
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'fn_pos_credentials_upsert: p_token must not be NULL or empty';
  END IF;

  -- Verify pos_account row exists for this workspace+vendor (caller must create it first)
  IF NOT EXISTS (
    SELECT 1 FROM public.pos_account
    WHERE workspace_id = p_workspace_id AND vendor = p_vendor
  ) THEN
    RAISE EXCEPTION 'fn_pos_credentials_upsert: no pos_account row for workspace_id=% vendor=%',
      p_workspace_id, p_vendor;
  END IF;

  v_secret_name := 'pos:' || p_workspace_id::TEXT || ':' || p_vendor;
  v_description := 'POS OAuth token — workspace ' || p_workspace_id::TEXT || ' vendor ' || p_vendor;

  -- Check if secret already exists (name-based lookup in vault)
  SELECT id INTO v_secret_id
  FROM vault.secrets
  WHERE name = v_secret_name
  LIMIT 1;

  IF v_secret_id IS NOT NULL THEN
    -- Update existing secret in vault
    PERFORM vault.update_secret(
      v_secret_id,
      p_token,           -- new_secret
      v_secret_name,     -- new_name (unchanged)
      v_description      -- new_description (unchanged)
    );
  ELSE
    -- Create new vault secret
    v_secret_id := vault.create_secret(
      p_token,
      v_secret_name,
      v_description
    );
  END IF;

  -- Update pos_account to point at the vault secret
  UPDATE public.pos_account
  SET
    credentials_vault_id = v_secret_id,
    updated_at           = now()
  WHERE workspace_id = p_workspace_id
    AND vendor       = p_vendor;

  -- Activity trail: audit that credentials were (re)set.
  -- SECURITY DEFINER bypasses RLS; we write directly.
  -- workspace_id is non-null (validated above); actor_id = service caller sentinel.
  INSERT INTO public.activity_trail (
    workspace_id,
    actor_id,
    event,
    action_verb,
    category,
    entity_type,
    entity_id,
    data
  ) VALUES (
    p_workspace_id,
    -- actor_id: service-role callers have no profile_id; sentinel UUID per L-0activity-trail-platform-actor
    '00000000-0000-0000-0000-000000000001'::UUID,
    'pos_account.credentials_upserted',
    'upsert',
    'operations',
    'pos_account',
    (SELECT pos_account_id FROM public.pos_account WHERE workspace_id = p_workspace_id AND vendor = p_vendor),
    jsonb_build_object(
      'vendor',          p_vendor,
      'vault_secret_id', v_secret_id,
      'fn',              'fn_pos_credentials_upsert'
    )
  );

  RETURN v_secret_id;
END;
$$;

COMMENT ON FUNCTION public.fn_pos_credentials_upsert IS
  'ADR-0305 + secrets-protocol: Creates or replaces per-workspace POS OAuth token in Supabase Vault. '
  'Secret name: ''pos:<workspace_id>:<vendor>''. '
  'Caller must be service_role (admin OAuth connect Edge Function). '
  'Returns vault.secrets.id UUID — NOT the token. '
  'Updates pos_account.credentials_vault_id. Writes activity_trail audit row. '
  'First-of-kind Vault Tier 2 precedent — see docs/protocols/SECURITY.md §"Per-workspace external API credentials".';


-- ─── fn_pos_credentials_resolve ───────────────────────────────────────────────
-- Returns the decrypted OAuth token for the given workspace+vendor.
-- Used exclusively by pos-sync Edge Function (service-role caller).
-- Returns NULL if no vault secret exists; caller (pos-sync) MUST early-exit on NULL.
-- Never logs the token value to activity_trail — only resolution attempt.

CREATE OR REPLACE FUNCTION public.fn_pos_credentials_resolve(
  p_workspace_id  UUID,
  p_vendor        TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_secret_name TEXT;
  v_decrypted   TEXT;
BEGIN
  -- Caller must be service_role (pos-sync Edge Function only).
  IF current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'fn_pos_credentials_resolve: caller must be service_role';
  END IF;

  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'fn_pos_credentials_resolve: p_workspace_id must not be NULL';
  END IF;
  IF p_vendor IS NULL OR p_vendor = '' THEN
    RAISE EXCEPTION 'fn_pos_credentials_resolve: p_vendor must not be NULL or empty';
  END IF;

  v_secret_name := 'pos:' || p_workspace_id::TEXT || ':' || p_vendor;

  -- vault.decrypted_secrets view handles pgsodium decryption transparently.
  -- Returns NULL if no matching secret exists (pos-sync early-exits on NULL per Journey 1).
  SELECT decrypted_secret INTO v_decrypted
  FROM vault.decrypted_secrets
  WHERE name = v_secret_name
  LIMIT 1;

  -- Intentionally NOT writing activity_trail here:
  -- (a) High-frequency (every 5-min cron tick) — would bloat activity_trail.
  -- (b) Token value must never appear in logs. Resolution attempt logged only
  --     at pos-sync Edge Function level (aggregated per sync run).
  RETURN v_decrypted;
END;
$$;

COMMENT ON FUNCTION public.fn_pos_credentials_resolve IS
  'ADR-0305 + secrets-protocol: Resolves per-workspace POS OAuth token from Supabase Vault. '
  'Caller must be service_role (pos-sync Edge Function only). '
  'Returns NULL when no vault secret found — caller (pos-sync) MUST early-exit on NULL. '
  'NEVER logs decrypted token value. High-frequency: do not add activity_trail calls here '
  '(log at pos-sync aggregated-run level instead). '
  'Uses vault.decrypted_secrets view (pgsodium transparent decryption).';
