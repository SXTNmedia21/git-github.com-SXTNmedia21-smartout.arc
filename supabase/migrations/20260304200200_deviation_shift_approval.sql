-- ============================================
-- 20260304200200_deviation_shift_approval.sql
-- Deviation tracking (5 domains) and per-shift hour approval.
-- Source: MODULE_10 §4.2 and §5.4
-- ============================================

CREATE TYPE deviation_domain AS ENUM (
  'safety', 'customer', 'procedure', 'system', 'material'
);

CREATE TYPE deviation_severity AS ENUM (
  'low', 'medium', 'high', 'critical'
);

CREATE TYPE deviation_status AS ENUM (
  'open', 'acknowledged', 'resolved', 'escalated'
);

CREATE TYPE shift_approval_status AS ENUM (
  'pending', 'approved', 'edited', 'disputed'
);

-- ── deviation ──────────────────────────────────────────────
CREATE TABLE public.deviation (
  deviation_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id        UUID REFERENCES department(department_id),
  session_id           UUID REFERENCES department_session(department_session_id),
  reconciliation_id    UUID REFERENCES daily_reconciliation(reconciliation_id),

  -- Classification
  domain               deviation_domain NOT NULL,
  subcategory          TEXT,                      -- late_checkin, overtime, pest, glass_broken, etc.
  severity             deviation_severity NOT NULL DEFAULT 'low',

  -- Content
  title                TEXT NOT NULL,
  description          TEXT,
  cost_impact          NUMERIC(10,2),

  -- Links
  linked_shift_id      UUID REFERENCES schedule_shift(schedule_shift_id),

  -- Status
  status               deviation_status NOT NULL DEFAULT 'open',

  -- Resolution
  resolution_notes     TEXT,
  resolved_by          UUID REFERENCES profile(profile_id),
  resolved_at          TIMESTAMPTZ,

  -- Evidence
  attachments          JSONB,                     -- [{url, filename, type}]

  -- Policy impact (computed from severity + policy rules)
  blocks_day_approval  BOOLEAN NOT NULL DEFAULT false,
  requires_action      BOOLEAN NOT NULL DEFAULT false,
  payroll_impact       BOOLEAN NOT NULL DEFAULT false,

  -- Audit
  reported_by          UUID REFERENCES profile(profile_id),  -- null = system-generated
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE deviation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_deviation" ON deviation
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "jwt_manage_deviation" ON deviation
FOR ALL USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "api_key_read_deviation" ON deviation
FOR SELECT USING (
  workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);
CREATE POLICY "service_role_deviation" ON deviation
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_deviation_session ON deviation (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_deviation_recon ON deviation (reconciliation_id) WHERE reconciliation_id IS NOT NULL;
CREATE INDEX idx_deviation_status ON deviation (workspace_id, status)
  WHERE status IN ('open', 'acknowledged', 'escalated');

-- Add FK from settlement_validation to deviation
ALTER TABLE settlement_validation
  ADD CONSTRAINT fk_validation_deviation
  FOREIGN KEY (deviation_id) REFERENCES deviation(deviation_id);

-- ── shift_approval ─────────────────────────────────────────
CREATE TABLE public.shift_approval (
  approval_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id    UUID NOT NULL REFERENCES daily_reconciliation(reconciliation_id) ON DELETE CASCADE,
  shift_id             UUID NOT NULL REFERENCES schedule_shift(schedule_shift_id),
  workspace_id         UUID NOT NULL REFERENCES workspace(workspace_id),

  -- Time data
  punch_in             TIMESTAMPTZ,
  punch_out            TIMESTAMPTZ,
  planned_hours        NUMERIC(4,2) NOT NULL,
  calculated_hours     NUMERIC(4,2),
  approved_hours       NUMERIC(4,2),

  -- Status
  status               shift_approval_status NOT NULL DEFAULT 'pending',
  edit_justification   TEXT,
  handoff_requested    BOOLEAN NOT NULL DEFAULT false,
  handoff_completed    BOOLEAN NOT NULL DEFAULT false,

  -- System-detected deviations
  system_deviations    JSONB,                     -- [{type, details}]

  -- Admin approval
  approved_by          UUID REFERENCES profile(profile_id),
  approved_at          TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE shift_approval ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_shift_approval" ON shift_approval
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "jwt_manage_shift_approval" ON shift_approval
FOR ALL USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM profile
    WHERE user_id = auth.uid() AND workspace_id = shift_approval.workspace_id
    AND role IN ('admin', 'owner', 'manager')
  )
);
CREATE POLICY "service_role_shift_approval" ON shift_approval
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_shift_approval_recon ON shift_approval (reconciliation_id);

COMMENT ON TABLE deviation IS '5-domain deviation tracking: safety, customer, procedure, system, material.';
COMMENT ON TABLE shift_approval IS 'Per-shift hour verification within daily reconciliation.';
