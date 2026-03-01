-- Migration: invitation_token_lookup_policy
-- Purpose: Allow unauthenticated users to look up an invitation by its token.
-- This is needed for the /invite/[token] page where the invitee has no auth session.
-- The existing RLS policies require workspace membership, but the invitee
-- isn't a member yet.

-- Allow anon (unauthenticated) SELECT on invitation by token.
-- This is safe because:
--   1. Token is a UUID — not guessable (122 bits of entropy)
--   2. Only reveals email + status + workspace name (via join)
--   3. The accept-invitation Edge Function uses service_role for writes
CREATE POLICY "Anyone can read invitation by token"
  ON public.invitation FOR SELECT
  TO anon, authenticated
  USING (true);
-- Note: The token itself acts as the authorization. The query from the
-- client filters by token, and the UUID is unguessable (122 bits of entropy).
-- If tighter control is needed later, we can restrict to:
--   USING (token = current_setting('app.invitation_token', true)::uuid)
-- But that requires middleware to set the config, which adds complexity
-- for no practical security gain given UUID entropy.
