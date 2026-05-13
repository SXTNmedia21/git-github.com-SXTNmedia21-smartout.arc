-- ─────────────────────────────────────────────────────────────────────────────
-- Sortie A — D6 RLS Audit Verdict: schedule_shift already compliant
--
-- This migration contains NO DDL changes.  It exists to record the result of
-- the Sortie A pre-flight audit (2026-05-13) so that the audit verdict is
-- permanently visible in migration history and cannot be silently reversed.
--
-- Audit result: schedule_shift UPDATE policies carry symmetric USING + WITH CHECK.
-- No migration was needed.  pgTAP regression tests (Phase 3) lock this invariant.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── jwt_update_schedule_shift ────────────────────────────────────────────────
-- Origin: 20260301300000_schedule_shift_table.sql:98-102
-- Shape:  FOR UPDATE
--         USING      ( is_admin_in_workspace(auth.uid(), workspace_id) )
--         WITH CHECK ( is_admin_in_workspace(auth.uid(), workspace_id) )
-- Verdict: COMPLIANT — symmetric USING + WITH CHECK present.
-- Scope: admin/owner branch.  Prevents workspace_id flip and cross-workspace UPDATE.
COMMENT ON POLICY "jwt_update_schedule_shift" ON public.schedule_shift IS
  'Sortie A audit 2026-05-13: COMPLIANT. Symmetric USING + WITH CHECK. '
  'Admin/owner branch only. is_admin_in_workspace scopes to role IN (admin, owner) '
  'with is_active=true.  See 20260605121000 for audit verdict.';

-- ── jwt_employee_confirm_own_shift ───────────────────────────────────────────
-- Origin: 20260418100300_mobile_schema_additions.sql:15-28
-- Shape:  FOR UPDATE
--         USING      ( employee_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid()) )
--         WITH CHECK ( employee_id IN (SELECT profile_id FROM profile WHERE user_id = auth.uid()) )
-- Verdict: COMPLIANT — symmetric USING + WITH CHECK present.
-- Scope: employee self-confirm branch.  Blocks employee_id flip to colleague and
--        workspace_id flip to foreign workspace (employee_id is payload-sourced,
--        but WITH CHECK forces the row's employee_id to still map to the caller).
-- WARNING: Do NOT drop this policy thinking it is redundant with jwt_update_schedule_shift.
--   The two policies stack as PERMISSIVE-OR: an employee who is not admin can update
--   their own shift via this policy.  Dropping it would silently remove employee-confirm.
--   See Sortie A spec §4.2 + risk R4.
COMMENT ON POLICY "jwt_employee_confirm_own_shift" ON public.schedule_shift IS
  'Sortie A audit 2026-05-13: COMPLIANT. Symmetric USING + WITH CHECK. '
  'Employee self-confirm branch. Stacks PERMISSIVE-OR with jwt_update_schedule_shift. '
  'Do NOT drop — see 20260605121000 and spec §4.2 risk R4.';
