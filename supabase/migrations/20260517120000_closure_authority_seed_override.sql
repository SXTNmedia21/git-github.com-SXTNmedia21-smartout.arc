-- daily-operation closure Item 4 — authority seed for signoff.admin_override.
-- Council: closure sortie 2026-04-23 (plan: docs/plans/PLAN-closure.md).
-- Related: Invariant #9 (admin-override with audit-trail).
--
-- ============================================
-- 20260517120000_closure_authority_seed_override.sql
-- Seeds the `signoff.admin_override` capability used by the new mobile BFF
-- `/api/reconciliation/wizard-override` (closure Item 4 — resolves
-- TODO-M2-F in apps/mobile/app/(app)/(home)/clockout.tsx).
--
-- Why a separate migration (not combined with Items 1 + 2):
--   - Closure sortie waves Item 1 (roster.add_shift_manual) and Item 2
--     (task.add_task_manual) ship in parallel files; explicit separation
--     avoids merge conflicts when the three sub-tasks land concurrently.
--   - Each capability is independently revertible.
--
-- Why `signoff.admin_override` and not the existing
-- `reconciliation.wizard_submit_with_blocker` (seeded 20260516100000):
--   - Plan explicitly names `signoff.admin_override` as the closure
--     capability. The wizard_submit_with_blocker row remains as a
--     defence-in-depth inner gate inside the web Server Action
--     `overrideWizardBlockerAction`.
--   - The BFF route gates on `signoff.admin_override` at the edge.
--     Dual-gate pattern is intentional: a future rename/deprecation of
--     either capability should not silently remove the other's floor.
--
-- Pattern mirrors 20260516100000_seed_reconciliation_authority.sql:
--   - workspace_id NOT NULL on engine_authority_config → cross join.
--   - ON CONFLICT (workspace_id, capability) DO NOTHING — idempotent.
--   - updated_by falls back to first godmode user; NOTICE + return if
--     no godmode exists (fresh seed — re-run after first admin).
--
-- Policy:
--   level = 'suggest'   — task spec: authority `suggest`. In gate_action's
--                         current semantics (Node-side tool-selector),
--                         suggest = admin sees confirm-UI. All admin-class
--                         capabilities default to confirm; we deviate here
--                         only to match the closure plan's named level.
--   min_role = 'admin'  — floor enforced server-side by gate_action().
--   requires_four_eyes = false
--   observer_escalation_hours = 24
-- ============================================

SET search_path TO public, extensions;

DO $$
DECLARE
  v_updated_by uuid;
BEGIN
  SELECT user_id INTO v_updated_by
  FROM public.user_identity
  WHERE is_godmode = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_updated_by IS NULL THEN
    RAISE NOTICE 'No godmode user found — skipping signoff.admin_override seed. Re-run after first admin is created.';
    RETURN;
  END IF;

  INSERT INTO public.engine_authority_config (
    workspace_id, capability, level, min_role,
    requires_four_eyes, observer_escalation_hours, updated_by
  )
  SELECT w.workspace_id, cap.capability, cap.level, cap.min_role,
         false, 24, v_updated_by
  FROM public.workspace w
  CROSS JOIN (
    VALUES
      ('signoff.admin_override', 'suggest', 'admin')
  ) AS cap(capability, level, min_role)
  ON CONFLICT (workspace_id, capability) DO NOTHING;
END $$;

COMMENT ON COLUMN public.engine_authority_config.capability IS
  'Capability name (matches packages/ai/src/capabilities/types.ts CapabilityName union). Added billing_query 2026-04-17; added session.signoff/session.close/broadcast.send 2026-05-15; added session.open/session.transition/shift.manual_time_entry 2026-04-20; added reconciliation.override/submit/wizard_submit_with_blocker/wizard_save 2026-04-22 (ADR-0189); added observer_request.create/claim/approve 2026-04-22 (ADR-0189 Phase 0e gap closure); added signoff.admin_override 2026-04-23 (closure Item 4 — mobile BFF wizard-override gate, suggest/admin).';
