SET search_path TO public, extensions;

-- ============================================
-- 20260513000002_billing_integration_oauth_state_table.sql
-- Billing Engine Fase 3B — B1 Migration C
--
-- State-nonce table for workspace OAuth flows (Spor E). When a
-- workspace-admin clicks "Koble til Fiken" / "Koble til Tripletex" we
-- generate a random nonce and bind it to (workspace_id, user_id,
-- integration_type) with a 10-minute TTL. The provider redirects back
-- to integration-oauth-callback with the nonce; the callback verifies
-- the binding before exchanging the code for tokens.
--
-- Why a dedicated table over signed JWT-in-cookie:
--   - JWT-in-cookie would survive device switches (phone → desktop)
--     which is a UX we do not want for this flow.
--   - Table gives us a clean audit trail (consumed_at, expires_at)
--     and a natural cleanup boundary.
--   - Table is service-role-only (no workspace-admin direct access);
--     the Edge Function callback writes + reads via service_role.
--
-- Idempotency:
--   - state_nonce is UNIQUE. Double-click on "Connect" generates two
--     nonces; only the one the provider redirects with gets consumed.
--   - consumed_at gates re-use: callback refuses to process a nonce
--     that has already been consumed.
--
-- Retention:
--   - expires_at default = 10 minutes. The pg_cron sweeper in
--     Migration G drops rows that are past TTL AND not consumed.
--
-- Ref: Fase 3B spec §5, ADR-0136 (Vault token storage).
-- ============================================

CREATE TABLE public.billing_integration_oauth_state (
  state_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The nonce Smartout generates and sends to the provider. Returned
  -- verbatim in the `state` query param of the OAuth redirect.
  state_nonce       text NOT NULL UNIQUE,

  workspace_id      uuid NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES public.user_identity(user_id),

  -- Drives which provider's token endpoint the callback hits. Matches
  -- billing_integration_type enum values: 'fiken' | 'tripletex'.
  -- Left as text (not the enum) because we might accept new providers
  -- here before the enum catches up.
  integration_type  text NOT NULL
    CHECK (integration_type IN ('fiken', 'tripletex')),

  -- The exact redirect_uri the provider will call back to. Stored
  -- verbatim so the callback can assert the provider honoured it.
  redirect_uri      text NOT NULL,

  created_at        timestamptz NOT NULL DEFAULT now(),
  -- 10-minute TTL — well inside the typical user-attention window while
  -- staying short enough that stolen nonces are unusable.
  expires_at        timestamptz NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),

  -- Set by integration-oauth-callback when the nonce is used. NULL
  -- while the flow is still in-flight. Any subsequent lookup checks
  -- consumed_at IS NULL before proceeding.
  consumed_at       timestamptz NULL
);

-- ── Indexes ──────────────────────────────────────────────────
-- Sweeper hot path: "which unconsumed rows are past TTL?".
CREATE INDEX idx_oauth_state_cleanup
  ON public.billing_integration_oauth_state(expires_at)
  WHERE consumed_at IS NULL;

-- Workspace lookup for audit ("show all OAuth attempts from this workspace").
CREATE INDEX idx_oauth_state_workspace
  ON public.billing_integration_oauth_state(workspace_id, created_at DESC);

-- ── Comments ─────────────────────────────────────────────────
COMMENT ON TABLE public.billing_integration_oauth_state IS
  'Short-lived state-nonce table for workspace OAuth flows. Bind (workspace_id, user_id, integration_type) to a random nonce at initiation; integration-oauth-callback Edge Function verifies the binding before token exchange. Platform-admin-only RLS — workspace users never query this directly. See Fase 3B spec §5.2.';

COMMENT ON COLUMN public.billing_integration_oauth_state.state_nonce IS
  'Random URL-safe string sent to the OAuth provider as the `state` query param and returned verbatim in the callback. UNIQUE so double-submits collapse.';

COMMENT ON COLUMN public.billing_integration_oauth_state.expires_at IS
  '10-minute TTL. Sweeper (20260513000006_oauth_state_cleanup_trigger.sql) deletes rows where expires_at < now() AND consumed_at IS NULL.';

COMMENT ON COLUMN public.billing_integration_oauth_state.consumed_at IS
  'Set by integration-oauth-callback on successful nonce verification. Prevents replay attacks — callback refuses to process a row where this is not NULL.';
