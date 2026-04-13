-- ============================================
-- 20260414230000_ops_intelligence_foundations.sql
-- Foundation migrations for AI Operations Intelligence (ADR-0088).
-- 1. Extend policy_type enum with 'ai_operations'
-- 2. Extend engine_memory memory_type CHECK with 'learned_pattern', 'prediction'
-- 3. Seed engine_authority_config for operations_intelligence capability
-- 4. Seed default ai_operations policy per workspace
-- ============================================

SET search_path TO public, extensions;

-- 1. Add 'ai_operations' to policy_type enum
ALTER TYPE policy_type ADD VALUE IF NOT EXISTS 'ai_operations';

-- 2. Expand engine_memory memory_type CHECK constraint
ALTER TABLE engine_memory DROP CONSTRAINT IF EXISTS engine_memory_memory_type_check;
ALTER TABLE engine_memory ADD CONSTRAINT engine_memory_memory_type_check
  CHECK (memory_type IN ('preference', 'fact', 'summary', 'general', 'constant', 'learned_pattern', 'prediction'));

-- 3. Seed default engine_authority_config for operations_intelligence
-- One row per workspace that has an active season.
-- Default level: 'suggest' (conservative — workspace admin can elevate).
INSERT INTO engine_authority_config (workspace_id, capability, level, min_role, created_at, updated_at)
SELECT
  w.workspace_id,
  'operations_intelligence',
  'suggest',
  'manager',
  now(),
  now()
FROM workspace w
WHERE w.is_active = true
ON CONFLICT (workspace_id, capability) DO NOTHING;

-- 4. Seed default ai_operations policy per active workspace
INSERT INTO policy (workspace_id, name, description, policy_type, scope, is_active, rules_json, created_at, updated_at)
SELECT
  w.workspace_id,
  'AI Operations Configuration',
  'Default AI operations intelligence thresholds and toggles',
  'ai_operations',
  'workspace',
  true,
  '{
    "late_punchin_threshold_minutes": 10,
    "noshow_threshold_minutes": 30,
    "task_overdue_grace_minutes": 15,
    "day_brief_offset_minutes": 30,
    "shift_brief_enabled": true,
    "mid_session_digest_enabled": false,
    "triage_enabled": true,
    "alert_tier_critical_channels": ["push", "sms"],
    "alert_tier_active_channels": ["push"],
    "alert_tier_ambient_channels": ["in_app"]
  }'::jsonb,
  now(),
  now()
FROM workspace w
WHERE w.is_active = true
ON CONFLICT DO NOTHING;
