-- ============================================
-- 20260414100000_contract_template_binding.sql
-- Contract template resolution by employment category and employee group (K1b).
-- Enables workspace admins to bind contract templates to specific employment
-- categories and optionally to specific employee groups, with priority ordering.
-- ============================================

-- ── Table ──

CREATE TABLE IF NOT EXISTS public.contract_template_binding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES public.contract_template(template_id) ON DELETE CASCADE,
  employment_category TEXT NOT NULL CHECK (employment_category IN ('fast', 'deltid', 'tilkalling')),
  employee_group_id UUID REFERENCES payroll.employee_group(id) ON DELETE SET NULL,
  priority INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_binding_resolution UNIQUE (workspace_id, employment_category, employee_group_id)
);

COMMENT ON TABLE public.contract_template_binding IS
  'Maps contract templates to employment categories with optional employee group specificity. '
  'Supports priority-based resolution when multiple bindings match. Part of K1b (workspace knowledge base).';

COMMENT ON COLUMN public.contract_template_binding.employment_category IS
  'Employment classification: fast (permanent full-time), deltid (part-time), tilkalling (on-call).';

COMMENT ON COLUMN public.contract_template_binding.employee_group_id IS
  'Optional: when set, this binding applies only to employees in this group. NULL = applies to all in category.';

COMMENT ON COLUMN public.contract_template_binding.priority IS
  'Higher values take precedence. Enables fallback chains: group-specific → category-wide.';

CREATE TRIGGER set_contract_template_binding_updated_at
  BEFORE UPDATE ON public.contract_template_binding
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Indexes ──

CREATE INDEX idx_binding_lookup
  ON public.contract_template_binding(workspace_id, employment_category, is_active)
  WHERE is_active = true;

CREATE INDEX idx_binding_group
  ON public.contract_template_binding(employee_group_id)
  WHERE employee_group_id IS NOT NULL;

-- ── RLS ──

ALTER TABLE public.contract_template_binding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_admin_read_bindings" ON public.contract_template_binding;
CREATE POLICY "workspace_admin_read_bindings" ON public.contract_template_binding
  FOR SELECT USING (
    is_admin_in_workspace(auth.uid(), workspace_id)
  );

DROP POLICY IF EXISTS "workspace_admin_manage_bindings" ON public.contract_template_binding;
CREATE POLICY "workspace_admin_manage_bindings" ON public.contract_template_binding
  FOR ALL USING (
    is_admin_in_workspace(auth.uid(), workspace_id)
  ) WITH CHECK (
    is_admin_in_workspace(auth.uid(), workspace_id)
  );
