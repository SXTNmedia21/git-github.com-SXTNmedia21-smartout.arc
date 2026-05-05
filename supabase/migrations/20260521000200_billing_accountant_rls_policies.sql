-- ============================================================================
-- 20260521000200_billing_accountant_rls_policies.sql
--
-- Additive RLS policies on public.* tables for accountant read access.
-- Existing policies are UNTOUCHED — these are purely additive.
-- All policies call billing.is_accountant_for_company() cross-schema.
--
-- Tables covered (11 SELECT + 1 UPDATE):
--   public.invoice, invoice_line_item, invoice_dispatch,
--   public.payment, payment_attempt,
--   public.pricing_terms (full_kartotek scope only),
--   public.billing_activity_log,
--   public.company, company_member (full_kartotek scope only),
--   public.workspace,
--   public.employment_contract (full_kartotek scope only)
--
-- Plus: invoice UPDATE for mark-received (status transition gate).
--
-- ADR-A (2026-05-02): RLS additive path; ADR-0118 unchanged.
-- ============================================================================

-- ─── invoice — read ──────────────────────────────────────────────────────────

CREATE POLICY invoice_accountant_select
  ON public.invoice
  FOR SELECT
  USING (billing.is_accountant_for_company(company_id));

-- ─── invoice_line_item — joined via invoice ───────────────────────────────────

CREATE POLICY invoice_line_item_accountant_select
  ON public.invoice_line_item
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoice i
      WHERE i.invoice_id = invoice_line_item.invoice_id
        AND billing.is_accountant_for_company(i.company_id)
    )
  );

-- ─── invoice_dispatch — joined via invoice ────────────────────────────────────

CREATE POLICY invoice_dispatch_accountant_select
  ON public.invoice_dispatch
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoice i
      WHERE i.invoice_id = invoice_dispatch.invoice_id
        AND billing.is_accountant_for_company(i.company_id)
    )
  );

-- ─── payment — direct company_id ─────────────────────────────────────────────

CREATE POLICY payment_accountant_select
  ON public.payment
  FOR SELECT
  USING (billing.is_accountant_for_company(company_id));

-- ─── payment_attempt — joined via payment ────────────────────────────────────

CREATE POLICY payment_attempt_accountant_select
  ON public.payment_attempt
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.payment p
      WHERE p.payment_id = payment_attempt.payment_id
        AND billing.is_accountant_for_company(p.company_id)
    )
  );

-- ─── pricing_terms — full_kartotek scope only ─────────────────────────────────

CREATE POLICY pricing_terms_accountant_select
  ON public.pricing_terms
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM billing.accountant_company_grant g
      WHERE g.user_id   = auth.uid()
        AND g.company_id = pricing_terms.company_id
        AND g.revoked_at IS NULL
        AND g.scope      = 'full_kartotek'
    )
  );

-- ─── billing_activity_log — orders_only is sufficient ────────────────────────

CREATE POLICY billing_activity_log_accountant_select
  ON public.billing_activity_log
  FOR SELECT
  USING (billing.is_accountant_for_company(company_id));

-- ─── company — accountant can read name + org_number for granted companies ────

CREATE POLICY company_accountant_select
  ON public.company
  FOR SELECT
  USING (billing.is_accountant_for_company(company_id));

-- ─── company_member — full_kartotek scope only ───────────────────────────────

CREATE POLICY company_member_accountant_select
  ON public.company_member
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM billing.accountant_company_grant g
      WHERE g.user_id   = auth.uid()
        AND g.company_id = company_member.company_id
        AND g.revoked_at IS NULL
        AND g.scope      = 'full_kartotek'
    )
  );

-- ─── workspace — accountant reads workspaces inside granted companies ─────────

CREATE POLICY workspace_accountant_select
  ON public.workspace
  FOR SELECT
  USING (billing.is_accountant_for_company(company_id));

-- ─── employment_contract — full_kartotek scope only (workspace-scoped table) ──

CREATE POLICY employment_contract_accountant_select
  ON public.employment_contract
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.workspace w
      JOIN billing.accountant_company_grant g ON g.company_id = w.company_id
      WHERE w.workspace_id = employment_contract.workspace_id
        AND g.user_id      = auth.uid()
        AND g.revoked_at   IS NULL
        AND g.scope        = 'full_kartotek'
    )
  );

-- ─── invoice UPDATE — narrow mark-received transition ────────────────────────
--
-- Accountant may advance status from issued/sent/overdue → paid only.
-- Server Action runs with service_role for atomic payment row insert;
-- this policy is defense-in-depth (CLAUDE.md: never bypass RLS for convenience).

CREATE POLICY invoice_accountant_mark_received
  ON public.invoice
  FOR UPDATE
  USING (
    billing.is_accountant_for_company(company_id)
    AND status IN ('issued', 'sent', 'overdue')
  )
  WITH CHECK (
    billing.is_accountant_for_company(company_id)
    AND status = 'paid'
  );
