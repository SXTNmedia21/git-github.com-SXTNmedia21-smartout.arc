-- Fix invitation flow gaps:
-- 1. Unique constraint on company_member (user_id, company_id) for upsert support
-- 2. RLS INSERT policy on company_member (admin can add members)
-- 3. Function to expire stale invitations

-- 1. Unique constraint (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_company_member_user_company'
  ) THEN
    ALTER TABLE public.company_member
      ADD CONSTRAINT uq_company_member_user_company
      UNIQUE (user_id, company_id);
  END IF;
END $$;

-- 2. RLS: Admins in the company's workspaces can insert company_members
-- (accept-invitation uses service role so this is for future JWT-based paths)
CREATE POLICY "Admins can insert company members"
  ON public.company_member FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace w
      JOIN public.profile p ON p.workspace_id = w.workspace_id
      WHERE w.company_id = company_member.company_id
        AND p.user_id = auth.uid()
        AND p.role IN ('admin', 'owner')
        AND p.is_active = true
    )
  );

-- 3. Expire stale invitations (pending + past expires_at)
CREATE OR REPLACE FUNCTION public.expire_stale_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.invitation
  SET status = 'expired', updated_at = now()
  WHERE status = 'pending'
    AND expires_at < now();
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

COMMENT ON FUNCTION public.expire_stale_invitations()
  IS 'Marks pending invitations past their expiry as expired. Call via cron or watchdog.';
