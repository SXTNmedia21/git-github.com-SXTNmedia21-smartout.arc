-- ============================================
-- 20260304200100_daily_reconciliation.sql
-- Daily reconciliation, settlement images, and settlement validation.
-- Source: MODULE_10 §5.1-5.3
-- ============================================

CREATE TYPE reconciliation_status AS ENUM (
  'open',                -- day started, accumulating data
  'submitted',           -- closing employee submitted settlement
  'awaiting_approval',   -- OCR done, ready for admin
  'approved',            -- admin approved — DAY CLOSED
  'locked',              -- immutable after policy period
  'unreconciled'         -- timed out without approval
);

CREATE TYPE revenue_source AS ENUM ('ocr', 'manual');

CREATE TYPE settlement_source_type AS ENUM (
  'pos', 'terminal', 'z_report', 'cash_count', 'other'
);

-- ── daily_reconciliation ───────────────────────────────────
CREATE TABLE public.daily_reconciliation (
  reconciliation_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID NOT NULL REFERENCES workspace(workspace_id) ON DELETE CASCADE,
  department_id      UUID NOT NULL REFERENCES department(department_id),
  session_id         UUID REFERENCES department_session(department_session_id),
  reconciliation_date DATE NOT NULL,

  -- Status lifecycle
  status             reconciliation_status NOT NULL DEFAULT 'open',

  -- Phase 1: Settlement (by closing employee)
  settled_by         UUID REFERENCES profile(profile_id),
  settled_at         TIMESTAMPTZ,

  -- Phase 2: Approval (by admin)
  approved_by        UUID REFERENCES profile(profile_id),
  approved_at        TIMESTAMPTZ,
  approval_notes     TEXT,

  -- Revenue (from OCR or manual entry)
  revenue_total      NUMERIC(12,2),
  revenue_card       NUMERIC(12,2),
  revenue_cash       NUMERIC(12,2),
  revenue_vat        NUMERIC(12,2),
  revenue_transactions INTEGER,
  revenue_source     revenue_source,

  -- Labor (aggregated from shift approvals)
  total_planned_hours  NUMERIC(6,2),
  total_actual_hours   NUMERIC(6,2),
  total_labor_cost     NUMERIC(10,2),

  -- KPIs (calculated on approval)
  revenue_per_worked_hour NUMERIC(10,2),
  labor_percentage        NUMERIC(5,2),

  -- Locking
  locked_at          TIMESTAMPTZ,
  locked_by          UUID REFERENCES profile(profile_id),

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_recon_date UNIQUE (workspace_id, department_id, reconciliation_date)
);

ALTER TABLE daily_reconciliation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_daily_reconciliation" ON daily_reconciliation
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "jwt_manage_daily_reconciliation" ON daily_reconciliation
FOR ALL USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND EXISTS (
    SELECT 1 FROM profile
    WHERE user_id = auth.uid() AND workspace_id = daily_reconciliation.workspace_id
    AND role IN ('admin', 'owner', 'manager')
  )
);
CREATE POLICY "api_key_read_daily_reconciliation" ON daily_reconciliation
FOR SELECT USING (
  workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
);
CREATE POLICY "service_role_daily_reconciliation" ON daily_reconciliation
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_recon_status ON daily_reconciliation (workspace_id, status)
  WHERE status NOT IN ('locked');
CREATE INDEX idx_recon_date ON daily_reconciliation (workspace_id, reconciliation_date DESC);

-- ── settlement_image ───────────────────────────────────────
CREATE TABLE public.settlement_image (
  image_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id   UUID NOT NULL REFERENCES daily_reconciliation(reconciliation_id) ON DELETE CASCADE,
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id),

  source_type         settlement_source_type NOT NULL,
  storage_path        TEXT NOT NULL,             -- Supabase Storage path

  -- OCR results
  ocr_raw_text        TEXT,
  ocr_parsed          JSONB,                     -- structured extraction
  ocr_confidence      REAL,                      -- 0.0–1.0
  ocr_processed_at    TIMESTAMPTZ,

  uploaded_by         UUID NOT NULL REFERENCES profile(profile_id),
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE settlement_image ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_settlement_image" ON settlement_image
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "jwt_manage_settlement_image" ON settlement_image
FOR ALL USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "service_role_settlement_image" ON settlement_image
FOR ALL USING (auth.role() = 'service_role');

CREATE INDEX idx_settlement_image_recon ON settlement_image (reconciliation_id);

-- ── settlement_validation ──────────────────────────────────
CREATE TABLE public.settlement_validation (
  validation_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id   UUID NOT NULL REFERENCES daily_reconciliation(reconciliation_id) ON DELETE CASCADE,
  workspace_id        UUID NOT NULL REFERENCES workspace(workspace_id),

  pos_total           NUMERIC(12,2) NOT NULL,
  terminal_total      NUMERIC(12,2) NOT NULL,
  difference          NUMERIC(12,2) NOT NULL,
  difference_percent  REAL NOT NULL,
  within_threshold    BOOLEAN NOT NULL,
  deviation_id        UUID,                      -- FK added after deviation table

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE settlement_validation ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jwt_read_settlement_validation" ON settlement_validation
FOR SELECT USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
);
CREATE POLICY "service_role_settlement_validation" ON settlement_validation
FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE daily_reconciliation IS 'Admin approval of business day. Two-phase: settlement → approval.';
COMMENT ON TABLE settlement_image IS 'OCR source images for daily settlement.';
COMMENT ON TABLE settlement_validation IS 'Cross-check: POS total vs terminal total.';
