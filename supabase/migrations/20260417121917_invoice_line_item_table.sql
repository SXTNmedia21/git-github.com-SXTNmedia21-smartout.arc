SET search_path TO public, extensions;

-- ============================================
-- 20260417121917_invoice_line_item_table.sql
-- Billing Engine Fase 1 — Task 1.5
-- Line items per invoice. Per spec §5.3.
-- ON DELETE RESTRICT on invoice FK enforces immutability (ADR-0120).
-- usage_snapshot_id FK added in Task 1.6 after that table is created.
-- ============================================

CREATE TABLE public.invoice_line_item (
  line_item_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id              uuid NOT NULL REFERENCES public.invoice(invoice_id) ON DELETE RESTRICT,

  line_type               invoice_line_type NOT NULL,
  addon_key               text,  -- NULL for non-addon types
  description             text NOT NULL,

  quantity                decimal(12,2) NOT NULL DEFAULT 1,
  unit_price              decimal(12,2) NOT NULL,
  amount_excl_vat         decimal(12,2) NOT NULL,
  vat_rate                decimal(5,2) NOT NULL DEFAULT 25.00,
  vat_amount              decimal(12,2) NOT NULL,
  amount_incl_vat         decimal(12,2) NOT NULL,

  usage_snapshot_id       uuid,  -- FK constraint added in Task 1.6
  period_reference        text,

  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_line_item_invoice ON public.invoice_line_item(invoice_id);
CREATE INDEX idx_line_item_type ON public.invoice_line_item(line_type);

COMMENT ON TABLE public.invoice_line_item IS
  'Line items per invoice. ON DELETE RESTRICT enforces immutability (ADR-0120).';

COMMENT ON COLUMN public.invoice_line_item.usage_snapshot_id IS
  'Links user_overage lines back to the usage_snapshot that produced them. FK added in Task 1.6 migration after usage_snapshot table exists.';

COMMENT ON COLUMN public.invoice_line_item.addon_key IS
  'Identifier for addon line items (line_type = addon). NULL for other types.';
