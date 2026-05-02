-- ============================================
-- 20260519180000_contract_obligation_notified_at.sql
-- Add notified_at column to contract_obligation for due-soon cron idempotency.
--
-- Why: obligation-due-soon-cron (Wave 5, WS1D) needs to track when a
-- "due soon" push notification was sent so it doesn't re-notify daily.
-- Idempotent: cron skips rows where notified_at is within the last 24h.
--
-- Wave 5 (services-contract-employee / Journey 4 step 6).
-- ============================================

ALTER TABLE public.contract_obligation
  ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.contract_obligation.notified_at IS
  'Last time a due-soon push notification was sent for this obligation. '
  'Used by obligation-due-soon-cron for idempotency (skip if notified within 24h). '
  'Wave 5 WS1D, migration 20260519180000.';

-- Index for the due-soon cron query: pending obligations with due_at approaching.
CREATE INDEX IF NOT EXISTS contract_obligation_due_soon_cron
  ON public.contract_obligation (workspace_id, status, due_at, notified_at)
  WHERE status = 'pending';
