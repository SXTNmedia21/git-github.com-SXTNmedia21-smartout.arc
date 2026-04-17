SET search_path TO public, extensions;

-- ============================================
-- 20260417121241_is_admin_in_company_helper.sql
-- Billing Engine Fase 1 — Task 1.1
-- RLS helper for company-scoped billing tables (invoice, invoice_line_item,
-- usage_snapshot, billing_activity_log). Mirrors is_admin_in_workspace()
-- pattern but scoped to company instead of workspace.
-- Referenced by ADR-0118 (C3 Commercial consumer) and ADR-0122.
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin_in_company(p_user_id uuid, p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_member
    WHERE user_id = p_user_id
      AND company_id = p_company_id
      AND role IN ('admin', 'owner')
      AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_in_company(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.is_admin_in_company IS
  'Returns true if user is an active admin/owner in the given company. Used by billing engine RLS (ADR-0118, ADR-0122).';
