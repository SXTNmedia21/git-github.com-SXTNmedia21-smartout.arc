-- workspace.signatory_profile_id — the profile authorized to sign contracts
-- on behalf of the workspace (prokura). Set when an owner-role invitation
-- is accepted (see supabase/functions/accept-invitation/index.ts). Nullable
-- for legacy workspaces that have not yet been re-bound through the new
-- owner-invite flow.

ALTER TABLE public.workspace
  ADD COLUMN IF NOT EXISTS signatory_profile_id UUID NULL
  REFERENCES public.profile(profile_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.workspace.signatory_profile_id IS
  'Profile authorized to sign contracts on behalf of the workspace (prokura). Set when an owner-role invitation is accepted. Nullable for legacy workspaces.';

CREATE INDEX IF NOT EXISTS idx_workspace_signatory_profile
  ON public.workspace(signatory_profile_id)
  WHERE signatory_profile_id IS NOT NULL;
