SET search_path TO public, extensions;

-- ============================================
-- 20260621200001_void_stuck_draft_invoices.sql
-- feat/billing-cron-correctness — C2 One-shot cleanup
--
-- Voids header-only recurring draft invoices left by the pre-C1
-- non-transactional generator. These drafts held the partial-index
-- idx_invoice_one_recurring_per_period (WHERE status<>'void') hostage,
-- causing affected companies to be silently skipped on every subsequent
-- cron run (the early-exit at L115 in generator.ts treated the stuck
-- draft as "already billed").
--
-- After this migration, affected companies are re-billed on the next
-- run because the void exclusion in the partial index releases the slot.
--
-- Idempotency: no-op on fresh DB or after C1 is deployed (no new stuck
-- drafts will be created by the atomic fn_generate_company_invoice).
-- Safe to run multiple times — re-voiding an already-void row has no
-- effect because the WHERE clause filters on status='draft'.
-- ============================================

UPDATE public.invoice
SET
  status     = 'void',
  voided_at  = now(),
  void_reason = 'auto-voided by C2 migration: header-only stuck draft from pre-C1 non-transactional generator',
  updated_at = now()
WHERE
  invoice_type = 'recurring'
  AND status = 'draft'
  AND NOT EXISTS (
    SELECT 1
    FROM public.invoice_line_item li
    WHERE li.invoice_id = invoice.invoice_id
  );
