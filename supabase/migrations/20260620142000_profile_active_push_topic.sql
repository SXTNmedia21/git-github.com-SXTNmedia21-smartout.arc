-- Migration: profile_active_push_topic
--
-- Adds active_push_topic to profile table for day-line push routing.
-- ADR-0367 §M4 debt item: the shift-session push subscribe/unsubscribe flow
-- (apps/mobile/src/lib/push.ts) needs a column to persist which push topic
-- the employee is currently subscribed to so the server-side day-line push
-- pipeline can target the correct device without querying engine_event.
--
-- Column is NULL when the profile is not subscribed to any push topic.
-- Mobile clock-in sets it; clock-out clears it. No back-fill needed —
-- the next clock-in event will populate it.
--
-- RLS: inherits existing profile-table policies (row-level; no column
-- exclusions). Existing policies already allow:
--   SELECT  — any workspace member can read profiles in their workspace.
--   UPDATE  — own row (via "Users can update own profile") + admin policy.
-- active_push_topic updates come from the authenticated mobile client
-- acting as the profile owner → covered by "Users can update own profile".

ALTER TABLE public.profile
  ADD COLUMN active_push_topic text NULL;

COMMENT ON COLUMN public.profile.active_push_topic IS
  'Currently-subscribed push topic for day-line push routing (ADR-0367 §M4). '
  'Format: dept:<department_id> or shift:<shift_session_id>. '
  'NULL means the profile is not currently subscribed to any push topic. '
  'Set at clock-in, cleared at clock-out by the mobile client. '
  'Server-side push pipeline uses this column to route day-line events '
  'to the correct device without a round-trip engine_event lookup.';

-- Partial index for routing lookups — only subscribed profiles need to be
-- found quickly; the NULL rows (unsubscribed) are excluded for index size.
CREATE INDEX profile_active_push_topic_idx
  ON public.profile (active_push_topic)
  WHERE active_push_topic IS NOT NULL;
