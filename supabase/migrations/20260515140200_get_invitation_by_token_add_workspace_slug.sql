-- Extends get_invitation_by_token to expose workspace_slug + workspace_logo_url.
-- The /invite/[token] redesign needs these for:
--   * Workspace logo rendering in InvitationContextHeader (workspace_logo_url)
--   * Deterministic per-workspace accent color via workspaceAccentHue(slug)
--   * Future deep-links (e.g. login redirect carrying invite context)
--
-- Additive only — existing JSON keys are preserved. Existing callers that
-- spread the JSON into their typed shape see no breakage; new fields are
-- accessed by key on the UI layer.

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
    'workspace_id', i.workspace_id,
    'workspace_name', w.name,
    'workspace_slug', w.slug,
    'workspace_logo_url', w.logo_url,
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

COMMENT ON FUNCTION public.get_invitation_by_token(uuid) IS
  'Returns invitation details by token. SECURITY DEFINER — token acts as credential (ADR-0167). Non-pending invitations return { status } only (no PII leak). Pending invitations include workspace_slug + workspace_logo_url for UI theming (2026-05-15 extension).';
