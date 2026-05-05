-- Migration: engine_trigger_contract_events
-- Purpose : Align engine_trigger event_type naming convention with telemetry
--           registry (dot-separated) and add missing contract event mappings.
--
-- Changes:
--   1. Rename 'contract signed'    → 'contract.signed'    (keep process: integration_sync)
--   2. Rename 'contract terminated'→ 'contract.terminated' (keep process: integration_sync)
--   3. Insert 'contract.send.submitted' → contract_signing  (if not already present)
--   4. Insert 'contract.delete.confirmed' → integration_sync (audit-only, if not already present)
--
-- Why UPDATE for renames: engine_state.trigger_id + engine_delayed_trigger.trigger_id
--   have FK references to engine_trigger.id. Renaming the event_type column in-place
--   preserves those FK references. DELETE+INSERT would break them.
--
-- Why INSERT...WHERE NOT EXISTS: no UNIQUE constraint on (event_type, process_id);
--   idempotent guard prevents duplicate rows on re-run.
--
-- ADR-0186: events flow through engine_event → engine_trigger → engine_process.
-- L-0184:  single canonical emit producer per event name.

-- ── 1. Rename space-separated legacy rows to dot-separated convention ──────────

UPDATE public.engine_trigger
SET
  event_type = 'contract.signed',
  updated_at = now()
WHERE event_type = 'contract signed'
  AND process_id = 'integration_sync';

UPDATE public.engine_trigger
SET
  event_type = 'contract.terminated',
  updated_at = now()
WHERE event_type = 'contract terminated'
  AND process_id = 'integration_sync';

-- ── 2. Add contract.send.submitted → contract_signing ─────────────────────────
-- Maps the telemetry event emitted by the send-route (contracts.send.submitted)
-- to the existing contract_signing process.
-- Phase 4 will wire actual D2 update + C4 authority-flip steps into this process.

INSERT INTO public.engine_trigger (event_type, process_id, is_active, workspace_id)
SELECT
  'contract.send.submitted',
  'contract_signing',
  true,
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.engine_trigger
  WHERE event_type = 'contract.send.submitted'
    AND process_id = 'contract_signing'
);

-- ── 3. Add contract.delete.confirmed → integration_sync ───────────────────────
-- Audit-only mapping so the orphan engine_event is consumed.
-- Phase 4 may promote this to a dedicated cleanup process.

INSERT INTO public.engine_trigger (event_type, process_id, is_active, workspace_id)
SELECT
  'contract.delete.confirmed',
  'integration_sync',
  true,
  NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.engine_trigger
  WHERE event_type = 'contract.delete.confirmed'
    AND process_id = 'integration_sync'
);
