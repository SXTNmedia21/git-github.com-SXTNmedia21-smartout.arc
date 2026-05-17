-- ─────────────────────────────────────────────────────────────────────────────
-- Sortie A.3 — F-DB-12 staff_event RLS WITH CHECK (ADR-0303 sister-sweep enforcement)
-- Audit ref: F-DB-12 (HIGH) — 2026-05-13-adr-contract-validation-02 smoke re-run
-- Mirror of: 20260608120000_sortie_a2_d6_rls_with_check.sql (Sortie A.2)
--            20260605120000_shift_approval_rls_with_check.sql (Sortie A — original ADR-0299)
--
-- Pre-Sortie-A.3 state — same gap class as pre-ADR-0299 shift_approval:
--   public.staff_event           — jwt_write_staff_event          FOR ALL USING(...) — no WITH CHECK
--   public.staff_event_attendee  — jwt_write_staff_event_attendee FOR ALL USING(...) — no WITH CHECK
--
-- A JWT caller belonging to two workspaces can flip workspace_id on INSERT/UPDATE
-- to a colleague workspace they also belong to (staff_event has direct workspace_id;
-- staff_event_attendee inherits via staff_event join).
--
-- Why now: F-DB-12 detected in audit synthesis 2026-05-13-02 — the SAME DAY
-- ADR-0303 (sister-table-sweep rule) was proposed.  Closes F-DB-12 + validates
-- ADR-0303 enforcement mechanism (this migration plus CI lint scripts/check-rls-with-check.ts
-- shipped in T3 sister task).
--
-- Fix:
--   1. Drop FOR ALL policies; create per-verb policies with symmetric USING + WITH CHECK
--      so workspace_id flips are rejected with 42501 at WITH CHECK evaluation.
--   2. Role gate = admin / owner / manager (mirrors deviation pattern in A.2).
--      Matches app-layer Server Action gate in staff-event-actions.ts:109-111
--      (admin || manager only) — ADR-0285 explicit "admin-manager-write pattern".
--   3. SELECT policies (jwt_read_staff_event*, api_key_read_staff_event*) are
--      LEFT UNTOUCHED — they already use SELECT-only verb scoping.
--
-- Acceptance criteria (PLAN-audit-fdb12-staff-event-rls.md):
--   S1 No FOR ALL policy remains on staff_event + staff_event_attendee
--   S2 Per-verb policies (INSERT/UPDATE/DELETE) with WITH CHECK matching USING
--   S3 Role gate admin/owner/manager on INSERT/UPDATE/DELETE
--   S4 Forge attempt rejected with 42501 (pgTAP throws_ok — T2)
--   S5 Happy-path INSERT/UPDATE/DELETE succeeds for own workspace (pgTAP lives_ok — T2)
--   S6 Migration idempotent (DROP IF EXISTS + CREATE)
--
-- Writer enumeration (council T1 verdict — 2026-05-13):
--   - Only writer is apps/web/src/app/dashboard/people/invitations/_actions/staff-event-actions.ts
--     createStaffEvent Server Action: admin/manager-gated at app layer, resolves
--     workspace_id + created_by server-side from session (ADR-0151).
--   - No mobile/packages/ai/services/supabase-functions writers.
--   - No employee-tier JWT path writes today.  Role gate = admin/owner/manager is safe.
--
-- ─────────────────────────────────────────────────────────────────────────────

-- =============================================================================
-- TABLE 1 — public.staff_event
-- Pre-state: jwt_write_staff_event FOR ALL — admin/owner/manager, no WITH CHECK
-- Post-state: per-verb INSERT/UPDATE/DELETE, admin/owner/manager,
--             symmetric USING + WITH CHECK on workspace_id.
-- jwt_read_staff_event, api_key_read_staff_event are LEFT UNTOUCHED.
-- =============================================================================

DROP POLICY IF EXISTS "jwt_write_staff_event" ON public.staff_event;
DROP POLICY IF EXISTS "jwt_insert_staff_event" ON public.staff_event;
DROP POLICY IF EXISTS "jwt_update_staff_event" ON public.staff_event;
DROP POLICY IF EXISTS "jwt_delete_staff_event" ON public.staff_event;

CREATE POLICY "jwt_insert_staff_event" ON public.staff_event
  FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = staff_event.workspace_id
        AND p.role IN ('admin', 'owner', 'manager')
        AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_insert_staff_event" ON public.staff_event IS
  'Sortie A.3 defense (2026-05-13, ADR-0303 sister-sweep enforcement, audit F-DB-12): '
  'replaces jwt_write_staff_event FOR ALL.  WITH CHECK pins workspace_id to caller '
  'workspace + admin/owner/manager role gate (ADR-0285 admin-manager-write pattern).  '
  'Mirror of A.2 deviation pattern from 20260608120000_sortie_a2_d6_rls_with_check.sql.';

CREATE POLICY "jwt_update_staff_event" ON public.staff_event
  FOR UPDATE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = staff_event.workspace_id
        AND p.role IN ('admin', 'owner', 'manager')
        AND p.is_active = true
    )
  )
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = staff_event.workspace_id
        AND p.role IN ('admin', 'owner', 'manager')
        AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_update_staff_event" ON public.staff_event IS
  'Sortie A.3 defense (2026-05-13, ADR-0303 sister-sweep enforcement, audit F-DB-12): '
  'symmetric USING + WITH CHECK blocks workspace_id flipping via JWT caller.  '
  'Admin/owner/manager only.';

CREATE POLICY "jwt_delete_staff_event" ON public.staff_event
  FOR DELETE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = staff_event.workspace_id
        AND p.role IN ('admin', 'owner', 'manager')
        AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_delete_staff_event" ON public.staff_event IS
  'Sortie A.3 defense (2026-05-13, ADR-0303 sister-sweep enforcement, audit F-DB-12): '
  'admin/owner/manager role gate on DELETE.  Symmetric with INSERT/UPDATE — staff_event '
  'rollback path in createStaffEvent server action depends on DELETE working for managers.';

-- =============================================================================
-- TABLE 2 — public.staff_event_attendee
-- Pre-state: jwt_write_staff_event_attendee FOR ALL — admin/owner/manager via
--            staff_event join, no WITH CHECK.
-- Post-state: per-verb INSERT/UPDATE/DELETE, admin/owner/manager via staff_event join,
--             symmetric USING + WITH CHECK.  No direct workspace_id column —
--             tenant scoping derives via staff_event.workspace_id.
-- jwt_read_staff_event_attendee, api_key_read_staff_event_attendee LEFT UNTOUCHED.
--
-- Note: WITH CHECK on a junction table without direct workspace_id column uses the
-- same EXISTS join as USING.  The parent staff_event row is gated on workspace_id
-- via its own WITH CHECK (above), so cross-workspace event_id forgery is blocked
-- at the parent.  This child policy gates the role + workspace via join.
-- =============================================================================

DROP POLICY IF EXISTS "jwt_write_staff_event_attendee" ON public.staff_event_attendee;
DROP POLICY IF EXISTS "jwt_insert_staff_event_attendee" ON public.staff_event_attendee;
DROP POLICY IF EXISTS "jwt_update_staff_event_attendee" ON public.staff_event_attendee;
DROP POLICY IF EXISTS "jwt_delete_staff_event_attendee" ON public.staff_event_attendee;

CREATE POLICY "jwt_insert_staff_event_attendee" ON public.staff_event_attendee
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_event se
      JOIN public.profile p ON p.user_id = auth.uid()
                           AND p.workspace_id = se.workspace_id
                           AND p.is_active = true
      WHERE se.event_id = staff_event_attendee.event_id
        AND p.role IN ('admin', 'owner', 'manager')
    )
  );

COMMENT ON POLICY "jwt_insert_staff_event_attendee" ON public.staff_event_attendee IS
  'Sortie A.3 defense (2026-05-13, ADR-0303 sister-sweep enforcement, audit F-DB-12): '
  'replaces jwt_write_staff_event_attendee FOR ALL.  WITH CHECK requires caller to be '
  'admin/owner/manager in the workspace owning the parent staff_event row.  Cross-workspace '
  'event_id forgery additionally blocked by staff_event WITH CHECK (parent gate).';

CREATE POLICY "jwt_update_staff_event_attendee" ON public.staff_event_attendee
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_event se
      JOIN public.profile p ON p.user_id = auth.uid()
                           AND p.workspace_id = se.workspace_id
                           AND p.is_active = true
      WHERE se.event_id = staff_event_attendee.event_id
        AND p.role IN ('admin', 'owner', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_event se
      JOIN public.profile p ON p.user_id = auth.uid()
                           AND p.workspace_id = se.workspace_id
                           AND p.is_active = true
      WHERE se.event_id = staff_event_attendee.event_id
        AND p.role IN ('admin', 'owner', 'manager')
    )
  );

COMMENT ON POLICY "jwt_update_staff_event_attendee" ON public.staff_event_attendee IS
  'Sortie A.3 defense (2026-05-13, ADR-0303 sister-sweep enforcement, audit F-DB-12): '
  'symmetric USING + WITH CHECK blocks event_id swap to another workspace via JWT caller.  '
  'Admin/owner/manager only.';

CREATE POLICY "jwt_delete_staff_event_attendee" ON public.staff_event_attendee
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_event se
      JOIN public.profile p ON p.user_id = auth.uid()
                           AND p.workspace_id = se.workspace_id
                           AND p.is_active = true
      WHERE se.event_id = staff_event_attendee.event_id
        AND p.role IN ('admin', 'owner', 'manager')
    )
  );

COMMENT ON POLICY "jwt_delete_staff_event_attendee" ON public.staff_event_attendee IS
  'Sortie A.3 defense (2026-05-13, ADR-0303 sister-sweep enforcement, audit F-DB-12): '
  'admin/owner/manager DELETE.  Note: ON DELETE CASCADE on staff_event parent will also '
  'remove attendee rows when parent is deleted — service_role bypass on the cascade path.';

-- ─────────────────────────────────────────────────────────────────────────────
-- End of Sortie A.3 migration.  Acceptance criteria S1-S6 closed; S7-S11 follow
-- in pgTAP tests (T2), ADR-0303 promotion + CI lint (T3), verify (T5).
-- ─────────────────────────────────────────────────────────────────────────────
