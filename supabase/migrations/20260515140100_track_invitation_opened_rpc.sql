-- RPC: track_invitation_opened
-- Sets opened_at = now() on first open. Idempotent (WHERE opened_at IS NULL).
-- Called from /invite/[token] page on mount. Unauthenticated callers allowed because
-- the token itself is the credential (ADR-0167) — token is a UUID with 122 bits of entropy.
--
-- Returns: boolean — true on first successful mark, false if already opened / not found / expired.
-- Reference pattern: get_invitation_by_token in 20260327120001_invitation_rls_rpc.sql.

CREATE OR REPLACE FUNCTION public.track_invitation_opened(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.invitation
  SET opened_at = now()
  WHERE token = p_token
    AND opened_at IS NULL
    AND status = 'pending'
    AND expires_at > now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_invitation_opened(uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.track_invitation_opened(uuid) IS
  'Marks an invitation as opened on first view. Idempotent. Returns true on first successful mark, false otherwise (already opened, not found, or expired). Called from /invite/[token] page. Unauthenticated callers allowed because token is credential (ADR-0167). Per Auth & Invitation Spec Scope Council 2026-04-20 Q6=a.';
