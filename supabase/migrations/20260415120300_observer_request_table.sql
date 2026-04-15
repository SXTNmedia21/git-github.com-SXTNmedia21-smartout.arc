-- 20260415120300_observer_request_table.sql
-- Phase 0 Foundation — Task 4
-- Per ADR-0103, observer_request is a C4 Decision-layer object, parallel to shift_approval.
SET search_path TO public, extensions;

CREATE TYPE observer_request_status AS ENUM (
  'pending',
  'claimed',
  'approved',
  'rejected',
  'expired'
);

CREATE TABLE observer_request (
  observer_request_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  protocol_assignment_id UUID NOT NULL REFERENCES protocol_assignment(assignment_id) ON DELETE CASCADE,
  subject_profile_id     UUID NOT NULL REFERENCES profile(profile_id),
  observer_profile_id    UUID REFERENCES profile(profile_id),
  requested_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at             TIMESTAMPTZ,
  resolved_at            TIMESTAMPTZ,
  status                 observer_request_status NOT NULL DEFAULT 'pending',
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_observer_request_workspace_status ON observer_request (workspace_id, status);
CREATE INDEX idx_observer_request_subject ON observer_request (subject_profile_id);
CREATE INDEX idx_observer_request_observer ON observer_request (observer_profile_id) WHERE observer_profile_id IS NOT NULL;

ALTER TABLE observer_request ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_subject_read_own" ON observer_request
FOR SELECT USING (
  subject_profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

CREATE POLICY "jwt_observer_read_claimable" ON observer_request
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND (status = 'pending' OR observer_profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid()))
);

CREATE POLICY "jwt_admin_full" ON observer_request
FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "service_role_observer_request" ON observer_request
FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_observer_request_updated_at
  BEFORE UPDATE ON observer_request
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE observer_request IS
  'C4 Decision-layer. Manager/leader sign-off gate for evidence_tier >= quiz_plus_observer. See ADR-0103.';
