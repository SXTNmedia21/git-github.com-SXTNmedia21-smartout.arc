SET search_path TO public, extensions;

-- ============================================
-- 20260417123340_invoice_trigger_functions_hardened.sql
-- Billing Engine Fase 1 — Mid-B1 council fix (Supervisor blocker)
--
-- Harden two trigger functions on public.invoice:
--   - assign_invoice_number
--   - prevent_nested_credit_notes
--
-- Task 1.4 (migration 20260417121720) created both as plain LANGUAGE plpgsql
-- without SECURITY DEFINER or explicit search_path. The pattern the rest of
-- the billing engine uses (is_admin_in_company, detect_billing_basis_drift)
-- is SECURITY DEFINER + SET search_path = public, extensions — this brings
-- both functions in line. Bodies unchanged.
-- ============================================

CREATE OR REPLACE FUNCTION public.assign_invoice_number() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.status = 'issued' AND NEW.invoice_number IS NULL THEN
    NEW.invoice_number := nextval('public.invoice_number_seq');
    NEW.issued_at := COALESCE(NEW.issued_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_nested_credit_notes() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_original_type invoice_type;
BEGIN
  IF NEW.credits_invoice_id IS NOT NULL THEN
    SELECT invoice_type INTO v_original_type
    FROM public.invoice
    WHERE invoice_id = NEW.credits_invoice_id;

    IF v_original_type = 'credit_note' THEN
      RAISE EXCEPTION 'Cannot issue credit note against another credit note (invoice_id=%)', NEW.credits_invoice_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assign_invoice_number IS
  'Assigns invoice_number from invoice_number_seq on draft -> issued transition. SECURITY DEFINER + SET search_path for safe trigger context.';

COMMENT ON FUNCTION public.prevent_nested_credit_notes IS
  'Blocks credit notes that point at another credit note (cross-row constraint). SECURITY DEFINER + SET search_path per billing hardening pattern.';
