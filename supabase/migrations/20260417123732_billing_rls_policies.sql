SET search_path TO public, extensions;

-- ============================================
-- 20260417123732_billing_rls_policies.sql
-- Billing Engine Fase 1 — Task 1.9
--
-- Enables RLS on the four billing tables created in Tasks 1.4–1.7:
--   - invoice                (Task 1.4)
--   - invoice_line_item      (Task 1.5)
--   - usage_snapshot         (Task 1.6)
--   - basis_drift_event      (Task 1.7)
--
-- NOTE: billing_activity_log (Task 1.7.5) already has RLS enabled in its
-- own migration — not re-enabled here.
--
-- RLS posture:
--   - Platform admin writes via service role, which BYPASSES RLS entirely.
--   - Company admin/owner reads own company's rows via is_admin_in_company.
--   - No authenticated write policies — all mutations via Server Actions
--     using createAdminClient() (service role).
--
-- Per ADR-0118 (C3 Commercial consumer) and ADR-0122 (actor model).
-- ============================================

-- ── invoice ──────────────────────────────────────────────────
ALTER TABLE public.invoice ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_company_admin_read ON public.invoice
  FOR SELECT TO authenticated
  USING (public.is_admin_in_company(auth.uid(), company_id));

COMMENT ON POLICY invoice_company_admin_read ON public.invoice IS
  'Company admins/owners can read their own company''s invoices. Platform-admin access via service role (bypasses RLS).';

-- ── invoice_line_item ────────────────────────────────────────
-- Joined check against parent invoice. Cannot reference company_id
-- directly since line_item doesn't carry it — must traverse invoice.
ALTER TABLE public.invoice_line_item ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_line_item_company_admin_read ON public.invoice_line_item
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoice i
    WHERE i.invoice_id = invoice_line_item.invoice_id
      AND public.is_admin_in_company(auth.uid(), i.company_id)
  ));

COMMENT ON POLICY invoice_line_item_company_admin_read ON public.invoice_line_item IS
  'Inherits scoping via parent invoice. Company admin reads own line items.';

-- ── usage_snapshot ───────────────────────────────────────────
ALTER TABLE public.usage_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_snapshot_company_admin_read ON public.usage_snapshot
  FOR SELECT TO authenticated
  USING (public.is_admin_in_company(auth.uid(), company_id));

COMMENT ON POLICY usage_snapshot_company_admin_read ON public.usage_snapshot IS
  'Company admins/owners read own usage snapshots (billing basis). Platform-admin via service role.';

-- ── basis_drift_event ────────────────────────────────────────
-- Platform-admin only — no authenticated read policy.
-- Service role bypasses RLS, so the detect_billing_basis_drift trigger
-- (SECURITY DEFINER) can still INSERT. Enabling RLS without any policy
-- means authenticated users see zero rows, which is the intent.
ALTER TABLE public.basis_drift_event ENABLE ROW LEVEL SECURITY;

-- Intentionally NO policies: platform-admin only (service role bypass).
