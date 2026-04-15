-- 20260415120200_effective_dating_governance_content.sql
-- Phase 0 Foundation — Task 3 (ADR-0106)
SET search_path TO public, extensions;

-- Extend effective-dating pattern from `policy` to all governance content per ADR-0106.
ALTER TABLE protocol
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE;

ALTER TABLE procedure
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE;

ALTER TABLE knowledge_test
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE;

ALTER TABLE confirmation
  ADD COLUMN IF NOT EXISTS valid_from DATE,
  ADD COLUMN IF NOT EXISTS valid_to DATE;

-- Backfill: existing active rows get valid_from = created_at, valid_to = NULL
UPDATE protocol SET valid_from = COALESCE(valid_from, created_at::date) WHERE valid_from IS NULL;
UPDATE procedure SET valid_from = COALESCE(valid_from, created_at::date) WHERE valid_from IS NULL;
UPDATE knowledge_test SET valid_from = COALESCE(valid_from, created_at::date) WHERE valid_from IS NULL;
UPDATE confirmation SET valid_from = COALESCE(valid_from, created_at::date) WHERE valid_from IS NULL;

CREATE INDEX IF NOT EXISTS idx_protocol_valid_window ON protocol (valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_procedure_valid_window ON procedure (valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_knowledge_test_valid_window ON knowledge_test (valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_confirmation_valid_window ON confirmation (valid_from, valid_to);

COMMENT ON COLUMN protocol.valid_from IS 'Effective-date start. See ADR-0106.';
COMMENT ON COLUMN protocol.valid_to IS 'Effective-date end. NULL = currently active.';
