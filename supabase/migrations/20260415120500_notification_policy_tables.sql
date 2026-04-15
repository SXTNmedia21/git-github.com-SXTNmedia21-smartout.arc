-- 20260415120500_notification_policy_tables.sql
-- Phase 0 Foundation — Task 7 (ADR-0104)
SET search_path TO public, extensions;

CREATE TABLE notification_policy (
  notification_policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id           UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  domain                 TEXT NOT NULL,
  risk_level             TEXT,
  tier_ladder            JSONB NOT NULL,
  quiet_hours            JSONB,
  rate_limit_per_day     INTEGER NOT NULL DEFAULT 3,
  locale_overrides       JSONB,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_notification_policy_workspace_domain UNIQUE (workspace_id, domain)
);

CREATE TABLE notification_sent_log (
  notification_sent_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  notification_policy_id   UUID REFERENCES notification_policy(notification_policy_id),
  subject_profile_id       UUID NOT NULL REFERENCES profile(profile_id),
  related_entity_type      TEXT NOT NULL,
  related_entity_id        UUID NOT NULL,
  tier                     TEXT NOT NULL,
  sent_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  channel                  TEXT NOT NULL,
  opened_at                TIMESTAMPTZ,
  converted_at             TIMESTAMPTZ
);

CREATE INDEX idx_notification_sent_log_subject_date
  ON notification_sent_log (subject_profile_id, sent_at DESC);
CREATE INDEX idx_notification_sent_log_related_entity
  ON notification_sent_log (related_entity_type, related_entity_id);
-- Note: rate-limit partial index uses full table scan window without an
-- IMMUTABLE predicate. now() is not allowed; use a static recency index.
CREATE INDEX idx_notification_sent_log_rate_limit
  ON notification_sent_log (subject_profile_id, sent_at DESC);

ALTER TABLE notification_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_sent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_admin_notification_policy" ON notification_policy
FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "service_role_notification_policy" ON notification_policy
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "jwt_read_own_sent_log" ON notification_sent_log
FOR SELECT USING (
  subject_profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
  OR is_admin_in_workspace(auth.uid(), workspace_id)
);

CREATE POLICY "service_role_sent_log" ON notification_sent_log
FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER set_notification_policy_updated_at
  BEFORE UPDATE ON notification_policy
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMENT ON TABLE notification_policy IS 'Domain-scoped notification escalation ladders. See ADR-0104.';
COMMENT ON TABLE notification_sent_log IS 'Append-only log of notifications sent. Powers rate-limiting and effectiveness reporting.';
