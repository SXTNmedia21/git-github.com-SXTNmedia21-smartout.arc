SET search_path TO public, extensions;

-- ============================================
-- 20260511200002_billing_dispatch_template_table.sql
-- Billing Engine Fase 2 — B1 Migration C
--
-- Dispatch templates (subject + body) referenced by billing_dispatch_rule.
-- Fase 2: platform-owned only (workspace_id NULL); workspace cannot create
-- own templates (out-of-scope per spec §3.2).
--
-- FK from billing_dispatch_rule.template_id added at the end of this
-- migration.
--
-- Ref: Fase 2 spec §3.2.
-- ============================================

CREATE TABLE public.billing_dispatch_template (
  template_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = platform-owned (Fase 2 only mode). Workspace-owned templates are
  -- Fase 3.
  workspace_id        uuid REFERENCES public.workspace(workspace_id),

  name                text NOT NULL,
  channel             billing_dispatch_channel NOT NULL,
  -- Mustache-style placeholders resolved at dispatch time (e.g. "{{invoice.number}}").
  subject_template    text,
  body_template       text NOT NULL,
  locale              text NOT NULL DEFAULT 'nb-NO',

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Updated-at trigger ───────────────────────────────────────
CREATE TRIGGER set_billing_dispatch_template_updated_at
  BEFORE UPDATE ON public.billing_dispatch_template
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Wire up billing_dispatch_rule.template_id FK ─────────────
ALTER TABLE public.billing_dispatch_rule
  ADD CONSTRAINT billing_dispatch_rule_template_fk
  FOREIGN KEY (template_id)
  REFERENCES public.billing_dispatch_template(template_id);

-- ── Comments ─────────────────────────────────────────────────
COMMENT ON TABLE public.billing_dispatch_template IS
  'Dispatch templates (subject + body). Fase 2: platform-owned only; workspace templates Fase 3.';

COMMENT ON COLUMN public.billing_dispatch_template.subject_template IS
  'Mustache-style placeholders, resolved at dispatch time. NULL for channels without a subject (e.g. http_api).';

COMMENT ON COLUMN public.billing_dispatch_template.locale IS
  'BCP-47 tag (e.g. nb-NO, en-US). Default nb-NO per spec §9 (workspace-admin UI is Norwegian from day one).';
