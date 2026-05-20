-- ============================================================
-- 20260621100100_engine_trigger_employee_activation.sql
-- feat/contract-signed-active-cascade (ADR-0379)
--
-- Purpose
-- -------
-- Maps the `contract.signed` engine_event to the new `employee_activation`
-- process. Complements the existing mapping of contract.signed → integration_sync
-- (which handles C3 adapter concerns like billing coupling). Both triggers fire
-- on the same event; each process runs independently (ADR-0186: one event,
-- multiple triggers allowed).
--
-- Condition filter
-- ----------------
-- `condition = {"match": {"contract_type": "employee"}}` — only employee
-- contracts trigger activation. SaaS contracts (contract_type != 'employee')
-- should not trigger a profile flip.
-- The evaluateCondition("match") in engine-dispatch compares payload keys:
--   payload.contract_type === "employee"
-- The docuseal route sets contract_type in the payload (route.ts line ≈329).
--
-- Idempotent pattern
-- ------------------
-- INSERT WHERE NOT EXISTS — mirrors 20260520120100_engine_trigger_contract_events.sql.
-- No UNIQUE constraint on (event_type, process_id) so this guard is necessary.
-- Re-running on db reset or replay is safe.
--
-- workspace_id = NULL — global trigger (applies to all workspaces). Workspace-
-- specific triggers would require a row per workspace. Global is correct here
-- since employee activation applies to all workspaces.
--
-- References
-- ----------
-- ADR-0379 (signature-as-C4-authorization, employee_activation process)
-- ADR-0186 (engine event flow: one event → multiple triggers)
-- 20260520120100_engine_trigger_contract_events.sql (INSERT WHERE NOT EXISTS pattern)
-- engine-dispatch evaluateCondition: engine-dispatch/index.ts:45-84
-- ============================================================

SET search_path TO public, extensions;

INSERT INTO public.engine_trigger (event_type, process_id, is_active, workspace_id, condition)
SELECT
  'contract.signed',
  'employee_activation',
  true,
  NULL,
  '{"match": {"contract_type": "employee"}}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM public.engine_trigger
  WHERE event_type = 'contract.signed'
    AND process_id = 'employee_activation'
);
