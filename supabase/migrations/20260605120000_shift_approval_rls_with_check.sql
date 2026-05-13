-- ─────────────────────────────────────────────────────────────────────────────
-- Sortie A — D6 RLS WITH CHECK Hardening
-- Closes L-0177 forgeable-actor gap on shift_approval UPDATE.
--
-- Pre-Sortie state (20260304200200_deviation_shift_approval.sql):
--   jwt_manage_shift_approval FOR ALL USING(...) — no WITH CHECK clause.
--   A JWT caller who passes USING can flip workspace_id or approved_by
--   to any value.  Identical gap class to pre-Sortie-1 session_task.
--
-- Fix: drop the broad FOR ALL policy; replace with 3 explicit per-verb
-- policies (INSERT / UPDATE / DELETE) each carrying identical symmetric
-- USING + WITH CHECK predicates.  SELECT remains unchanged (jwt_read).
-- service_role_shift_approval and api_key_read_shift_approval untouched.
--
-- Writer enumeration (spec §3.4):
--   - engine-dispatch queue_shift_approval: service_role → bypasses RLS
--   - confirmHoursAction (Sortie 1): service_role → bypasses RLS
--   - approve_shift agent tool: ctx.supabaseAdmin (service_role) → bypasses
--     RLS (R1 from spec §8 — documented; pgTAP Phase 3 uses simulation)
--   - mobile use-confirm-hours: offline enqueue → server action → service_role
-- All JWT-path writers must satisfy new predicate — none exist today.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Drop the broad FOR ALL policy ────────────────────────────────────────
DROP POLICY IF EXISTS "jwt_manage_shift_approval" ON public.shift_approval;

-- ── 2. INSERT — admin/owner/manager in the workspace ────────────────────────
CREATE POLICY "jwt_insert_shift_approval" ON public.shift_approval
  FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = shift_approval.workspace_id
        AND p.role IN ('admin', 'owner', 'manager')
        AND p.is_active = true
    )
  );

-- ── 3. UPDATE — admin/owner/manager OR shift owner (employee) ───────────────
-- The employee branch preserves forward-compat for self-edit flows and the
-- pre-Sortie-1 mobile spec line 535 path.  Removing it would break any future
-- "employee edits disputed hours" feature without a schema change.
-- Predicate is symmetric (USING = WITH CHECK): no row-state transition
-- mid-flow changes which actor is allowed.
CREATE POLICY "jwt_update_shift_approval" ON public.shift_approval
  FOR UPDATE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND (
      EXISTS (
        SELECT 1 FROM public.profile p
        WHERE p.user_id = auth.uid()
          AND p.workspace_id = shift_approval.workspace_id
          AND p.role IN ('admin', 'owner', 'manager')
          AND p.is_active = true
      )
      OR EXISTS (
        SELECT 1 FROM public.schedule_shift s
        JOIN public.profile p ON p.profile_id = s.employee_id
        WHERE s.schedule_shift_id = shift_approval.shift_id
          AND p.user_id = auth.uid()
          AND p.is_active = true
      )
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND (
      EXISTS (
        SELECT 1 FROM public.profile p
        WHERE p.user_id = auth.uid()
          AND p.workspace_id = shift_approval.workspace_id
          AND p.role IN ('admin', 'owner', 'manager')
          AND p.is_active = true
      )
      OR EXISTS (
        SELECT 1 FROM public.schedule_shift s
        JOIN public.profile p ON p.profile_id = s.employee_id
        WHERE s.schedule_shift_id = shift_approval.shift_id
          AND p.user_id = auth.uid()
          AND p.is_active = true
      )
    )
  );

COMMENT ON POLICY "jwt_update_shift_approval" ON public.shift_approval IS
  'Sortie A defense (2026-05-13, ADR-0299): replaces jwt_manage_shift_approval FOR ALL. '
  'Symmetric USING + WITH CHECK blocks workspace_id flipping and cross-workspace row '
  'takeover via JWT/anon caller.  Field-level forgery (approved_by) is closed at the '
  'application layer via ADR-0151 ResolvedActor — RLS does not enforce payload columns.  '
  'Mirror of session_task pattern from 20260604120000_session_task_rls_with_check.sql.';

-- ── 4. DELETE — admin/owner only (tighter than INSERT; no manager self-delete) ──
CREATE POLICY "jwt_delete_shift_approval" ON public.shift_approval
  FOR DELETE
  USING (
    public.is_admin_in_workspace(auth.uid(), workspace_id)
  );
