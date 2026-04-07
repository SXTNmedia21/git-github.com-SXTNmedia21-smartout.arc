SET search_path TO public, extensions;

-- ============================================
-- 20260406150000_journey_03_poc_seed.sql
-- Seeds the Journey 03 (Sjekke vakter) PoC engine_process,
-- engine_step rows, and engine_trigger.
-- See: docs/superpowers/specs/2026-04-06-journey-harness-poc-instruction.md
--
-- IMPORTANT: action_payload uses key `event` (NOT `event_type`).
-- Verified at engine-dispatch/index.ts:411:
--   (currentStep.action_payload as Record<string, unknown>)?.event === event_type
--
-- Convention cross-check: seed_daily_close_process.sql:71 also uses `event`.
-- ============================================

-- ── Process ────────────────────────────────────────────────

INSERT INTO engine_process (id, name, description) VALUES
('journey_03_check_shifts', 'Journey 03 — Sjekke vakter',
 'PoC: tracks employee progress through opening shifts list and viewing a shift detail. Two wait_for_event steps. Stuck on step 1 >24h triggers guardian_signal.')
ON CONFLICT (id) DO NOTHING;

-- ── Steps ──────────────────────────────────────────────────
-- Step 1: Wait for the user to open the shifts list. The same event that
-- creates the engine_state via the trigger below also matches step 1's
-- wait_for_event payload, so step 1 advances immediately and step 2 enters
-- 'waiting' for shift.detail_viewed.

INSERT INTO engine_step (process_id, step_order, action_type, action_payload, assignee_rule) VALUES
('journey_03_check_shifts', 1, 'wait_for_event', '{
  "event": "shift.list_viewed",
  "description": "Employee opened the shifts list page"
}'::jsonb, NULL),

('journey_03_check_shifts', 2, 'wait_for_event', '{
  "event": "shift.detail_viewed",
  "description": "Employee tapped a specific shift to see details"
}'::jsonb, NULL)
ON CONFLICT (process_id, step_order) DO NOTHING;

-- ── Trigger ────────────────────────────────────────────────
-- ONE trigger on shift.list_viewed (dot form). When this event arrives,
-- engine-dispatch creates an engine_state with entity_type/entity_id from
-- the payload, then immediately runs step 1 which matches the same event
-- and advances to step 2 (waiting for shift.detail_viewed).

INSERT INTO engine_trigger (event_type, process_id, condition, is_active)
SELECT 'shift.list_viewed', 'journey_03_check_shifts', NULL, true
WHERE NOT EXISTS (
  SELECT 1 FROM engine_trigger
  WHERE event_type = 'shift.list_viewed' AND process_id = 'journey_03_check_shifts'
);

COMMENT ON COLUMN engine_process.id IS
  'Process ID. Use snake_case. journey_03_check_shifts is the PoC for the Journey Harness.';
