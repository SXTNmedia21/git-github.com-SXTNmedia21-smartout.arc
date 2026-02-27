-- Activity Trail improvements:
-- 1. Partial index for recent data (most queries hit last 90 days)
-- 2. Harden INSERT policy to service_role only (was WITH CHECK(TRUE) for all roles)

-- Partial index: speeds up the most common queries (recent activity)
CREATE INDEX IF NOT EXISTS idx_activity_recent
  ON activity_trail (workspace_id, entity_type, entity_id, created_at DESC)
  WHERE created_at >= NOW() - INTERVAL '90 days';

-- Drop the permissive INSERT policy and replace with service_role-only
DROP POLICY IF EXISTS "System can insert activity" ON activity_trail;

CREATE POLICY "Service role can insert activity" ON activity_trail
  FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- Still no UPDATE or DELETE policies. The trail remains immutable.
