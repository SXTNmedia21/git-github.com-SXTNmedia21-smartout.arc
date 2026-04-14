SET search_path TO public, extensions;

-- ============================================
-- Training Schema Foundation (Module 6, Sub-project 0)
-- Council-approved 2026-04-14, plan-reviewed 2026-04-14
--
-- Depends on: _training_add_enum_values migration (must run first)
-- ============================================

-- ── 1. New enum: assignment source ──────────────────────────────
CREATE TYPE assignment_source AS ENUM (
  'workspace', 'department', 'team', 'location', 'position', 'manual', 'season'
);

-- ── 2. Add columns to protocol_assignment ───────────────────────
-- workspace_id (backfilled from profile)
ALTER TABLE protocol_assignment
  ADD COLUMN IF NOT EXISTS workspace_id UUID;

-- Assignment source tracking
ALTER TABLE protocol_assignment
  ADD COLUMN IF NOT EXISTS assigned_via assignment_source,
  ADD COLUMN IF NOT EXISTS assigned_ref_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES profile(profile_id);

-- Denormalized progress counts (maintained by trigger or app code)
ALTER TABLE protocol_assignment
  ADD COLUMN IF NOT EXISTS procedures_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS procedures_completed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tests_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tests_passed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmations_total INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmations_signed INTEGER NOT NULL DEFAULT 0;

-- Waiver fields
ALTER TABLE protocol_assignment
  ADD COLUMN IF NOT EXISTS waived_by UUID REFERENCES profile(profile_id),
  ADD COLUMN IF NOT EXISTS waived_reason TEXT;

-- Versioning
ALTER TABLE protocol_assignment
  ADD COLUMN IF NOT EXISTS protocol_version TEXT;

-- AI: spaced repetition
ALTER TABLE protocol_assignment
  ADD COLUMN IF NOT EXISTS next_review_at TIMESTAMPTZ;

-- ── 4. Backfill workspace_id from profile ───────────────────────
UPDATE protocol_assignment pa
SET workspace_id = p.workspace_id
FROM profile p
WHERE pa.profile_id = p.profile_id
  AND pa.workspace_id IS NULL;

-- Now make it NOT NULL with FK
ALTER TABLE protocol_assignment
  ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE protocol_assignment
  ADD CONSTRAINT fk_protocol_assignment_workspace
    FOREIGN KEY (workspace_id)
    REFERENCES workspace(workspace_id) ON DELETE CASCADE;

-- ── 5. Backfill assigned_via from existing trigger logic ────────
-- Existing assignments were auto-created → mark as policy-scope derived
-- We can't determine exact source retroactively, so mark as 'workspace' (safe default)
UPDATE protocol_assignment
SET assigned_via = 'workspace'
WHERE assigned_via IS NULL;

-- Backfill protocol_version from protocol.version
UPDATE protocol_assignment pa
SET protocol_version = pr.version
FROM protocol pr
WHERE pa.protocol_id = pr.protocol_id
  AND pa.protocol_version IS NULL;

-- ── 6. Map 'pending' → 'not_started' for existing data ─────────
-- Safe: enum values were added in the PREVIOUS migration file.
UPDATE protocol_assignment
SET status = 'not_started'
WHERE status = 'pending';

-- Update column default from 'pending' to 'not_started'
ALTER TABLE protocol_assignment
  ALTER COLUMN status SET DEFAULT 'not_started';

-- ── 7. Add indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_protocol_assignment_workspace
  ON protocol_assignment (workspace_id);
CREATE INDEX IF NOT EXISTS idx_protocol_assignment_workspace_status
  ON protocol_assignment (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_protocol_assignment_profile_status
  ON protocol_assignment (profile_id, status);
CREATE INDEX IF NOT EXISTS idx_protocol_assignment_next_review
  ON protocol_assignment (next_review_at)
  WHERE next_review_at IS NOT NULL;

-- ── 8. AI-readiness columns on knowledge_test_attempt ───────────
ALTER TABLE knowledge_test_attempt
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS graded_by TEXT;

COMMENT ON COLUMN knowledge_test_attempt.ai_confidence
  IS 'AI grading confidence 0.00-1.00. NULL = human/automated grading.';
COMMENT ON COLUMN knowledge_test_attempt.graded_by
  IS 'Who graded: "system" (automated), "ai" (LLM), or profile_id (human).';

-- ── 9. Rewrite RLS policies on protocol_assignment ──────────────
-- Old policies used JOIN through protocol for workspace scoping.
-- New policies use direct workspace_id column.

DROP POLICY IF EXISTS "Read protocol_assignment" ON protocol_assignment;
DROP POLICY IF EXISTS "Write protocol_assignment" ON protocol_assignment;

-- Employees can read their own assignments
CREATE POLICY "jwt_read_own_assignments" ON protocol_assignment
FOR SELECT USING (
  profile_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid())
);

-- Admins can read all assignments in their workspace
CREATE POLICY "jwt_admin_read_assignments" ON protocol_assignment
FOR SELECT USING (
  is_admin_in_workspace(auth.uid(), workspace_id)
);

-- Admins can write assignments in their workspace
CREATE POLICY "jwt_admin_write_assignments" ON protocol_assignment
FOR ALL USING (
  is_admin_in_workspace(auth.uid(), workspace_id)
);

-- Service role: full access
CREATE POLICY "service_role_protocol_assignment" ON protocol_assignment
FOR ALL USING (auth.role() = 'service_role');

-- ── 10. Update auto-assign trigger ──────────────────────────────
CREATE OR REPLACE FUNCTION auto_assign_protocols_to_new_employee()
RETURNS TRIGGER AS $$
BEGIN
  -- Only assign to trainee or active profiles
  -- Column is 'status' (type profile_status), NOT 'profile_status'
  IF NEW.status NOT IN ('trainee', 'active') THEN
    RETURN NEW;
  END IF;

  INSERT INTO protocol_assignment (
    protocol_id,
    profile_id,
    workspace_id,
    status,
    assigned_at,
    assigned_via,
    assigned_ref_id,
    protocol_version
  )
  SELECT
    p.protocol_id,
    NEW.profile_id,
    NEW.workspace_id,
    'not_started',
    now(),
    CASE pol.policy_scope
      WHEN 'workspace' THEN 'workspace'::assignment_source
      WHEN 'department' THEN 'department'::assignment_source
      WHEN 'team' THEN 'team'::assignment_source
      WHEN 'location' THEN 'location'::assignment_source
    END,
    pol.scope_ref_id,
    p.version
  FROM protocol p
  JOIN policy pol ON p.policy_id = pol.policy_id
  WHERE p.workspace_id = NEW.workspace_id
    AND p.status = 'active'
    AND pol.is_active = true
    AND (
      pol.policy_scope = 'workspace'
      OR (pol.policy_scope = 'department' AND pol.scope_ref_id = NEW.department_id)
      OR (pol.policy_scope = 'team' AND pol.scope_ref_id = ANY(
        SELECT team_id FROM team_member WHERE profile_id = NEW.profile_id
      ))
      OR (pol.policy_scope = 'location' AND pol.scope_ref_id = NEW.location_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM protocol_assignment pa
      WHERE pa.protocol_id = p.protocol_id
        AND pa.profile_id = NEW.profile_id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 11. Update get_workspace_readiness RPC ──────────────────────
-- Now uses direct workspace_id instead of JOIN through profile
CREATE OR REPLACE FUNCTION public.get_workspace_readiness(p_workspace_id uuid)
RETURNS TABLE(profile_id uuid, total bigint, completed bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    pa.profile_id,
    COUNT(pa.assignment_id) AS total,
    COUNT(pa.assignment_id) FILTER (WHERE pa.status = 'completed') AS completed
  FROM public.protocol_assignment pa
  WHERE pa.workspace_id = p_workspace_id
  GROUP BY pa.profile_id;
$$;

-- ── 12. Add comments ────────────────────────────────────────────
COMMENT ON COLUMN protocol_assignment.workspace_id
  IS 'Direct workspace scoping. Backfilled from profile.workspace_id.';
COMMENT ON COLUMN protocol_assignment.assigned_via
  IS 'How the protocol was assigned: workspace/department/team/location/position/manual/season.';
COMMENT ON COLUMN protocol_assignment.next_review_at
  IS 'Spaced repetition: when this assignment should be re-reviewed. NULL = no review scheduled.';
