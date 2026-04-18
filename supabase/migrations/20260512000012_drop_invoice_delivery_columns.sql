-- ============================================================
-- 20260512000012_drop_invoice_delivery_columns.sql
--
-- Fase 3A B6 — DROP invoice.delivery_channel / delivery_status / external_reference
--
-- Per ADR-0128 (deprecation lifecycle) + ADR-0135 (grep-gate + hard
-- deadline 2026-07-01). Fase 2 introduced invoice_dispatch as the
-- source-of-truth for per-channel delivery state; the invoice-level
-- dual-write columns are now dead code.
--
-- Pre-flight verified via supabase/tests/billing-delivery-drop-readiness.sh:
-- all application callers migrated to invoice_dispatch reads.
--
-- Post-DROP the application regenerates database.types.ts + typecheck
-- must stay green. If a straggler reader exists it will fail at typecheck
-- (that's the point of the gate).
-- ============================================================

BEGIN;

-- Drop the CHECK constraint first (it references the column).
ALTER TABLE public.invoice
  DROP CONSTRAINT IF EXISTS invoice_delivery_channel_check;

-- Drop the three columns.
ALTER TABLE public.invoice
  DROP COLUMN IF EXISTS delivery_channel,
  DROP COLUMN IF EXISTS delivery_status,
  DROP COLUMN IF EXISTS external_reference;

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- Cross-references:
--   ADR-0128 — deprecation lifecycle (dual-write → drop)
--   ADR-0135 — grep-gate + hard deadline (2026-07-01)
--   Fase 2 invoice_dispatch table — replacement SoT
-- ═══════════════════════════════════════════════════════════════
