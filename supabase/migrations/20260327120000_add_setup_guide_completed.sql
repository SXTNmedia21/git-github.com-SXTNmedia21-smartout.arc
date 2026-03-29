-- Add explicit flag for dashboard setup guide completion.
-- Separate from onboarding_completed (which controls /onboarding → /dashboard).
-- When false + not dismissed in sessionStorage → redirect to /dashboard/setup on page load.
ALTER TABLE public.workspace
  ADD COLUMN IF NOT EXISTS setup_guide_completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.workspace.setup_guide_completed IS
  'Whether the post-bootstrap setup guide has been completed. Separate from onboarding_completed.';
