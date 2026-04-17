SET search_path TO public, extensions;

-- ============================================
-- 20260511200001_billing_dispatch_rule_table.sql
-- Billing Engine Fase 2 — B1 Migration B
--
-- 2-level dispatch rules: platform baseline (workspace_id NULL) +
-- workspace overrides/suppressions. Evaluation algorithm lives in
-- Migration H (effective_dispatch_rules).
--
-- template_id FK is added in Migration C (after billing_dispatch_template
-- table exists).
--
-- Ref: Fase 2 spec §3.2, ADR-0127.
-- ============================================

CREATE TABLE public.billing_dispatch_rule (
  dispatch_rule_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Scope: NULL = platform baseline. NOT NULL = workspace override/addition.
  workspace_id        uuid REFERENCES public.workspace(workspace_id),
  -- Optional tighter scoping: rule only applies to a specific company.
  company_id          uuid REFERENCES public.company(company_id),

  channel             billing_dispatch_channel NOT NULL,
  -- trigger_event uses telemetry space-separated convention: "invoice issued",
  -- "invoice voided", etc. CHECK enforces no '.' to prevent dot-separated drift.
  trigger_event       text NOT NULL
    CHECK (position('.' in trigger_event) = 0),
  -- Channel-specific payload: {email: "..."}, {integration_id: "..."},
  -- {peppol_participant_id: "..."}, etc.
  target              jsonb NOT NULL,
  -- Nullable FK; Fase 2 templates are platform-owned.
  -- FK constraint added in Migration C.
  template_id         uuid,

  action              dispatch_rule_action NOT NULL DEFAULT 'send',
  is_enabled          boolean NOT NULL DEFAULT true,

  created_by          uuid REFERENCES public.user_identity(user_id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  -- ADR-0127: platform rules (workspace_id NULL) are immutable "send" + never
  -- company-scoped. Suppression is workspace-level only. Company-scoping is
  -- a workspace concern (e.g., workspace admin carves one company out).
  CONSTRAINT billing_dispatch_rule_platform_constraints CHECK (
    workspace_id IS NOT NULL
    OR (action = 'send' AND company_id IS NULL)
  )
);

-- ── Updated-at trigger ───────────────────────────────────────
CREATE TRIGGER set_billing_dispatch_rule_updated_at
  BEFORE UPDATE ON public.billing_dispatch_rule
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ──────────────────────────────────────────────────
-- Hot path: evaluate rules for an invoice event. workspace_id + trigger_event,
-- enabled rules only.
CREATE INDEX idx_billing_dispatch_rule_workspace_event
  ON public.billing_dispatch_rule(workspace_id, trigger_event)
  WHERE is_enabled = true;

-- Company-scoped lookup for workspace rules that carve out specific companies.
CREATE INDEX idx_billing_dispatch_rule_company
  ON public.billing_dispatch_rule(company_id)
  WHERE company_id IS NOT NULL;

-- ── Comments ─────────────────────────────────────────────────
COMMENT ON TABLE public.billing_dispatch_rule IS
  '2-level dispatch rules per ADR-0127. workspace_id NULL = platform baseline; workspace overrides via matching dedup-key rule (see effective_dispatch_rules function).';

COMMENT ON COLUMN public.billing_dispatch_rule.trigger_event IS
  'Telemetry event name, space-separated (e.g. "invoice issued"). CHECK constraint rejects dot-separator drift per pgTAP audit.';

COMMENT ON COLUMN public.billing_dispatch_rule.target IS
  'Channel-specific dispatch target. jsonb for forward-compat. Normalised for dedup via canonical_json() in effective_dispatch_rules.';

COMMENT ON COLUMN public.billing_dispatch_rule.action IS
  'send = emit dispatch; suppress = workspace disables matching platform rule. Platform rules (workspace_id NULL) MUST be send (see CHECK constraint).';
