-- Migration: 20260428222919_helpdesk_sla_trigger_repoint.sql
-- Module: Helpdesk SLA Phase 2 — Council 2026-04-29 fix
--
-- Why this migration exists (ADR-0235 + L-0160):
--   20260428130000_helpdesk_sla_trigger_seed.sql seeded engine_trigger with
--   process_id='helpdesk_query_lifecycle' for event_type='helpdesk.query.sla_breached'.
--   Council 2026-04-29 found this is incorrect: fire-delayed-triggers calls engine-dispatch
--   with trigger.event_type, and the dispatcher spawns a NEW engine_state at step 1 of the
--   named process. Spawning at step 1 of helpdesk_query_lifecycle on a breach event creates
--   a ghost ticket — the real ticket sits at step 2 waiting for helpdesk.query.resolved and
--   is untouched. The breach event is silently discarded (ADR-0235 §"Context and Problem").
--
--   The correct consumer is the transient helpdesk_sla_breach_handler process (seeded by
--   the T8a migration in this branch). It accepts the breach event at step 1, applies
--   update_context_targeted to patch the original ticket's engine_state.context.sla_breached_at,
--   then fires the observer notification at step 2.
--
-- Original (incorrect) seed: 20260428130000_helpdesk_sla_trigger_seed.sql
-- Chosen update strategy:    Option 1 — single UPDATE, in-place.
--   Option 2 (DELETE + INSERT) was considered; rejected because DELETE risks losing the row's
--   UUID (engine_delayed_trigger.trigger_id FK points to this UUID by value — already-queued
--   delayed triggers would become orphaned if we delete and re-insert with a new UUID).
--   UPDATE preserves the UUID, so any engine_delayed_trigger rows already written by openTicket
--   remain valid and resolve correctly after this migration.
--
-- Idempotency:
--   No UNIQUE constraint exists on engine_trigger (schema: 20260304100000_engine_process_tables.sql).
--   ON CONFLICT is not available. Canonical pattern for this table is WHERE NOT EXISTS (used by
--   all sibling seeds in this repo). The UPDATE is guarded by a WHERE predicate; re-applying
--   yields 0 rows updated — a no-op. Safe across db reset + repeated apply.
--
-- Verification:
--   SELECT event_type, process_id FROM engine_trigger
--   WHERE event_type = 'helpdesk.query.sla_breached';
--   → must return process_id = 'helpdesk_sla_breach_handler'

UPDATE engine_trigger
SET process_id = 'helpdesk_sla_breach_handler'
WHERE event_type  = 'helpdesk.query.sla_breached'
  AND process_id  = 'helpdesk_query_lifecycle';
