SET search_path TO public, extensions;

-- ============================================
-- 20260417130200_invoice_pricing_terms_id_snapshot.sql
-- Billing Engine Fase 1.5 — Code-reviewer important #5
--
-- Problem:
--   get_invoice_basis() locates the pricing_terms row via date-range
--   lookup on (company_id, issued_at). For issued invoices this is
--   stable if pricing_terms history is never rewritten, but:
--
--   1. Draft invoices have NULL issued_at and resolve to today's
--      effective terms. If pricing changes between draft creation and
--      issue, the draft reflects the new terms, not the terms at draft time.
--   2. Retroactive pricing_terms history corrections (effective_from
--      shifts) can silently retro-edit historical invoice bases.
--   3. Phase 4 cron generator has no way to record "which exact
--      pricing_terms row was used" — audit trail is inference-based.
--
-- Fix:
--   Add invoice.pricing_terms_id uuid REFERENCES pricing_terms(pricing_terms_id).
--   Nullable (existing Fase 1 rows have no snapshot; Phase 4 generator
--   populates going forward; backfill is out of scope for Fase 1).
--   get_invoice_basis() prefers the stored FK when set; falls back to
--   date-range lookup for legacy rows.
--
--   FK is ON DELETE RESTRICT by default — pricing_terms rows referenced
--   by invoices cannot be deleted, protecting audit integrity.
--
-- Follow-up (Phase 4):
--   The invoice generator MUST populate pricing_terms_id at INSERT time
--   from the same pricing_terms row used to compute the amounts.
--   Documented in MODULE_BILLING.md.
-- ============================================

ALTER TABLE public.invoice
  ADD COLUMN pricing_terms_id uuid REFERENCES public.pricing_terms(pricing_terms_id);

COMMENT ON COLUMN public.invoice.pricing_terms_id IS
  'Snapshot FK to the pricing_terms row that governed this invoice at generation. Nullable for legacy/Fase 1 rows; Phase 4 generator MUST populate. Prevents silent drift if pricing_terms history is retroactively edited. Read-first by get_invoice_basis (Phase 1.5, code-reviewer important #5).';

-- ── Update get_invoice_basis to prefer stored FK ─────────────
-- Logic: if invoice.pricing_terms_id is set, look up by FK (authoritative).
-- Otherwise fall back to date-range lookup on (company_id, issued_at) for
-- legacy rows. Once Phase 4 ships, the fallback becomes unused for new
-- invoices but remains for historical reads.

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
    COALESCE(
      -- Phase 1.5+: prefer the stored snapshot FK (authoritative, immune
      -- to retroactive pricing_terms edits).
      (SELECT to_jsonb(pt.*)
         FROM public.pricing_terms pt
         WHERE pt.pricing_terms_id = i.pricing_terms_id),
      -- Fase 1 fallback: date-range lookup for legacy rows with NULL snapshot.
      (SELECT to_jsonb(pt.*)
         FROM public.pricing_terms pt
         WHERE pt.company_id = i.company_id
           AND pt.effective_from <= COALESCE(i.issued_at::date, CURRENT_DATE)
           AND (pt.effective_until IS NULL
                OR pt.effective_until >= COALESCE(i.issued_at::date, CURRENT_DATE))
         ORDER BY pt.effective_from DESC
         LIMIT 1)
    ) AS pricing_terms_at_issue
  FROM public.invoice i
  JOIN public.company c ON c.company_id = i.company_id
  WHERE i.invoice_id = p_invoice_id;
$$;

COMMENT ON FUNCTION public.get_invoice_basis IS
  'Returns complete invoice basis (line items + usage snapshots + pricing_terms at issue) for AI-tool + audit reads. STABLE SECURITY DEFINER with explicit search_path. Reads invoice.pricing_terms_id FK first (Phase 1.5 snapshot, authoritative); falls back to date-range lookup for legacy rows. Read-only — never computes amounts.';
