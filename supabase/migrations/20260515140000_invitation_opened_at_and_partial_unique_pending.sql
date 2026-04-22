-- Adds opened_at column for invitation open-tracking (L-0090 timestamp-not-enum heuristic —
-- keeps invite_status enum stable while allowing first-open telemetry).
-- Adds partial unique index enforcing one pending invitation per (workspace, lower(email)) per ADR-0169.
--
-- Table name note: the canonical table is `public.invitation` (not `workspace_invitation`).
-- No `cancelled_at` column exists on invitation — the `updated_at` trigger handles the bump on UPDATE.

-- 1. Pre-cleanup: cancel any existing duplicate pending rows per (workspace, case-insensitive-email).
--    Keep the most recent (by created_at) pending row; set the rest to 'cancelled'.
UPDATE public.invitation
SET status = 'cancelled'
WHERE status = 'pending'
  AND invitation_id NOT IN (
    SELECT DISTINCT ON (workspace_id, lower(email)) invitation_id
    FROM public.invitation
    WHERE status = 'pending'
      AND email IS NOT NULL
    ORDER BY workspace_id, lower(email), created_at DESC
  )
  AND email IS NOT NULL;

-- 2. Add opened_at column (nullable — pending invitations haven't been opened yet).
ALTER TABLE public.invitation
  ADD COLUMN IF NOT EXISTS opened_at timestamptz NULL;

COMMENT ON COLUMN public.invitation.opened_at IS
  'Set when invitee first visits /invite/[token]. NULL means never opened. Per L-0090 timestamp-not-enum heuristic — keeps invite_status enum stable.';

-- 3. Partial unique index — case-insensitive email, pending-only.
--    Coexists with idx_invitation_unique_email (case-sensitive, all statuses) from
--    20260301220023_invitation_sms_support.sql — different predicate + different key set.
CREATE UNIQUE INDEX IF NOT EXISTS workspace_invitation_pending_unique_per_email
  ON public.invitation (workspace_id, lower(email))
  WHERE status = 'pending' AND email IS NOT NULL;

COMMENT ON INDEX public.workspace_invitation_pending_unique_per_email IS
  'ADR-0169: one active pending invitation per (workspace, case-insensitive-email). Allows re-invite after cancel/expiry. Matches auth.users email normalization.';
