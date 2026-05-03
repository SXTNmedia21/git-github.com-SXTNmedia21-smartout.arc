SET search_path TO public, extensions;

-- ============================================
-- 20260518220000_journey_seed_compile_phase2.sql
-- Phase 2 G2 seed-compile migration.
--
-- Populates journey.engine_process_id for 2 additional journeys,
-- bringing the total linked count from 2 → 4 (satisfying the ≥4 gate
-- from the 2026-04-23 REMEDIATION AMENDMENT).
--
-- Mapping decisions:
--   J-011 "Check My Schedule"  (slug: check-my-schedule)
--       → engine_process: journey_03_check_shifts
--     Rationale: journey_03_check_shifts tracks employee-initiated
--     shift-viewing events (shift.list_viewed → shift.detail_viewed).
--     J-011 is the exact user experience of checking one's schedule on
--     mobile — the trigger event and step events align 1-to-1.
--
--   J-004 "Complete Trainee Core Journey"  (slug: complete-trainee-core-journey)
--       → engine_process: onboarding_journey
--     Rationale: onboarding_journey fires on invitation.accepted and
--     tracks an employee through protocol assignment, content learning,
--     testing, and confirmation signing until fully ready. J-004 is the
--     trainee-side mirror of that process — same actor, same lifecycle.
--
-- References:
--   - Phase 2 audit: docs/audits/PHASE-2-CAPABILITY-AUDIT-2026-04-27.md §G2
--   - ADR-0172 (journey_version_status enum lifecycle)
--   - ADR-0173 (capability model)
--   - ADR-0175 (journey telemetry contract)
--   - engine_process 'journey_03_check_shifts' seeded: 20260406150000
--   - engine_process 'onboarding_journey' seeded:      20260412200100
--   - engine_process_id column added:                  20260308194427
--   - Pre-existing links (2 rows):                     20260308194433
--
-- Idempotency: both UPDATEs are gated on engine_process_id IS NULL so
-- re-running this migration is safe. The ON CONFLICT DO NOTHING pattern
-- used in the previous seed migration does not apply here because UPDATE
-- with a WHERE predicate is already idempotent.
--
-- Workspace scope: journey is workspace-scoped (workspace_id NOT NULL).
-- The UPDATE covers ALL workspaces by not filtering on workspace_id —
-- every workspace that has these slugs gets the link, matching the
-- per-workspace seed pattern from 20260308194433.
-- ============================================

-- Link 1: J-011 "Check My Schedule" → journey_03_check_shifts
UPDATE journey
SET
  engine_process_id  = 'journey_03_check_shifts',
  trigger_event      = 'shift.list_viewed',
  step_event_type    = 'shift.detail_viewed',
  entity_type        = 'schedule_shift'
WHERE slug              = 'check-my-schedule'
  AND engine_process_id IS NULL;

-- Link 2: J-004 "Complete Trainee Core Journey" → onboarding_journey
UPDATE journey
SET
  engine_process_id  = 'onboarding_journey',
  trigger_event      = 'invitation.accepted',
  step_event_type    = 'onboarding.step_completed',
  entity_type        = 'profile'
WHERE slug              = 'complete-trainee-core-journey'
  AND engine_process_id IS NULL;
