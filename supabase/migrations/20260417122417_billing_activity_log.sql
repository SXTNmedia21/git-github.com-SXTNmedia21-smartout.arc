SET search_path TO public, extensions;

-- ============================================
-- 20260417122417_billing_activity_log.sql
-- Billing Engine Fase 1 — Task 1.7.5 (ADR-0125)
-- Platform-scoped audit trail for billing actions.
-- Supersedes the activity_trail dunning routing from ADR-0118 (which
-- required a profile FK that platform admins don't have).
-- Immutable; service role writes, company admins read their own company.
-- ============================================

CREATE TABLE public.billing_activity_log (
  id              bigserial PRIMARY KEY,
  company_id      uuid NOT NULL REFERENCES public.company(company_id),
  invoice_id      uuid REFERENCES public.invoice(invoice_id),

  event           text NOT NULL,         -- e.g. "invoice issued", "invoice marked_paid",
                                          --      "dunning_note added", "invoice voided"
  entity_type     text NOT NULL,         -- "invoice", "invoice_line_item",
                                          -- "pricing_terms", "credit_note"
  entity_id       uuid NOT NULL,
  data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  changes         jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- user_identity FK (not profile). NULL for cron/system writers.
  -- Per ADR-0125: platform admins write as themselves; cron writes with NULL.
  actor_user_id   uuid REFERENCES public.user_identity(user_id),

  source          text NOT NULL DEFAULT 'web'
    CHECK (source IN ('web', 'mobile', 'api', 'cron', 'system')),

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_log_invoice
  ON public.billing_activity_log(invoice_id, created_at DESC);
CREATE INDEX idx_billing_log_company
  ON public.billing_activity_log(company_id, created_at DESC);
CREATE INDEX idx_billing_log_event
  ON public.billing_activity_log(event, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.billing_activity_log ENABLE ROW LEVEL SECURITY;

-- Company admins/owners can read their own company's billing audit.
CREATE POLICY billing_log_company_admin_read ON public.billing_activity_log
  FOR SELECT TO authenticated
  USING (public.is_admin_in_company(auth.uid(), company_id));

-- No authenticated write policy — all writes via service role (Server
-- Actions + cron). Append-only: no UPDATE or DELETE policies.

COMMENT ON TABLE public.billing_activity_log IS
  'Platform-scoped audit trail for billing (ADR-0125). Supersedes the activity_trail dunning claim in ADR-0118. Immutable; service role writes, company admins read their own company.';

COMMENT ON COLUMN public.billing_activity_log.actor_user_id IS
  'user_identity FK. NULL for cron/system writers (monthly invoice generator). Platform admins write as themselves. NEVER a profile_id.';

COMMENT ON COLUMN public.billing_activity_log.event IS
  'Event name (space-separated convention from telemetry registry): "invoice issued", "invoice marked_paid", "dunning_note added", etc.';

COMMENT ON COLUMN public.billing_activity_log.source IS
  'Origin of the write: web (Server Action), mobile (future), api, cron (generator), system (triggers).';
