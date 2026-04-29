-- Migration: 20260428130000_helpdesk_sla_trigger_seed.sql
-- Module: Helpdesk SLA Phase 2
-- ADR-0227 (Approach A): Pre-canned engine_event + seeded engine_trigger.
--
-- Purpose:
--   Seed one platform-level (workspace_id = NULL) engine_trigger row so that
--   fire-delayed-triggers, when it looks up trigger.event_type for a delayed
--   trigger row, finds 'helpdesk.query.sla_breached' and re-dispatches it to
--   engine-dispatch → helpdesk_query_lifecycle step 3.
--
-- workspace_id nullability (verified against 20260304100000_engine_process_tables.sql):
--   engine_trigger.workspace_id is NULLABLE. NULL = global/platform-level trigger
--   that applies to all workspaces. This mirrors the canonical sibling trigger
--   'helpdesk.query.opened' seeded in 20260518230000_helpdesk_lifecycle_dispatcher_fix.sql
--   (also NULL). A single NULL row covers all existing AND future workspaces.
--   No per-workspace bootstrap hook is needed.
--
-- Steward council finding (2026-04-28):
--   fire-delayed-triggers resolves engine_trigger via trigger_id FK on
--   engine_delayed_trigger → engine_trigger.event_type lookup. The trigger row's
--   event_type is what gets re-dispatched as an engine_event to engine-dispatch.
--
-- Idempotency:
--   WHERE NOT EXISTS guard. No UNIQUE constraint on engine_trigger supports
--   ON CONFLICT; all canonical seeds in this repo use WHERE NOT EXISTS.
--   Re-applying this migration is a no-op.
--
-- delay_seconds = 0:
--   The fire delay is baked into engine_delayed_trigger.fire_at at ticket open
--   (NOW() + observer_escalation_hours * INTERVAL '1 hour'). The trigger config
--   itself needs no additional delay.
--
-- New-workspace bootstrap:
--   Not required. workspace_id = NULL makes this row visible to all workspaces
--   via the engine_trigger RLS policy (workspace_id IS NULL branch).

INSERT INTO engine_trigger (event_type, process_id, delay_seconds, is_active)
SELECT
  'helpdesk.query.sla_breached',
  'helpdesk_query_lifecycle',
  0,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'helpdesk.query.sla_breached'
    AND process_id = 'helpdesk_query_lifecycle'
);
