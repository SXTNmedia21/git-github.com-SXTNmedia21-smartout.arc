-- Phase 0.5 reconciliation: restore rich trigger semantics for
-- auto_assign_protocols_to_new_employee. Migration 20260428100000 silently
-- clobbered the rich trigger from 20260414014856 via CREATE OR REPLACE
-- without diff review. The clobbered version INSERTs without workspace_id,
-- assigned_via, assigned_ref_id, or protocol_version. Since
-- protocol_assignment.workspace_id is NOT NULL, every new employee profile
-- insertion currently fails in production. This migration restores the
-- full column set from the original foundation migration.

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill any protocol_assignment rows with NULL workspace_id from profile.
UPDATE protocol_assignment pa
SET workspace_id = p.workspace_id
FROM profile p
WHERE pa.profile_id = p.profile_id
  AND pa.workspace_id IS NULL;

-- Sanity check: no NULL workspace_id rows remain before tightening any
-- downstream constraints. Abort migration if the backfill left gaps.
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
