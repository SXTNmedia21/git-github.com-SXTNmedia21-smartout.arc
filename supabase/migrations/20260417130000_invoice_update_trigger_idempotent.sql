SET search_path TO public, extensions;

-- ============================================
-- 20260417130000_invoice_update_trigger_idempotent.sql
-- Billing Engine Fase 1.5 — Code-reviewer important #3
--
-- Problem:
--   trg_invoice_assign_number_update fires on BEFORE UPDATE OF status
--   when WHEN (NEW.status = 'issued' AND OLD.status IS DISTINCT FROM NEW.status).
--   Missing: AND NEW.invoice_number IS NULL.
--
--   Concurrent draft -> issued transitions could both pass the WHEN clause
--   (both seeing OLD.status = 'draft'), both call assign_invoice_number(),
--   and both consume a nextval() — wasting a sequence number. Because the
--   function itself guards with `IF NEW.invoice_number IS NULL` inside the
--   body, the second transaction doesn't double-assign (it overwrites NULL
--   with a fresh nextval, then the first transaction's write is lost under
--   MVCC), but in the race window we still call nextval twice, advancing
--   the sequence by 2 for a single invoice.
--
--   The INSERT trigger (trg_invoice_assign_number_insert) already has the
--   IS NULL guard on its WHEN clause. Mirroring that here eliminates the
--   wasted-sequence race.
--
-- Fix:
--   DROP + CREATE the UPDATE trigger with the extra predicate. Function
--   body unchanged.
-- ============================================

DROP TRIGGER IF EXISTS trg_invoice_assign_number_update ON public.invoice;

CREATE TRIGGER trg_invoice_assign_number_update
  BEFORE UPDATE OF status ON public.invoice
  FOR EACH ROW
  WHEN (
    NEW.status = 'issued'
    AND OLD.status IS DISTINCT FROM NEW.status
    AND NEW.invoice_number IS NULL
  )
  EXECUTE FUNCTION public.assign_invoice_number();

COMMENT ON TRIGGER trg_invoice_assign_number_update ON public.invoice IS
  'Assigns invoice_number on draft -> issued transition. WHEN clause mirrors the INSERT trigger: NEW.invoice_number IS NULL gates against wasted-sequence races under concurrent transitions (Phase 1.5 fix, code-reviewer important #3).';
