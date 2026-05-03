-- Cascade D1 completion: backfill schedule_shift.department_id from position.department_id
--
-- Migration 20260421100350 added schedule_shift.department_id as a "direct FK
-- (backfill from position)" but never ran the backfill. Result: every row
-- where department_id was NULL at insert time stayed NULL, silently breaking:
--   • RosterTab empty state (use-roster.ts filters .eq("department_id", ...))
--   • Shift-clock chat session resolution (ShiftClockView.tsx early-returns on NULL)
--   • Manager notification outbox (useShiftClock.ts:251 skips notifyDepartmentManagers)
--
-- This is the backfill half. The trigger half lives in
-- 20260520170002_schedule_shift_dept_trigger.sql and keeps it true going forward.
--
-- Split per L-0075 (migration atomicity 0a/0b): data migration and schema
-- change in separate files so each can fail/rollback independently.
--
-- Two-tier backfill:
--   Tier 1 — via position.department_id (preferred, explicit shift-level intent)
--   Tier 2 — via profile.department_id (fallback, employee's home department)
-- Tier 1 runs first so shifts with both position_id and employee_id get the
-- position-derived dept (closer to the shift's actual intent); tier 2 only
-- catches rows that tier 1 left untouched.
--
-- `session_replication_role = replica` bypasses user-defined triggers for the
-- duration of this transaction. Necessary because
-- `enforce_schedule_shift_temporal_lock` (migration 20260428133000) blocks any
-- change to department_id on past/started shifts — correct behavior for user
-- mutations, but this backfill is schema-hygiene (NULL → derived truth), not a
-- business change. `SET LOCAL` auto-reverts at COMMIT.

SET LOCAL session_replication_role = replica;

-- Tier 1: position-derived
UPDATE schedule_shift ss
SET department_id = p.department_id
FROM position p
WHERE ss.position_id = p.position_id
  AND ss.department_id IS NULL
  AND ss.position_id IS NOT NULL;

-- Tier 2: profile-derived fallback (for legacy rows without position_id)
UPDATE schedule_shift ss
SET department_id = pr.department_id
FROM profile pr
WHERE ss.employee_id = pr.profile_id
  AND ss.department_id IS NULL
  AND pr.department_id IS NOT NULL;
