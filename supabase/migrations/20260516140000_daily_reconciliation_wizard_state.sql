SET search_path TO public, extensions;

-- ============================================
-- 20260516140000_daily_reconciliation_wizard_state.sql
--
-- Adds `wizard_state` jsonb column to daily_reconciliation for M2
-- clockout-wizard resumability (Invariant #8, ADR-0134 offline-queue
-- safety). Also adds `last_touched_at` inside the jsonb payload for
-- staleness detection (Invariant #13).
--
-- Shape:
--   {
--     "last_completed_step": 0..6,
--     "last_touched_at": "<ISO-8601 UTC>",
--     "step_data": {
--       "<stepId>": { ...free-form step payload... }
--     }
--   }
--
-- Writable by:
--   - service_role (Server Actions run with service role)
--   - jwt-authenticated shift leaders whose profile_id matches
--     daily_reconciliation.session.duty_leader_id OR opened_by.
--     Because session_id can be NULL we must keep the existing
--     admin-role JWT write policy as the fallback; the new policy
--     below is ADDITIVE — it extends write rights, it does not
--     revoke the admin policy.
--
-- Campaign: daily-operation — M2 recon-wizard-mobile Phase B
-- ADR references: ADR-0114, ADR-0134, ADR-0156
-- ============================================

ALTER TABLE public.daily_reconciliation
  ADD COLUMN IF NOT EXISTS wizard_state jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.daily_reconciliation.wizard_state IS
  'M2 clockout-wizard state snapshot. Shape: { last_completed_step: int, last_touched_at: iso-8601, step_data: { [stepId]: object } }. Written by saveWizardStepAction. Server-side merged JSONB; step_data keys namespace per step-id. Consumers: apps/mobile clockout wizard (resumability + staleness banner).';

-- ── Shift-leader JWT write policy ─────────────────────────
-- Allows the duty leader of the linked session to UPDATE wizard_state
-- (and the rest of the row during wizard flow). Complements the
-- existing admin/owner/manager policy. Non-leaders are still gated
-- by the legacy policy, preserving admin override paths.
DROP POLICY IF EXISTS "jwt_leader_write_daily_reconciliation" ON public.daily_reconciliation;
CREATE POLICY "jwt_leader_write_daily_reconciliation" ON public.daily_reconciliation
FOR UPDATE USING (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND session_id IS NOT NULL
  AND EXISTS (
    SELECT 1
      FROM public.department_session ds
      JOIN public.profile p
        ON p.user_id = auth.uid()
       AND p.workspace_id = daily_reconciliation.workspace_id
     WHERE ds.department_session_id = daily_reconciliation.session_id
       AND (ds.duty_leader_id = p.profile_id OR ds.opened_by = p.profile_id)
  )
) WITH CHECK (
  workspace_id IN (SELECT get_workspace_ids_for_user(auth.uid()))
  AND session_id IS NOT NULL
  AND EXISTS (
    SELECT 1
      FROM public.department_session ds
      JOIN public.profile p
        ON p.user_id = auth.uid()
       AND p.workspace_id = daily_reconciliation.workspace_id
     WHERE ds.department_session_id = daily_reconciliation.session_id
       AND (ds.duty_leader_id = p.profile_id OR ds.opened_by = p.profile_id)
  )
);

-- Convenience index for resumability queries (last_touched_at > NOW-12h).
-- Uses a btree expression index on the extracted timestamp text; cheap
-- because we only read it during wizard mount.
CREATE INDEX IF NOT EXISTS idx_recon_wizard_last_touched
  ON public.daily_reconciliation ((wizard_state->>'last_touched_at'))
  WHERE wizard_state ? 'last_touched_at';
