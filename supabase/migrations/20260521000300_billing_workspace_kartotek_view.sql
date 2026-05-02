-- ============================================================================
-- 20260521000300_billing_workspace_kartotek_view.sql
--
-- Read model view for the workspace kartotek page in apps/admin.
-- Lives in the billing schema (not public) — accountant tooling.
--
-- The view itself has no RLS; security is enforced by the underlying
-- public.* tables which each carry accountant SELECT policies (migration
-- 20260521000200). An accountant without a grant for a given company_id
-- will receive 0 rows because public.workspace + public.company policies
-- deny the row before the view aggregation runs.
--
-- Blueprint §6 DDL — adapted: CREATE VIEW billing.v_workspace_kartotek_summary
-- (blueprint had public.v_workspace_kartotek_summary; moved to billing per
-- ADR-A 2026-05-02 billing-schema decision).
-- ============================================================================

CREATE OR REPLACE VIEW billing.v_workspace_kartotek_summary AS
SELECT
  w.workspace_id,
  w.company_id,
  w.name              AS workspace_name,
  w.slug              AS workspace_slug,
  c.name              AS company_name,
  c.org_number        AS company_org_number,
  c.subscription_plan,
  c.subscription_status,
  c.created_at        AS company_created_at,
  -- scalar aggregates via correlated subqueries to keep the main SELECT simple
  (SELECT count(*)
     FROM public.invoice i
    WHERE i.company_id = c.company_id
  )::bigint                                                     AS invoice_count_total,
  (SELECT count(*)
     FROM public.invoice i
    WHERE i.company_id = c.company_id
      AND i.status IN ('issued', 'sent', 'overdue')
  )::bigint                                                     AS invoice_count_outstanding,
  (SELECT coalesce(sum(amount_incl_vat), 0)::numeric
     FROM public.invoice i
    WHERE i.company_id = c.company_id
      AND i.status IN ('issued', 'sent', 'overdue')
  )                                                             AS amount_outstanding_incl_vat,
  (SELECT max(issued_at)
     FROM public.invoice i
    WHERE i.company_id = c.company_id
  )                                                             AS last_invoice_at,
  (SELECT max(paid_at)
     FROM public.invoice i
    WHERE i.company_id = c.company_id
      AND i.status = 'paid'
  )                                                             AS last_paid_at,
  (SELECT count(*)
     FROM public.company_member cm
    WHERE cm.company_id = c.company_id
  )::bigint                                                     AS member_count
FROM public.workspace w
JOIN public.company c ON c.company_id = w.company_id;

-- Allow authenticated clients (accountant + admin) to query the view.
GRANT SELECT ON billing.v_workspace_kartotek_summary TO authenticated;
GRANT SELECT ON billing.v_workspace_kartotek_summary TO service_role;
