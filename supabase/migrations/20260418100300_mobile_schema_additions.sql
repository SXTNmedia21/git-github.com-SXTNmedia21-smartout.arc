-- Schema additions for mobile app: shift confirmation, chat channels,
-- invitation direction (inbound join requests), and push notification tokens.

-- ── schedule_shift: confirmation tracking ───────────────────────
-- Employees confirm upcoming shifts. NULL = unconfirmed.
ALTER TABLE public.schedule_shift ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE public.schedule_shift ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profile(profile_id);

COMMENT ON COLUMN public.schedule_shift.confirmed_at IS 'When the employee confirmed this shift. NULL = unconfirmed.';
COMMENT ON COLUMN public.schedule_shift.confirmed_by IS 'Profile who confirmed. Should match employee_id in normal flow.';

-- RLS: employees can confirm their own shifts (update only confirmed_at/confirmed_by)
-- This policy allows employees to update their own shifts for confirmation purposes.
-- The existing schedule_shift RLS handles admin/manager access.
CREATE POLICY "jwt_employee_confirm_own_shift" ON public.schedule_shift
  FOR UPDATE
  USING (
    employee_id IN (
      SELECT profile_id FROM public.profile
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    employee_id IN (
      SELECT profile_id FROM public.profile
      WHERE user_id = auth.uid()
    )
  );

-- ── chat_conversation: source type for channel categorization ───
-- Groups are department/team/session channels. source_type + source_id identify the source.
-- Polymorphic reference: NO FK because source_id can reference department, team, or session.
ALTER TABLE public.chat_conversation ADD COLUMN IF NOT EXISTS source_type TEXT;
ALTER TABLE public.chat_conversation ADD COLUMN IF NOT EXISTS source_id UUID;

-- CHECK: source_type must be a known value or NULL
ALTER TABLE public.chat_conversation ADD CONSTRAINT chk_conversation_source_type
  CHECK (source_type IS NULL OR source_type IN ('department', 'team', 'session'));

COMMENT ON COLUMN public.chat_conversation.source_type IS 'Channel source: department, team, session, or NULL (DM/AI).';
COMMENT ON COLUMN public.chat_conversation.source_id IS 'FK to department_id, team_id, or department_session_id. Polymorphic — no FK constraint.';

-- ── invitation: direction + requested_by for join requests ──────
-- 'outbound' = admin invites employee. 'inbound' = employee requests to join.
ALTER TABLE public.invitation ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'outbound';
ALTER TABLE public.invitation ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES public.profile(profile_id);

ALTER TABLE public.invitation ADD CONSTRAINT chk_invitation_direction
  CHECK (direction IN ('outbound', 'inbound'));

COMMENT ON COLUMN public.invitation.direction IS 'outbound = admin invites, inbound = employee requests to join.';
COMMENT ON COLUMN public.invitation.requested_by IS 'Profile who requested access. NULL for outbound invitations.';

-- ── profile: expo push token ────────────────────────────────────
-- One device per person in V1. Updated at app startup.
ALTER TABLE public.profile ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

COMMENT ON COLUMN public.profile.expo_push_token IS 'Expo push notification token. Updated at mobile app startup. One device per person in V1.';
