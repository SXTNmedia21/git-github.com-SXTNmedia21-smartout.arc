-- ─────────────────────────────────────────────────────────────────────────────
-- Sortie A.2 — D6 RLS WITH CHECK sister-table sweep (ADR-0299 closure)
-- Audit refs: F-DB-09 (CRITICAL) + F-DB-10 (HIGH) — 2026-05-13-adr-contract-validation
-- Mirror of: 20260605120000_shift_approval_rls_with_check.sql (Sortie A)
--           20260604120000_session_task_rls_with_check.sql      (Sortie 1)
--
-- Pre-Sortie-A.2 state — same gap class as pre-ADR-0299 shift_approval:
--   public.department_session — jwt_manage_department_session FOR ALL USING(...) — no WITH CHECK
--   public.session_hook       — jwt_manage_session_hook       FOR ALL USING(...) — no WITH CHECK
--   public.deviation          — jwt_manage_deviation          FOR ALL USING(...) — no WITH CHECK + no role gate
--   public.personal_task      — jwt_own_personal_task         FOR ALL USING(...) — no WITH CHECK
--
-- A JWT caller belonging to two workspaces can flip workspace_id on INSERT/UPDATE
-- to a colleague workspace they also belong to.  deviation is even broader — any
-- workspace member can mutate any deviation row (no role gate at all).
--
-- Fix:
--   1. Drop FOR ALL policies; create per-verb policies with symmetric USING + WITH CHECK
--      so workspace_id flips are rejected with 42501 at WITH CHECK evaluation.
--   2. Add manager+ role gate to deviation INSERT/UPDATE/DELETE (admin/owner/manager).
--      SELECT remains any-workspace-member for read transparency (day-control view).
--   3. personal_task: preserve owner-only model + add WITH CHECK pinning profile_id
--      AND workspace_id to caller's active profile.  fn_list_my_tasks RPC is
--      SECURITY DEFINER (ADR-0298 Sortie 3) so RLS bypass on read is preserved.
--   4. service_role_* and api_key_read_* policies are LEFT UNTOUCHED on all 4 tables.
--      Stage-engine writes via ctx.supabaseAdmin (service_role) continue to bypass JWT
--      policies — gated upstream by gate_action (ADR-0287).
--
-- Acceptance criteria (PLAN-sortie-a2-d6-rls-with-check.md):
--   S1 No FOR ALL policy remains on 4 target tables
--   S2 Per-verb policies (SELECT/INSERT/UPDATE/DELETE) with WITH CHECK matching USING
--   S3 deviation role gate: only manager+ INSERT/UPDATE/DELETE; any member SELECT
--   S4 Forge attempt rejected with 42501 on all 4 tables (pgTAP throws_ok)
--   S5 Happy-path UPDATE/INSERT succeeds for own workspace (pgTAP lives_ok)
--   S6 Migration idempotent (DROP IF EXISTS + CREATE)
--   S7 fn_list_my_tasks + task capability + helpdesk_query_lifecycle still functional
--
-- Writer enumeration (council T4 verdict — 2026-05-13):
--   - department_session: opened/closed via dashboard server actions (service_role) +
--     admin direct JWT via /dashboard/operations (admin role satisfies new role gate)
--   - session_hook: configured via /dashboard authoring surfaces (admin only)
--   - deviation INSERT: /dashboard/operations DeviationDialog (admin/manager surface) +
--     hms _hooks/use-create-deviation Server Action (service_role bypass) +
--     payroll run-deviation-checks (service_role bypass, writes payroll.deviation
--     in a different schema — unaffected)
--   - deviation UPDATE: /dashboard EntityDrawer DeviationDetailTab + EventDetailPanel
--     (both manager+ surfaces — role gate aligned with app surface)
--   - personal_task INSERT/UPDATE: task + personal capability tools via ctx.supabaseAdmin
--     (service_role bypass) — gate_action upstream gates by capability authority
--
-- No employee-tier JWT path writes deviation in production today.  Role gate is safe.
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- TABLE 1 — public.department_session
-- Pre-state: jwt_manage_department_session FOR ALL — admin/owner only, no WITH CHECK
-- Post-state: per-verb INSERT/UPDATE/DELETE, admin/owner only, symmetric USING+WITH CHECK
-- jwt_read_department_session, api_key_read_department_session, service_role_department_session
-- are LEFT UNTOUCHED.
-- =============================================================================

DROP POLICY IF EXISTS "jwt_manage_department_session" ON public.department_session;
DROP POLICY IF EXISTS "jwt_insert_department_session" ON public.department_session;
DROP POLICY IF EXISTS "jwt_update_department_session" ON public.department_session;
DROP POLICY IF EXISTS "jwt_delete_department_session" ON public.department_session;

CREATE POLICY "jwt_insert_department_session" ON public.department_session
  FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = department_session.workspace_id
        AND p.role IN ('admin', 'owner')
        AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_insert_department_session" ON public.department_session IS
  'Sortie A.2 defense (2026-05-13, ADR-0299, audit F-DB-09): replaces '
  'jwt_manage_department_session FOR ALL.  WITH CHECK pins workspace_id to caller '
  'workspace + admin/owner role.  Mirror of jwt_insert_shift_approval pattern from '
  '20260605120000_shift_approval_rls_with_check.sql.';

CREATE POLICY "jwt_update_department_session" ON public.department_session
  FOR UPDATE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = department_session.workspace_id
        AND p.role IN ('admin', 'owner')
        AND p.is_active = true
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = department_session.workspace_id
        AND p.role IN ('admin', 'owner')
        AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_update_department_session" ON public.department_session IS
  'Sortie A.2 defense (2026-05-13, ADR-0299, audit F-DB-09): symmetric USING + WITH CHECK '
  'blocks workspace_id flipping via JWT caller.  Admin/owner only.  Mirror of '
  'jwt_update_shift_approval pattern from 20260605120000_shift_approval_rls_with_check.sql.';

CREATE POLICY "jwt_delete_department_session" ON public.department_session
  FOR DELETE
  USING (
    public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

COMMENT ON POLICY "jwt_delete_department_session" ON public.department_session IS
  'Sortie A.2 defense (2026-05-13, ADR-0299, audit F-DB-09): admin/owner only via '
  'is_admin_in_workspace().  DELETE is tighter than INSERT/UPDATE — no manager equivalent '
  'in pre-Sortie state (already admin/owner-only).';

-- =============================================================================
-- TABLE 2 — public.session_hook
-- Pre-state: jwt_manage_session_hook FOR ALL — admin/owner only, no WITH CHECK
-- Post-state: per-verb INSERT/UPDATE/DELETE, admin/owner only, symmetric USING+WITH CHECK
-- jwt_read_session_hook, service_role_session_hook are LEFT UNTOUCHED.
-- (Note: no api_key_read_session_hook today — separate finding F-DB-02, out of scope.)
-- =============================================================================

DROP POLICY IF EXISTS "jwt_manage_session_hook" ON public.session_hook;
DROP POLICY IF EXISTS "jwt_insert_session_hook" ON public.session_hook;
DROP POLICY IF EXISTS "jwt_update_session_hook" ON public.session_hook;
DROP POLICY IF EXISTS "jwt_delete_session_hook" ON public.session_hook;

CREATE POLICY "jwt_insert_session_hook" ON public.session_hook
  FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = session_hook.workspace_id
        AND p.role IN ('admin', 'owner')
        AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_insert_session_hook" ON public.session_hook IS
  'Sortie A.2 defense (2026-05-13, ADR-0299, audit F-DB-09): replaces '
  'jwt_manage_session_hook FOR ALL.  WITH CHECK pins workspace_id + admin/owner role.';

CREATE POLICY "jwt_update_session_hook" ON public.session_hook
  FOR UPDATE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = session_hook.workspace_id
        AND p.role IN ('admin', 'owner')
        AND p.is_active = true
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = session_hook.workspace_id
        AND p.role IN ('admin', 'owner')
        AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_update_session_hook" ON public.session_hook IS
  'Sortie A.2 defense (2026-05-13, ADR-0299, audit F-DB-09): symmetric USING + WITH CHECK '
  'blocks workspace_id flipping.  Admin/owner only.';

CREATE POLICY "jwt_delete_session_hook" ON public.session_hook
  FOR DELETE
  USING (
    public.is_admin_in_workspace(auth.uid(), workspace_id)
  );

COMMENT ON POLICY "jwt_delete_session_hook" ON public.session_hook IS
  'Sortie A.2 defense (2026-05-13, ADR-0299, audit F-DB-09): admin/owner only.';

-- =============================================================================
-- TABLE 3 — public.deviation
-- Pre-state: jwt_manage_deviation FOR ALL — ANY workspace member, no WITH CHECK, no role gate
-- Post-state: per-verb INSERT/UPDATE/DELETE, manager+ role gate (admin/owner/manager),
--             symmetric USING+WITH CHECK.  SELECT remains any-member (read transparency).
-- jwt_read_deviation, api_key_read_deviation, service_role_deviation are LEFT UNTOUCHED.
--
-- Role gate rationale (council T4 verdict):
--   - /dashboard/operations DeviationDialog mounted on admin/manager surface only
--   - EntityDrawer DeviationDetailTab + EventDetailPanel mounted on day-control (admin/manager)
--   - HMS use-create-deviation routes via Server Action (service_role bypass — preserved)
--   - payroll deviation lives in payroll.deviation schema (unaffected)
--   - No employee-tier JWT writes today.  Role gate = admin/owner/manager.
-- =============================================================================

DROP POLICY IF EXISTS "jwt_manage_deviation" ON public.deviation;
DROP POLICY IF EXISTS "jwt_insert_deviation" ON public.deviation;
DROP POLICY IF EXISTS "jwt_update_deviation" ON public.deviation;
DROP POLICY IF EXISTS "jwt_delete_deviation" ON public.deviation;

CREATE POLICY "jwt_insert_deviation" ON public.deviation
  FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = deviation.workspace_id
        AND p.role IN ('admin', 'owner', 'manager')
        AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_insert_deviation" ON public.deviation IS
  'Sortie A.2 defense (2026-05-13, ADR-0299, audit F-DB-09): replaces jwt_manage_deviation '
  'FOR ALL (which had NO role gate).  Adds manager+ role requirement on INSERT via WITH CHECK. '
  'Mirror of jwt_insert_shift_approval pattern.';

CREATE POLICY "jwt_update_deviation" ON public.deviation
  FOR UPDATE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = deviation.workspace_id
        AND p.role IN ('admin', 'owner', 'manager')
        AND p.is_active = true
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = deviation.workspace_id
        AND p.role IN ('admin', 'owner', 'manager')
        AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_update_deviation" ON public.deviation IS
  'Sortie A.2 defense (2026-05-13, ADR-0299, audit F-DB-09): symmetric USING + WITH CHECK '
  'blocks workspace_id flipping.  Manager+ role gate added — employee-tier rejected with 42501.';

CREATE POLICY "jwt_delete_deviation" ON public.deviation
  FOR DELETE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = deviation.workspace_id
        AND p.role IN ('admin', 'owner', 'manager')
        AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_delete_deviation" ON public.deviation IS
  'Sortie A.2 defense (2026-05-13, ADR-0299, audit F-DB-09): manager+ role gate on DELETE. '
  'Symmetric with INSERT/UPDATE — no admin-only escalation since deviation suppression by '
  'managers is part of established day-control workflow.';

-- =============================================================================
-- TABLE 4 — public.personal_task
-- Pre-state: jwt_own_personal_task FOR ALL USING (profile_id IN caller-profiles) — no WITH CHECK
-- Post-state: per-verb INSERT/UPDATE/DELETE, owner-only (profile_id pinned to caller),
--             WITH CHECK additionally pins workspace_id to caller's active profile workspace.
-- service_role_personal_task, api_key_read_personal_task are LEFT UNTOUCHED.
--
-- fn_list_my_tasks RPC is SECURITY DEFINER (ADR-0298 Sortie 3) — bypasses RLS reads,
-- unaffected by per-verb split (regression journey).
--
-- All app-code writes go through ctx.supabaseAdmin (task + personal capability tools) —
-- service_role bypass.  JWT writes from PostgREST are defense-in-depth.
-- =============================================================================

DROP POLICY IF EXISTS "jwt_own_personal_task" ON public.personal_task;
DROP POLICY IF EXISTS "jwt_select_personal_task" ON public.personal_task;
DROP POLICY IF EXISTS "jwt_insert_personal_task" ON public.personal_task;
DROP POLICY IF EXISTS "jwt_update_personal_task" ON public.personal_task;
DROP POLICY IF EXISTS "jwt_delete_personal_task" ON public.personal_task;

-- SELECT — owner-only.  Note: jwt_own_personal_task did NOT have a separate SELECT
-- policy pre-Sortie-A.2 (it was a FOR ALL).  We now split it into per-verb so the
-- read surface is explicit.
CREATE POLICY "jwt_select_personal_task" ON public.personal_task
  FOR SELECT
  USING (
    profile_id IN (
      SELECT p.profile_id FROM public.profile p
      WHERE p.user_id = auth.uid() AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_select_personal_task" ON public.personal_task IS
  'Sortie A.2 defense (2026-05-13, ADR-0299, audit F-DB-10): owner-only SELECT.  '
  'fn_list_my_tasks RPC is SECURITY DEFINER and bypasses this policy by design '
  '(ADR-0298 Sortie 3 R8 — multi-workspace assignee read path).';

CREATE POLICY "jwt_insert_personal_task" ON public.personal_task
  FOR INSERT
  WITH CHECK (
    -- Caller must own the profile_id AND workspace_id must match that profile's workspace.
    -- The join in profile prevents workspace_id forgery — a multi-workspace user cannot
    -- create a task with workspace_id of workspace B while passing profile_id of workspace A.
    EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.profile_id = personal_task.profile_id
        AND p.workspace_id = personal_task.workspace_id
        AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_insert_personal_task" ON public.personal_task IS
  'Sortie A.2 defense (2026-05-13, ADR-0299, audit F-DB-10): WITH CHECK pins profile_id '
  'AND workspace_id to caller''s active profile via single EXISTS join.  Blocks the '
  'multi-workspace forgery class — cannot create task in workspace B while claiming '
  'profile_id from workspace A.';

CREATE POLICY "jwt_update_personal_task" ON public.personal_task
  FOR UPDATE
  USING (
    profile_id IN (
      SELECT p.profile_id FROM public.profile p
      WHERE p.user_id = auth.uid() AND p.is_active = true
    )
  )
  WITH CHECK (
    -- Symmetric: post-UPDATE row must still pin profile_id + workspace_id to caller's
    -- active profile.  This blocks both profile_id swap (handing task to colleague)
    -- and workspace_id flip (moving task into colleague workspace).
    EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.profile_id = personal_task.profile_id
        AND p.workspace_id = personal_task.workspace_id
        AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_update_personal_task" ON public.personal_task IS
  'Sortie A.2 defense (2026-05-13, ADR-0299, audit F-DB-10): symmetric USING + WITH CHECK. '
  'WITH CHECK uses single EXISTS join on profile to block profile_id swap and workspace_id flip.';

CREATE POLICY "jwt_delete_personal_task" ON public.personal_task
  FOR DELETE
  USING (
    profile_id IN (
      SELECT p.profile_id FROM public.profile p
      WHERE p.user_id = auth.uid() AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_delete_personal_task" ON public.personal_task IS
  'Sortie A.2 defense (2026-05-13, ADR-0299, audit F-DB-10): owner-only DELETE.  '
  'Personal tasks are self-managed; no admin/manager DELETE branch (matches pre-Sortie '
  'FOR ALL semantics for owner — cancel/done lifecycle covers most cases).';

-- ─────────────────────────────────────────────────────────────────────────────
-- End of Sortie A.2 migration.  Acceptance criteria S1-S6 closed; S7-S10 follow
-- in pgTAP tests (T2 writes, T4 runs) + spec/ADR update (T3).
-- ─────────────────────────────────────────────────────────────────────────────
