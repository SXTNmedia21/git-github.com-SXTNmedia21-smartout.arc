SET search_path TO public, extensions;

-- ============================================
-- 20260511200004_billing_integration_table.sql
-- Billing Engine Fase 2 — B1 Migration E
--
-- Integration registry (config-only). Runtime sync state lives on
-- engine_state + engine_state_step per ADR-0126 — no billing_integration_sync
-- table is created.
--
-- is_placeholder gates audit semantics per ADR-0129: when true, the
-- sync_integration action-handler MUST emit 'integration sync mocked'
-- (not 'succeeded') and prefix billing_activity_log messages with
-- '[PLACEHOLDER]'.
--
-- Ref: Fase 2 spec §4.2, ADR-0126, ADR-0129.
-- ============================================

CREATE TABLE public.billing_integration (
  integration_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = platform-level (Smartout-owned integration). Workspace-scoped
  -- integrations are Fase 3 (UI out-of-scope in Fase 2).
  workspace_id        uuid REFERENCES public.workspace(workspace_id),

  integration_type    billing_integration_type NOT NULL,
  display_name        text NOT NULL,
  -- Type-specific configuration: API URL, auth scheme ref (op://), sync
  -- options. No secrets stored here — only op:// references.
  config              jsonb NOT NULL DEFAULT '{}'::jsonb,

  is_enabled          boolean NOT NULL DEFAULT true,
  -- ADR-0129: gates audit-honest behaviour. PlaceholderAdapter rows MUST
  -- have this TRUE; the action_handler asserts this match and fails if a
  -- real adapter returns 'succeeded' for an is_placeholder=true row.
  is_placeholder      boolean NOT NULL DEFAULT false,

  last_sync_at        timestamptz,
  -- Free-form string bounded by CHECK; more specific enum deferred to Fase 3
  -- when real adapters arrive and the taxonomy stabilises.
  last_sync_status    text
    CHECK (last_sync_status IS NULL OR last_sync_status IN ('ok', 'error', 'partial')),

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Updated-at trigger ───────────────────────────────────────
CREATE TRIGGER set_billing_integration_updated_at
  BEFORE UPDATE ON public.billing_integration
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ──────────────────────────────────────────────────
-- Fan-out query: "all enabled integrations at this scope" for a given event.
CREATE INDEX idx_billing_integration_workspace_type
  ON public.billing_integration(workspace_id, integration_type)
  WHERE is_enabled = true;

-- Placeholder isolation (admin UI, audit reports).
CREATE INDEX idx_billing_integration_placeholder
  ON public.billing_integration(is_placeholder)
  WHERE is_placeholder = true;

-- ── Comments ─────────────────────────────────────────────────
COMMENT ON TABLE public.billing_integration IS
  'Integration config registry. Runtime sync orchestrated via engine_process integration_sync (ADR-0126). is_placeholder gates audit semantics per ADR-0129.';

COMMENT ON COLUMN public.billing_integration.is_placeholder IS
  'ADR-0129: TRUE = PlaceholderAdapter. sync_integration handler emits "integration sync mocked" + prefixes billing_activity_log with [PLACEHOLDER]. Real adapters fail-fast if this is TRUE.';

COMMENT ON COLUMN public.billing_integration.config IS
  'Type-specific configuration. Secrets stored as op:// references (never plaintext). Schema varies per integration_type.';
