-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: staff_event + staff_event_attendee
--
-- What: Dedicated tables for staff events (utviklingssamtale, personalmøte,
--       personalfest, annet) that admins/managers use to summon employees.
--
-- Why: Calendar-class entity with no state-machine, no SLA, no authority gate.
--      Reusing engine_state would smuggle calendar semantics into a runtime
--      record — see ADR-0245.
--
-- Tables: public.staff_event, public.staff_event_attendee
-- Enums: staff_event_type, staff_event_attendee_status
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE public.staff_event_type AS ENUM (
  'utviklingssamtale',
  'personalmote',
  'personalfest',
  'annet'
);

CREATE TYPE public.staff_event_attendee_status AS ENUM (
  'invited',
  'accepted',
  'declined',
  'tentative'
);

-- ── staff_event ───────────────────────────────────────────────────────────────
-- One row per staff event created by an admin or manager.
-- No state machine — purely a calendar record + attendee list.

CREATE TABLE public.staff_event (
  event_id      uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  uuid        NOT NULL REFERENCES public.workspace(workspace_id),
  event_type    public.staff_event_type NOT NULL,
  title         text        NOT NULL,
  message       text,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  location      text,
  created_by    uuid        NOT NULL REFERENCES public.profile(profile_id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT staff_event_time_valid CHECK (ends_at > starts_at)
);

-- Primary access pattern: admin views events sorted by start time.
CREATE INDEX idx_staff_event_workspace ON public.staff_event (workspace_id, starts_at DESC);

-- Trigger: keep updated_at fresh
DROP TRIGGER IF EXISTS set_staff_event_updated_at ON public.staff_event;
CREATE TRIGGER set_staff_event_updated_at
  BEFORE UPDATE ON public.staff_event
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── staff_event_attendee ──────────────────────────────────────────────────────
-- Junction table: which profiles are invited to which event, and their status.

CREATE TABLE public.staff_event_attendee (
  event_id      uuid        NOT NULL REFERENCES public.staff_event(event_id) ON DELETE CASCADE,
  profile_id    uuid        NOT NULL REFERENCES public.profile(profile_id),
  status        public.staff_event_attendee_status NOT NULL DEFAULT 'invited',
  responded_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (event_id, profile_id)
);

-- "Events I'm invited to" lookup (employee-facing, Phase 2).
CREATE INDEX idx_staff_event_attendee_profile ON public.staff_event_attendee (profile_id);

-- ── RLS: staff_event ──────────────────────────────────────────────────────────

ALTER TABLE public.staff_event ENABLE ROW LEVEL SECURITY;

-- JWT: all workspace members can read events in their workspace.
DROP POLICY IF EXISTS "jwt_read_staff_event" ON public.staff_event;
CREATE POLICY "jwt_read_staff_event" ON public.staff_event
  FOR SELECT
  USING (workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid())));

-- JWT: only admin / manager / owner can create, update, delete events.
DROP POLICY IF EXISTS "jwt_write_staff_event" ON public.staff_event;
CREATE POLICY "jwt_write_staff_event" ON public.staff_event
  FOR ALL
  USING (
    workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile
      WHERE user_id = auth.uid()
        AND workspace_id = staff_event.workspace_id
        AND role IN ('manager', 'admin', 'owner')
    )
  );

-- API key: read access for workspace-scoped API consumers.
DROP POLICY IF EXISTS "api_key_read_staff_event" ON public.staff_event;
CREATE POLICY "api_key_read_staff_event" ON public.staff_event
  FOR SELECT
  USING (workspace_id = get_api_workspace_id());

-- ── RLS: staff_event_attendee ─────────────────────────────────────────────────

ALTER TABLE public.staff_event_attendee ENABLE ROW LEVEL SECURITY;

-- JWT: workspace members can see attendee lists.
-- Join through staff_event to derive workspace_id.
DROP POLICY IF EXISTS "jwt_read_staff_event_attendee" ON public.staff_event_attendee;
CREATE POLICY "jwt_read_staff_event_attendee" ON public.staff_event_attendee
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_event se
      WHERE se.event_id = staff_event_attendee.event_id
        AND se.workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
    )
  );

-- JWT: admin / manager / owner can insert and delete attendees.
DROP POLICY IF EXISTS "jwt_write_staff_event_attendee" ON public.staff_event_attendee;
CREATE POLICY "jwt_write_staff_event_attendee" ON public.staff_event_attendee
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_event se
      JOIN public.profile p ON p.user_id = auth.uid()
                           AND p.workspace_id = se.workspace_id
      WHERE se.event_id = staff_event_attendee.event_id
        AND p.role IN ('manager', 'admin', 'owner')
    )
  );

-- API key: read attendees for workspace-scoped API consumers.
DROP POLICY IF EXISTS "api_key_read_staff_event_attendee" ON public.staff_event_attendee;
CREATE POLICY "api_key_read_staff_event_attendee" ON public.staff_event_attendee
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_event se
      WHERE se.event_id = staff_event_attendee.event_id
        AND se.workspace_id = get_api_workspace_id()
    )
  );
