SET search_path TO public, extensions;

-- ============================================
-- 20260417123548_billing_views.sql
-- Billing Engine Fase 1 — Task 1.8
-- Two views + one function for the billing engine:
--   - v_current_plan_preview  — company/workspace/pricing snapshot + current-month usage
--   - v_invoice_dunning_notes — dunning notes from billing_activity_log (ADR-0122)
--   - get_invoice_basis()     — full invoice basis for AI-tool + audit read
-- ============================================

-- ── v_current_plan_preview ───────────────────────────────────
-- Joins company + workspace + pricing_terms (currently-effective) +
-- computes active_users for the current month from schedule_shift.
-- Used by the platform-admin "current plan" UI and AI-tool reads.
CREATE VIEW public.v_current_plan_preview AS
SELECT
  c.company_id,
  c.name AS company_name,
  w.workspace_id,
  w.name AS workspace_name,
  pt.pricing_terms_id,
  pt.monthly_cost,
  pt.price_per_employee,
  pt.free_users,
  pt.overage_price_per_user,
  pt.billing_interval,
  pt.delivery_channel,
  pt.invoice_format,
  (SELECT count(DISTINCT employee_id)
   FROM public.schedule_shift
   WHERE workspace_id = w.workspace_id
     AND status = 'completed'
     AND employee_id IS NOT NULL
     AND shift_date >= date_trunc('month', now())::date
     AND shift_date < (date_trunc('month', now()) + interval '1 month')::date
  ) AS active_users_current_month
FROM public.company c
JOIN public.workspace w ON w.company_id = c.company_id
LEFT JOIN public.pricing_terms pt
  ON pt.company_id = c.company_id
 AND (pt.effective_until IS NULL OR pt.effective_until >= CURRENT_DATE)
 AND pt.effective_from <= CURRENT_DATE;

COMMENT ON VIEW public.v_current_plan_preview IS
  'Company + workspace + currently-effective pricing_terms + current-month active-user count. Active users counted per ADR-0119 predicate (completed shifts with employee_id).';

-- ── v_invoice_dunning_notes (ADR-0122) ───────────────────────
-- Dunning notes live in billing_activity_log (ADR-0122 supersedes the
-- original activity_trail routing from ADR-0118). View is RLS-transparent:
-- company admin sees only their own company's rows via is_admin_in_company
-- policy on billing_activity_log (Task 1.7.5).
CREATE VIEW public.v_invoice_dunning_notes AS
SELECT
  bal.id                              AS billing_log_id,
  bal.invoice_id,
  bal.company_id,
  bal.data->>'note'                   AS note,
  bal.data->>'contact_channel'        AS contact_channel,
  bal.actor_user_id,
  bal.source,
  bal.created_at
FROM public.billing_activity_log bal
WHERE bal.event = 'dunning_note added'
  AND bal.entity_type = 'invoice';

COMMENT ON VIEW public.v_invoice_dunning_notes IS
  'Dunning notes sourced from billing_activity_log (ADR-0122). RLS-transparent via billing_activity_log.billing_log_company_admin_read.';

-- ── get_invoice_basis(p_invoice_id) ──────────────────────────
-- Returns the complete basis for an invoice: line items, usage snapshots,
-- and the pricing_terms row that was effective at issue time. Used by the
-- AI "explain this invoice" tool and by the audit detail UI. LLM reads
-- verbatim — never computes amounts from derived numbers.
CREATE OR REPLACE FUNCTION public.get_invoice_basis(p_invoice_id uuid)
RETURNS TABLE (
  invoice_id              uuid,
  invoice_number          int,
  company_id              uuid,
  company_name            text,
  period_from             date,
  period_to               date,
  issued_at               timestamptz,
  status                  text,
  amount_excl_vat         decimal,
  vat_rate                decimal,
  vat_amount              decimal,
  amount_incl_vat         decimal,
  currency                text,
  line_items              jsonb,
  usage_snapshots         jsonb,
  pricing_terms_at_issue  jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    i.invoice_id,
    i.invoice_number,
    i.company_id,
    c.name,
    i.period_from,
    i.period_to,
    i.issued_at,
    i.status::text,
    i.amount_excl_vat,
    i.vat_rate,
    i.vat_amount,
    i.amount_incl_vat,
    i.currency::text,
    (SELECT jsonb_agg(jsonb_build_object(
      'line_type',       li.line_type,
      'description',     li.description,
      'quantity',        li.quantity,
      'unit_price',      li.unit_price,
      'amount_incl_vat', li.amount_incl_vat,
      'addon_key',       li.addon_key
    ))
     FROM public.invoice_line_item li
     WHERE li.invoice_id = i.invoice_id) AS line_items,
    (SELECT jsonb_agg(to_jsonb(us.*))
     FROM public.usage_snapshot us
     WHERE us.company_id = i.company_id
       AND us.period_from = i.period_from
       AND us.period_to   = i.period_to) AS usage_snapshots,
    (SELECT to_jsonb(pt.*)
     FROM public.pricing_terms pt
     WHERE pt.company_id = i.company_id
       AND pt.effective_from <= COALESCE(i.issued_at::date, CURRENT_DATE)
       AND (pt.effective_until IS NULL
            OR pt.effective_until >= COALESCE(i.issued_at::date, CURRENT_DATE))
     ORDER BY pt.effective_from DESC
     LIMIT 1) AS pricing_terms_at_issue
  FROM public.invoice i
  JOIN public.company c ON c.company_id = i.company_id
  WHERE i.invoice_id = p_invoice_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_invoice_basis(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_invoice_basis IS
  'Returns complete invoice basis (line items + usage snapshots + pricing_terms at issue) for AI-tool + audit reads. STABLE SECURITY DEFINER with explicit search_path. Read-only — never computes amounts.';
