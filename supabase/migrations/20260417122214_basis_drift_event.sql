SET search_path TO public, extensions;

-- ============================================
-- 20260417122214_basis_drift_event.sql
-- Billing Engine Fase 1 — Task 1.7
-- Audit + detection for retroactive schedule_shift changes that affect
-- already-issued invoices. Per ADR-0119.
-- ============================================

-- ── Table ────────────────────────────────────────────────────
CREATE TABLE public.basis_drift_event (
  drift_event_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_snapshot_id    uuid NOT NULL REFERENCES public.usage_snapshot(usage_snapshot_id),
  invoice_id           uuid REFERENCES public.invoice(invoice_id),

  -- Holds the UUID of the affected schedule_shift row. No FK — the shift
  -- may be deleted (that is exactly one of the drift types we track).
  -- Column name kept as `shift_id` for readability of audit queries.
  shift_id             uuid,

  drift_type           text NOT NULL CHECK (drift_type IN (
    'status_reversed', 'employee_changed', 'shift_deleted', 'other'
  )),
  old_value            jsonb,
  new_value            jsonb,

  detected_at          timestamptz NOT NULL DEFAULT now(),
  reviewed_at          timestamptz,
  reviewed_by          uuid REFERENCES public.user_identity(user_id),
  resolution           text CHECK (
    resolution IS NULL OR resolution IN ('ignored', 'credit_note_issued', 'reinvoiced')
  )
);

CREATE INDEX idx_drift_event_invoice
  ON public.basis_drift_event(invoice_id);
CREATE INDEX idx_drift_event_unreviewed
  ON public.basis_drift_event(detected_at)
  WHERE reviewed_at IS NULL;

-- ── Detection trigger on schedule_shift ──────────────────────
-- Fires on UPDATE/DELETE of a schedule_shift row. If the shift's date
-- falls within a period for which a usage_snapshot exists, inserts
-- a drift event for platform-admin review.
--
-- IMPORTANT: schedule_shift's PK column is `schedule_shift_id`
-- (not `shift_id`). The local column on basis_drift_event is
-- `shift_id` — it just stores the UUID value.
CREATE OR REPLACE FUNCTION public.detect_billing_basis_drift() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_snapshot_id uuid;
  v_invoice_id  uuid;
  v_drift_type  text;
  v_shift_uuid  uuid;
  v_shift_date  date;
  v_workspace   uuid;
BEGIN
  -- Resolve shift fields from NEW (UPDATE) or OLD (DELETE).
  v_shift_uuid := COALESCE(NEW.schedule_shift_id, OLD.schedule_shift_id);
  v_shift_date := COALESCE(NEW.shift_date, OLD.shift_date);
  v_workspace  := COALESCE(NEW.workspace_id, OLD.workspace_id);

  -- Find matching usage_snapshot for the shift's workspace + date.
  SELECT us.usage_snapshot_id INTO v_snapshot_id
  FROM public.usage_snapshot us
  WHERE us.workspace_id = v_workspace
    AND v_shift_date BETWEEN us.period_from AND us.period_to
  LIMIT 1;

  IF v_snapshot_id IS NULL THEN
    RETURN NEW;  -- no snapshot covers this period — no drift to log
  END IF;

  -- Find associated invoice (if one was issued for this period).
  SELECT i.invoice_id INTO v_invoice_id
  FROM public.invoice i
  JOIN public.usage_snapshot us
    ON us.company_id = i.company_id
   AND us.period_from = i.period_from
   AND us.period_to   = i.period_to
  WHERE us.usage_snapshot_id = v_snapshot_id
    AND i.status IN ('issued', 'sent', 'paid', 'overdue')
  LIMIT 1;

  -- Determine drift type.
  IF TG_OP = 'DELETE' THEN
    v_drift_type := 'shift_deleted';
  ELSIF OLD.status = 'completed' AND NEW.status <> 'completed' THEN
    v_drift_type := 'status_reversed';
  ELSIF OLD.employee_id IS DISTINCT FROM NEW.employee_id THEN
    v_drift_type := 'employee_changed';
  ELSE
    RETURN NEW;  -- not a billing-relevant change
  END IF;

  INSERT INTO public.basis_drift_event (
    usage_snapshot_id, invoice_id, shift_id, drift_type, old_value, new_value
  ) VALUES (
    v_snapshot_id,
    v_invoice_id,
    v_shift_uuid,
    v_drift_type,
    to_jsonb(OLD.*),
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW.*) END
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_detect_billing_basis_drift
  AFTER UPDATE OR DELETE ON public.schedule_shift
  FOR EACH ROW EXECUTE FUNCTION public.detect_billing_basis_drift();

COMMENT ON TABLE public.basis_drift_event IS
  'Audit trail for retroactive schedule_shift changes that affect issued invoices. Per ADR-0119. Platform admin reviews + resolves (ignore / credit_note / reinvoice).';

COMMENT ON COLUMN public.basis_drift_event.shift_id IS
  'UUID of the affected schedule_shift row (no FK — shift may be deleted). Value comes from schedule_shift.schedule_shift_id via detect_billing_basis_drift trigger.';

COMMENT ON FUNCTION public.detect_billing_basis_drift IS
  'AFTER UPDATE OR DELETE trigger on schedule_shift. Logs billing-relevant retroactive changes (status_reversed, employee_changed, shift_deleted) when a usage_snapshot covers the shift date. Per ADR-0119.';
