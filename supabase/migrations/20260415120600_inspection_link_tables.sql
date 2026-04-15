-- 20260415120600_inspection_link_tables.sql
-- Phase 0 Foundation — Task 8 (ADR-0105). Schema only; UI deferred to Phase 4.
SET search_path TO public, extensions;

CREATE TABLE inspection_link (
  inspection_link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  issued_by          UUID NOT NULL REFERENCES profile(profile_id),
  inspector_name     TEXT NOT NULL,
  inspector_org      TEXT NOT NULL,
  inspector_email    TEXT,
  scope              JSONB NOT NULL,
  valid_from         TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to           TIMESTAMPTZ NOT NULL,
  revoked_at         TIMESTAMPTZ,
  token_hash         TEXT NOT NULL UNIQUE,
  justification      TEXT NOT NULL,
  anonymization      TEXT NOT NULL DEFAULT 'anonymized'
                     CHECK (anonymization IN ('anonymized', 'names_visible')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE inspection_link_view (
  inspection_link_view_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_link_id      UUID NOT NULL REFERENCES inspection_link(inspection_link_id) ON DELETE CASCADE,
  viewed_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip                      INET,
  user_agent              TEXT,
  path                    TEXT NOT NULL,
  scope_check_result      TEXT NOT NULL
);

CREATE INDEX idx_inspection_link_workspace ON inspection_link (workspace_id, valid_to) WHERE revoked_at IS NULL;
CREATE INDEX idx_inspection_link_view_link ON inspection_link_view (inspection_link_id, viewed_at DESC);

ALTER TABLE inspection_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_link_view ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_admin_inspection_link" ON inspection_link
FOR ALL USING (is_admin_in_workspace(auth.uid(), workspace_id));

CREATE POLICY "service_role_inspection_link" ON inspection_link
FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "jwt_admin_inspection_link_view" ON inspection_link_view
FOR SELECT USING (
  inspection_link_id IN (
    SELECT il.inspection_link_id FROM inspection_link il
    WHERE is_admin_in_workspace(auth.uid(), il.workspace_id)
  )
);

CREATE POLICY "service_role_inspection_link_view" ON inspection_link_view
FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE inspection_link IS 'Public-link schema for Tilsyn inspectors. UI deferred to Phase 4. See ADR-0105.';
