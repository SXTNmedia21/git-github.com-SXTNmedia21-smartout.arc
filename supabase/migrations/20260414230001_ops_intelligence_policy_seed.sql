-- Seed default ai_operations policy per active workspace.
-- Split from 20260414230000 because PostgreSQL cannot use a newly added
-- enum value in the same transaction (ERROR 55P04: unsafe use of new value).

INSERT INTO policy (
  workspace_id, name, description, policy_type, policy_scope,
  statement, enforcement_status, rules_json, is_active, created_by,
  created_at, updated_at
)
SELECT
  w.workspace_id,
  'AI Operations Configuration',
  'Default AI operations intelligence thresholds and toggles',
  'ai_operations',
  'workspace'::policy_scope,
  'Defines AI operations intelligence thresholds and channel routing toggles for this workspace.',
  'aspirational'::enforcement_status,
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
  true,
  (SELECT p.profile_id FROM profile p WHERE p.workspace_id = w.workspace_id AND p.role = 'owner' LIMIT 1),
  now(),
  now()
FROM workspace w
WHERE w.is_active = true
  AND EXISTS (SELECT 1 FROM profile p WHERE p.workspace_id = w.workspace_id AND p.role = 'owner')
  AND NOT EXISTS (
    SELECT 1 FROM policy pol
    WHERE pol.workspace_id = w.workspace_id AND pol.policy_type = 'ai_operations'
  );
