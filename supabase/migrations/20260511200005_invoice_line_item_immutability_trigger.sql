SET search_path TO public, extensions;

-- ============================================
-- 20260511200005_invoice_line_item_immutability_trigger.sql
-- Billing Engine Fase 2 — B1 Migration F
--
-- Spec §5.2 + §6: block UPDATE/DELETE of invoice_line_item rows where
-- usage_snapshot_id IS NOT NULL when the parent invoice is not in draft.
-- Enforces reproducibility (ADR-0119): usage-backed lines are immutable
-- once the invoice ships.
--
-- Manual lines (usage_snapshot_id IS NULL) and draft invoices remain
-- freely editable by platform-admin.
--
-- Ref: Fase 2 spec §5.2, ADR-0119, ADR-0120.
-- ============================================

CREATE OR REPLACE FUNCTION public.prevent_usage_line_mutation_on_locked_invoice()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_id     uuid;
  v_usage_snap     uuid;
  v_parent_status  invoice_status;
BEGIN
  -- Pick the row we're inspecting (OLD for UPDATE/DELETE). NEW rows on
  -- INSERT are not our concern — this trigger guards locking, not creation.
  v_invoice_id := OLD.invoice_id;
  v_usage_snap := OLD.usage_snapshot_id;

  -- Only usage-backed lines are locked. Manual adjustment lines
  -- (usage_snapshot_id IS NULL) remain editable.
  IF v_usage_snap IS NULL THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT status INTO v_parent_status
  FROM public.invoice
  WHERE invoice_id = v_invoice_id;

  -- Parent must still be draft to allow mutation of usage-backed lines.
  IF v_parent_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION
      'invoice_line_item with usage_snapshot_id=% cannot be % on invoice % (status=%). Reproducibility guarantee per ADR-0119.',
      v_usage_snap,
      lower(TG_OP),
      v_invoice_id,
      v_parent_status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

COMMENT ON FUNCTION public.prevent_usage_line_mutation_on_locked_invoice() IS
  'ADR-0119 reproducibility: usage-backed invoice_line_item rows are immutable once the invoice leaves draft status. Manual adjustment lines (usage_snapshot_id IS NULL) are unaffected.';

-- ── UPDATE guard ─────────────────────────────────────────────
CREATE TRIGGER trg_invoice_line_item_prevent_update_on_locked
  BEFORE UPDATE ON public.invoice_line_item
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_usage_line_mutation_on_locked_invoice();

-- ── DELETE guard ─────────────────────────────────────────────
CREATE TRIGGER trg_invoice_line_item_prevent_delete_on_locked
  BEFORE DELETE ON public.invoice_line_item
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_usage_line_mutation_on_locked_invoice();
