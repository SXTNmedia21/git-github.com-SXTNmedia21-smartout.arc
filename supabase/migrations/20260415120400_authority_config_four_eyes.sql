-- 20260415120400_authority_config_four_eyes.sql
-- Phase 0 Foundation — Task 5 (ADR-0101 + ADR-0103)
SET search_path TO public, extensions;

ALTER TABLE engine_authority_config
  ADD COLUMN IF NOT EXISTS requires_four_eyes BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS observer_escalation_hours INTEGER NOT NULL DEFAULT 72;

COMMENT ON COLUMN engine_authority_config.requires_four_eyes IS
  'Per ADR-0101. When true, action requires 2 approvers and gate_action returns four_eyes_required=true.';
COMMENT ON COLUMN engine_authority_config.observer_escalation_hours IS
  'Hours before pending observer_request escalates to admin queue (ADR-0103).';
