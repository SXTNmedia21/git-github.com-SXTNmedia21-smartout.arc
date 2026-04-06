-- Drop the insecure blanket anon SELECT policy on invitation table.
-- This policy allowed any anonymous user to SELECT all invitation rows
-- including PII (email, phone, names, workspace IDs).
-- Replaced by get_invitation_by_token() RPC for token-scoped lookups.
DROP POLICY IF EXISTS "Anyone can read invitation by token" ON public.invitation;

-- RPC: get_invitation_by_token
-- Used by the /invite/[token] accept page to fetch invitation details.
-- SECURITY DEFINER so it can read invitation table and auth.users without RLS.
-- Token (UUID, 122-bit entropy) acts as authorization — no JWT needed.
-- Non-pending invitations return status only (no PII exposure).
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  inv_status text;
BEGIN
  SELECT i.status INTO inv_status
  FROM invitation i
  WHERE i.token = p_token;

  IF inv_status IS NULL THEN
    RETURN NULL;
  END IF;

  IF inv_status != 'pending' THEN
    RETURN json_build_object('status', inv_status);
  END IF;

  SELECT json_build_object(
    'invitation_id', i.invitation_id,
    'email', i.email,
    'phone', i.phone,
    'first_name', i.first_name,
    'last_name', i.last_name,
    'role', i.role,
    'status', i.status,
    'expires_at', i.expires_at,
    'workspace_name', w.name,
    'inviter_name', p.display_name,
    'email_account_exists', EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.email = lower(i.email)
    )
  ) INTO result
  FROM invitation i
  LEFT JOIN workspace w ON w.workspace_id = i.workspace_id
  LEFT JOIN profile p ON p.profile_id = i.invited_by
  WHERE i.token = p_token;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(uuid) TO anon, authenticated;
