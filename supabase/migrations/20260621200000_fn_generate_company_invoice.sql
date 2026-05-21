SET search_path TO public, extensions;

-- ============================================
-- 20260621200000_fn_generate_company_invoice.sql
-- feat/billing-cron-correctness — C1 Atomic Invoice RPC
--
-- Wraps the three non-transactional writes in generator.ts
-- (INSERT invoice draft → INSERT line_items → UPDATE status='issued')
-- in a single plpgsql function body so they are one transaction.
--
-- Why: a crash between INSERT(draft) and UPDATE(issued) left a
-- header-only draft invoice. The partial-index
-- idx_invoice_one_recurring_per_period (WHERE status<>'void') then
-- treated that stuck draft as "already billed" → silent under-billing.
-- Per ADR-0120 the invoice_number is assigned by trigger on draft→issued,
-- so the UPDATE inside this function still fires assign_invoice_number.
--
-- Return: (invoice_id uuid, invoice_number int) — the issued invoice.
-- ============================================

CREATE OR REPLACE FUNCTION public.fn_generate_company_invoice(
  p_company_id        uuid,
  p_period_from       date,
  p_period_to         date,
  p_pricing_terms_id  uuid,
  p_amount_excl_vat   numeric,
  p_vat_rate          numeric,
  p_vat_amount        numeric,
  p_amount_incl_vat   numeric,
  p_currency          text,
  p_due_at            date,
  p_line_items        jsonb  -- array of line_item objects (see body for expected keys)
)
RETURNS TABLE (invoice_id uuid, invoice_number int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice_id    uuid;
  v_invoice_number int;
  v_item          jsonb;
BEGIN
  -- ── 1. Insert invoice header as draft ──────────────────────────────
  -- status='draft' keeps invoice_number NULL (ADR-0120); the trigger
  -- assign_invoice_number fires on the UPDATE below.
  INSERT INTO public.invoice (
    company_id,
    invoice_type,
    status,
    period_from,
    period_to,
    amount_excl_vat,
    vat_rate,
    vat_amount,
    amount_incl_vat,
    currency,
    due_at,
    pricing_terms_id
  ) VALUES (
    p_company_id,
    'recurring',
    'draft',
    p_period_from,
    p_period_to,
    p_amount_excl_vat,
    p_vat_rate,
    p_vat_amount,
    p_amount_incl_vat,
    p_currency::currency,
    p_due_at,
    p_pricing_terms_id
  )
  RETURNING public.invoice.invoice_id INTO v_invoice_id;

  -- ── 2. Insert line items ────────────────────────────────────────────
  -- p_line_items is a JSON array. Each element must have:
  --   line_type, description, quantity, unit_price,
  --   amount_excl_vat, vat_rate, vat_amount, amount_incl_vat,
  --   usage_snapshot_id (nullable)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_line_items)
  LOOP
    INSERT INTO public.invoice_line_item (
      invoice_id,
      line_type,
      description,
      quantity,
      unit_price,
      amount_excl_vat,
      vat_rate,
      vat_amount,
      amount_incl_vat,
      usage_snapshot_id
    ) VALUES (
      v_invoice_id,
      (v_item->>'line_type')::invoice_line_type,
      v_item->>'description',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      (v_item->>'amount_excl_vat')::numeric,
      (v_item->>'vat_rate')::numeric,
      (v_item->>'vat_amount')::numeric,
      (v_item->>'amount_incl_vat')::numeric,
      NULLIF(v_item->>'usage_snapshot_id', '')::uuid
    );
  END LOOP;

  -- ── 3. Transition draft → issued ───────────────────────────────────
  -- Fires trg_invoice_assign_number_update which calls assign_invoice_number()
  -- and sets invoice_number + issued_at (ADR-0120). All three writes are
  -- in the same function-body transaction — no partial-write window.
  UPDATE public.invoice
  SET status = 'issued'
  WHERE public.invoice.invoice_id = v_invoice_id;

  -- ── 4. Read back the assigned invoice_number ───────────────────────
  SELECT public.invoice.invoice_number
  INTO v_invoice_number
  FROM public.invoice
  WHERE public.invoice.invoice_id = v_invoice_id;

  RETURN QUERY SELECT v_invoice_id, v_invoice_number;
END;
$$;

COMMENT ON FUNCTION public.fn_generate_company_invoice(
  uuid, date, date, uuid, numeric, numeric, numeric, numeric, text, date, jsonb
) IS
  'Atomic invoice generation — INSERT draft + INSERT line_items + UPDATE issued in one transaction. '
  'Eliminates the partial-write window that left header-only draft invoices and caused silent under-billing '
  'via idx_invoice_one_recurring_per_period (feat/billing-cron-correctness C1, 2026-05-20). '
  'Returns (invoice_id, invoice_number) after the draft→issued trigger fires assign_invoice_number.';
