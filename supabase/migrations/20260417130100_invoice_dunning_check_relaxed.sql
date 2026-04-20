SET search_path TO public, extensions;

-- ============================================
-- 20260417130100_invoice_dunning_check_relaxed.sql
-- Billing Engine Fase 1.5 — Code-reviewer important #4
--
-- Problem:
--   invoice_status_dunning_legal CHECK in Task 1.4 permits dunning_status
--   only in ('none','in_negotiation') when status IN ('issued','sent').
--   Real-world Fase 2 dunning flow needs 'sent + reminder_sent' and
--   'sent + escalated' as legal states — an invoice is delivered (status
--   sent) and dunning progresses (first reminder, then final notice)
--   without necessarily transitioning the status column to 'overdue'.
--
--   The original ADR-0120 §5 legality matrix was written BEFORE the
--   dunning_status enum was renamed from {dunning_1, dunning_final} to
--   {reminder_sent, escalated}. The intent was always: dunning progresses
--   orthogonally to invoice_status while the invoice is active (issued,
--   sent, overdue). The CHECK encoded a tighter interpretation than the
--   ADR intent.
--
-- Fix:
--   Relax the CHECK so the dunning_status column is free to take any enum
--   value (including NULL) while invoice_status IN ('issued','sent','overdue').
--   Terminal statuses (draft, paid, void, uncollectible) continue to
--   require dunning_status IS NULL — dunning is meaningless on closed
--   invoices.
--
--   Enum values bound dunning_status ('none','in_negotiation','reminder_sent',
--   'escalated'); there is no risk of arbitrary text slipping in.
--
-- Test coverage:
--   supabase/tests/migrations/20260417_billing_constraints.spec.sql —
--   existing Test 4 (paid + escalated rejected) still passes; new Test 6
--   (sent + reminder_sent lives_ok) asserts the relaxation.
-- ============================================

ALTER TABLE public.invoice
  DROP CONSTRAINT invoice_status_dunning_legal;

ALTER TABLE public.invoice
  ADD CONSTRAINT invoice_status_dunning_legal
  CHECK (
    (status IN ('draft', 'paid', 'void', 'uncollectible') AND dunning_status IS NULL)
    OR status IN ('issued', 'sent', 'overdue')
  );

COMMENT ON CONSTRAINT invoice_status_dunning_legal ON public.invoice IS
  'Terminal invoice statuses (draft/paid/void/uncollectible) require dunning_status IS NULL. Active statuses (issued/sent/overdue) accept any dunning_status value from the enum. Relaxed 2026-04-17 (Phase 1.5, code-reviewer important #4): the Fase 2 dunning flow needs sent + reminder_sent and sent + escalated as legal states while invoice_status stays at ''sent''. Enum bounds dunning_status values.';
