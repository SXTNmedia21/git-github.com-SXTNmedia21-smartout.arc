-- ─────────────────────────────────────────────────────────────────────────────
-- Sortie A.2 gap closure — session_task INSERT JWT policy
-- ADR-0303 sister-sweep rule mandates this alongside the 4-table consolidation
-- migration (20260608120000_sortie_a2_d6_rls_with_check.sql).
--
-- Pre-Sortie-A.2 state:
--   20260412100300_session_infrastructure.sql:84-103 ships:
--     jwt_read_session_task   — SELECT  (any workspace member)
--     jwt_update_session_task — UPDATE  USING(workspace_id) — no WITH CHECK
--     service_role_session_task — FOR ALL service_role
--   NO jwt_insert_session_task policy exists.  Any workspace member can POST
--   a session_task row directly via PostgREST with arbitrary workspace_id
--   (no membership check on INSERT, no role gate).
--
-- Fix:
--   1. Add jwt_insert_session_task FOR INSERT WITH CHECK:
--      - workspace_id must be in caller's workspaces (ADR-0151 membership pin).
--      - Caller must have role admin/owner/manager and be active.
--      - session_task is operational (D6 cascade + manual manager creation).
--        manager+ is the right gate — employees complete, they don't create.
--   2. Add WITH CHECK to jwt_update_session_task (UPDATE USING-only gap, same
--      class as F-DB-09 — UPDATE from origin migration has no WITH CHECK).
--      Drop-recreate is idempotent via DROP IF EXISTS guard.
--
-- Acceptance:
--   - employee INSERT → 42501 (pgTAP sortie_a2_session_task_insert.sql Test 1)
--   - manager INSERT → succeeds (pgTAP Test 2)
--   - re-apply idempotent (DROP IF EXISTS guards on both old and new policy names)
--
-- Writers (existing; unaffected — all bypass RLS via service_role):
--   - session_hook trigger → service_role (INSERT spawns tasks from hook definition)
--   - engine-dispatch bulk-seed → ctx.supabaseAdmin (service_role)
--   - stage-engine gatedMutation / gateAction — service_role (ADR-0287)
--
-- No JWT-path INSERT in production today.  Policy is defense-in-depth.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop old UPDATE policy (no WITH CHECK) and new-name guards for idempotency.
DROP POLICY IF EXISTS "jwt_update_session_task" ON public.session_task;
DROP POLICY IF EXISTS "jwt_insert_session_task" ON public.session_task;

-- ── INSERT — manager+ with workspace membership check ────────────────────────
CREATE POLICY "jwt_insert_session_task" ON public.session_task
  FOR INSERT
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profile p
      WHERE p.user_id = auth.uid()
        AND p.workspace_id = session_task.workspace_id
        AND p.role IN ('admin', 'owner', 'manager')
        AND p.is_active = true
    )
  );

COMMENT ON POLICY "jwt_insert_session_task" ON public.session_task IS
  'Sortie A.2 gap closure (2026-05-14, ADR-0303 sister-sweep): closes missing INSERT '
  'policy on session_task.  WITH CHECK pins workspace_id to caller membership '
  '(ADR-0151) and requires manager/admin/owner role — employees complete tasks, '
  'they do not create them.  Existing service_role writers '
  '(hook-trigger, engine-dispatch, stage-engine gateAction) bypass this via '
  'service_role_session_task and are unaffected.';

-- ── UPDATE — re-create with symmetric USING + WITH CHECK (closes USING-only gap) ─
CREATE POLICY "jwt_update_session_task" ON public.session_task
  FOR UPDATE
  USING (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  )
  WITH CHECK (
    workspace_id IN (SELECT public.get_workspace_ids_for_user(auth.uid()))
  );

COMMENT ON POLICY "jwt_update_session_task" ON public.session_task IS
  'Sortie A.2 gap closure (2026-05-14, ADR-0303): re-creates the origin '
  '20260412100300 UPDATE policy with symmetric WITH CHECK to prevent '
  'workspace_id forgery on UPDATE (same class as F-DB-09).  '
  'All workspace members may UPDATE (employees mark tasks complete/in_progress); '
  'role differentiation is at app layer.  Symmetric USING = WITH CHECK '
  'is the invariant per ADR-0313.';

-- ─────────────────────────────────────────────────────────────────────────────
-- End of session_task INSERT+UPDATE gap closure.
-- Paired pgTAP: supabase/tests/rls/sortie_a2_session_task_insert.sql
-- ─────────────────────────────────────────────────────────────────────────────
