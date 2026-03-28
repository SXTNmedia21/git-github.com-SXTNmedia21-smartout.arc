-- Auto-assign active protocols to new employee profiles.
-- When a profile is created (via invitation accept), scan all active protocols
-- in the same workspace and create protocol_assignment records.
-- Department-scoped policies only assign to matching department.

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
    status,
    assigned_at
  )
  SELECT
    p.protocol_id,
    NEW.profile_id,
    'pending',
    now()
  FROM protocol p
  JOIN policy pol ON p.policy_id = pol.policy_id
  WHERE p.workspace_id = NEW.workspace_id
    AND p.status = 'active'
    AND pol.is_active = true
    -- Scope filtering: workspace-wide policies apply to everyone,
    -- department-scoped policies only apply if employee is in that department
    AND (
      pol.policy_scope = 'workspace'
      OR (pol.policy_scope = 'department' AND pol.scope_ref_id = NEW.department_id)
      OR (pol.policy_scope = 'team' AND pol.scope_ref_id = ANY(
        SELECT team_id FROM team_member WHERE profile_id = NEW.profile_id
      ))
      OR (pol.policy_scope = 'location' AND pol.scope_ref_id = NEW.location_id)
    )
    -- Skip if already assigned (idempotency guard)
    AND NOT EXISTS (
      SELECT 1 FROM protocol_assignment pa
      WHERE pa.protocol_id = p.protocol_id
        AND pa.profile_id = NEW.profile_id
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_assign_protocols ON profile;
CREATE TRIGGER trg_auto_assign_protocols
  AFTER INSERT ON profile
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_protocols_to_new_employee();
