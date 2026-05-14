-- ════════════════════════════════════════════════════════════════════════════
-- 20260616100000_api_key_read_overtime_cap_policy.sql
-- ----------------------------------------------------------------------------
-- F-DB-13 (MEDIUM): overtime_cap_policy was missing the api_key_read_* policy.
-- ADR-0029 dual-auth pattern requires both a JWT policy path AND an API-key
-- path on every workspace-scoped table that external integrations may read.
--
-- overtime_cap_policy is workspace-scoped (workspace_id NOT NULL) and was
-- created in 20260603000000_overtime_cap_policy.sql with 4 JWT-path policies
-- but 0 API-key path policies.  This migration adds the missing SELECT policy.
--
-- Template: staff_event + schedule_shift_lock_policy (same helper, same shape).
-- ════════════════════════════════════════════════════════════════════════════

SET search_path TO public, extensions;

DROP POLICY IF EXISTS "api_key_read_overtime_cap_policy" ON public.overtime_cap_policy;
CREATE POLICY "api_key_read_overtime_cap_policy"
  ON public.overtime_cap_policy
  FOR SELECT
  USING (workspace_id = public.get_api_workspace_id());
