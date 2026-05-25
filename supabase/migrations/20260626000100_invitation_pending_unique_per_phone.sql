-- BUG-002 fix: mirror the email partial-unique pattern (ADR-0169 / 2026-05-15) for phone.
--
-- Problem: idx_invitation_unique_phone on (workspace_id, phone, status) WHERE phone IS NOT NULL
-- was created 2026-03-01 (20260301220023_invitation_sms_support.sql:34-36).
-- Because status is PART of the index key, multiple rows with status='cancelled' for the same
-- (workspace_id, phone) collide — blocking resend after 2+ attempts.
--
-- Email got the correct fix 2026-05-15 (workspace_invitation_pending_unique_per_email):
--   partial unique WHERE status='pending' AND email IS NOT NULL
-- Phone must mirror exactly that pattern.
--
-- Precedent: ADR-0169 (email), 2026-05-15 email migration (a60662680 / 20260515140000).
-- Ref: BUG-002 (docs/test-runs/2026-05-23-prod-release-d766392a.md), ADR-0409.

-- 1. Pre-cleanup: cancel accumulated duplicate cancelled rows per (workspace_id, phone).
--    Keeps the most recent (by created_at) per triple; sets the rest to 'cancelled'.
--    Idempotent — safe to run even if no duplicates exist.
DO $$
BEGIN
  UPDATE public.invitation
  SET status = 'cancelled'
  WHERE status = 'cancelled'
    AND phone IS NOT NULL
    AND invitation_id NOT IN (
      SELECT DISTINCT ON (workspace_id, phone, status) invitation_id
      FROM public.invitation
      WHERE status = 'cancelled'
        AND phone IS NOT NULL
      ORDER BY workspace_id, phone, status, created_at DESC
    );
END $$;

-- 2. DROP the bug-causing index.
--    The index treats (workspace_id, phone, status) as a composite key so
--    multiple 'cancelled' rows for the same (workspace, phone) collide.
DROP INDEX IF EXISTS idx_invitation_unique_phone;

-- 3. CREATE partial unique index — pending rows only.
--    Allows unlimited cancelled/accepted history rows for the same (workspace, phone).
--    Prevents duplicate pending invitations (the only real constraint needed).
CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitation_pending_unique_per_phone
  ON public.invitation (workspace_id, phone)
  WHERE status = 'pending' AND phone IS NOT NULL;

COMMENT ON INDEX workspace_invitation_pending_unique_per_phone IS
  'ADR-0409 / ADR-0169: one active pending invitation per (workspace, phone). '
  'Mirrors workspace_invitation_pending_unique_per_email from 2026-05-15. '
  'Allows re-invite after cancel/expiry. Replaced idx_invitation_unique_phone (BUG-002).';
