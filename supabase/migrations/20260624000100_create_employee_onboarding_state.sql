-- 20260624000100_create_employee_onboarding_state.sql
-- Per-user resumable state for the welcome wizard. Status enum + JSONB step_data.
-- completed_at mirrors profile.welcome_completed_at — set in same transaction.

CREATE TABLE public.employee_onboarding_state (
  profile_id          UUID PRIMARY KEY REFERENCES public.profile(profile_id) ON DELETE CASCADE,
  workspace_id        UUID NOT NULL REFERENCES public.workspace(workspace_id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','dismissed','completed')),
  current_step_index  INT NOT NULL DEFAULT 0,
  step_data           JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- status / timestamp coherence
  CONSTRAINT eos_completed_iff_ts CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
  CONSTRAINT eos_dismissed_iff_ts CHECK ((status = 'dismissed') = (dismissed_at IS NOT NULL))
);

ALTER TABLE public.employee_onboarding_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_select_own_onboarding_state" ON public.employee_onboarding_state
  FOR SELECT
  USING (
    profile_id IN (
      SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "jwt_update_own_onboarding_state" ON public.employee_onboarding_state
  FOR UPDATE
  USING (
    profile_id IN (
      SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "jwt_insert_own_onboarding_state" ON public.employee_onboarding_state
  FOR INSERT
  WITH CHECK (
    profile_id IN (
      SELECT p.profile_id FROM public.profile p WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "api_key_select_onboarding_state" ON public.employee_onboarding_state
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());

CREATE TRIGGER set_employee_onboarding_state_updated_at
  BEFORE UPDATE ON public.employee_onboarding_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE  public.employee_onboarding_state IS
  'Per-user resumable wizard state. PK = profile_id (1:1 with profile).';
COMMENT ON COLUMN public.employee_onboarding_state.step_data IS
  'Partial form values for resumability. NEVER contains PII (personal_number, bank_account).';
