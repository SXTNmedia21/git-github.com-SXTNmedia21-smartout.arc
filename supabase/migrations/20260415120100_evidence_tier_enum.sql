-- 20260415120100_evidence_tier_enum.sql
-- Phase 0 Foundation — Task 2 (ADR-0102)
SET search_path TO public, extensions;

CREATE TYPE evidence_tier AS ENUM (
  'quiz',
  'quiz_plus_observer',
  'quiz_plus_observer_plus_confirmation',
  'four_eyes'
);

COMMENT ON TYPE evidence_tier IS
  'Proof tier required for protocol completion. See ADR-0102. Orthogonal to rule_severity and deviation_severity.';

ALTER TABLE protocol
  ADD COLUMN IF NOT EXISTS evidence_tier evidence_tier NOT NULL DEFAULT 'quiz';

COMMENT ON COLUMN protocol.evidence_tier IS
  'Evidence required to complete this protocol. K1a default; K1b may strengthen but not weaken.';

CREATE INDEX IF NOT EXISTS idx_protocol_evidence_tier ON protocol (evidence_tier);
