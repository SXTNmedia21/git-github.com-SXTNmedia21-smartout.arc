-- Add onboarding_completed flag to workspace.
-- Decouples onboarding routing from contract_status which has its own lifecycle.
-- New workspaces default to false → redirect to /onboarding.
-- finalize_onboarding_workspace sets this to true.

ALTER TABLE public.workspace
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Mark existing workspaces that have departments as already onboarded
-- (they went through finalize_onboarding_workspace before this column existed)
UPDATE public.workspace w
SET onboarding_completed = true
WHERE EXISTS (
  SELECT 1 FROM public.department d WHERE d.workspace_id = w.workspace_id
);

-- Also mark the seed/hq workspace as completed
UPDATE public.workspace
SET onboarding_completed = true
WHERE workspace_id = 'b0000000-0000-0000-0000-000000000000';
