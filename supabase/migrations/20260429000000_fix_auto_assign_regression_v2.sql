-- TASK 1B — Re-apply auto_assign rich trigger with timestamp AFTER the regression.
--
-- Context:
--   PR #177 (sma-1) added 20260415120000_fix_auto_assign_regression.sql to
--   restore the rich auto_assign_protocols_to_new_employee trigger that was
--   clobbered by 20260428100000_auto_assign_protocols.sql. However, the fix
--   timestamp (20260415120000) is lexicographically EARLIER than the
--   regression (20260428100000). Postgres applies migrations in timestamp
--   order, so after a clean `supabase db reset` the regression runs LAST
--   and re-clobbers the rich trigger back to the broken simple version.
--
--   sma-1 verified the v1 fix using `docker exec` to hot-apply the SQL
--   against a running container, which bypassed migration ordering and
--   masked the bug. sma-2 (PR #183) surfaced it when `db reset` finally
--   produced the real end state: inserts into profile fail with
--   `null value in column workspace_id of relation protocol_assignment
--   violates not-null constraint`.
--
-- Fix:
--   Re-apply the same function body from 20260415120000 here. The v1
--   migration is preserved (immutable history) but is effectively a no-op
--   after 20260428100000 runs. This v2 migration runs AFTER the regression
--   and is the one that actually takes effect at runtime.

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION auto_assign_protocols_to_new_employee()
RETURNS TRIGGER AS $$
BEGIN
  -- Only assign to trainee or active profiles
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
    'not_started'::protocol_assignment_status,
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Backfill any protocol_assignment rows with NULL workspace_id from profile
-- (defensive; v1 already ran this but later migrations may have inserted).
UPDATE protocol_assignment pa
SET workspace_id = p.workspace_id
FROM profile p
WHERE pa.profile_id = p.profile_id
  AND pa.workspace_id IS NULL;

DO $$
DECLARE
  null_count INT;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM protocol_assignment
  WHERE workspace_id IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION 'Reconciliation failed: % rows still have NULL workspace_id', null_count;
  END IF;
END $$;
