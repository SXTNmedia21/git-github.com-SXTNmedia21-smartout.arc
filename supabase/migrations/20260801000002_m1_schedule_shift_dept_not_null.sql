-- Migration M1: schedule_shift.department_id NOT NULL + backfill from position
-- ADR-0430 Rule 2 — closes L-0064 Class-B workaround path.
-- Backfills department_id from position.department_id for any remaining NULLs,
-- then promotes the column to NOT NULL. PLAN-0 AC-0.6 verified 0 orphan rows;
-- this backfill is a belt-and-suspenders guard that still fires on dev seeds.

BEGIN;

-- Disable temporal-lock trigger for the duration of this migration.
-- The trigger (enforce_schedule_shift_temporal_lock) blocks planning-field mutations
-- on past-dated or active shifts — it is designed for application-layer writes, not
-- schema migrations. We re-enable it at the end of this transaction.
ALTER TABLE public.schedule_shift DISABLE TRIGGER trg_schedule_shift_temporal_lock;

-- Step 1: backfill department_id from the linked position row
UPDATE public.schedule_shift s
SET department_id = p.department_id
FROM public.position p
WHERE s.position_id = p.position_id
  AND s.department_id IS NULL
  AND p.department_id IS NOT NULL;

-- Step 2: backfill shifts with NULL position_id via role → department lookup
-- These are legacy fixture shifts (ad-hoc or pre-position-registry era) that have
-- no position_id but can be mapped to a department via their role text.
-- This lookup is fixture-aware: maps Norwegian hospitality roles to the known
-- HQ Workspace department UUIDs. Production workspaces will have backfilled from
-- position in Step 1; this step handles seed data only.
DO $$
DECLARE
  role_to_dept_map JSONB := '{
    "Kokk":         "d0000000-0000-0000-0000-000000000001",
    "Sous Chef":    "d0000000-0000-0000-0000-000000000001",
    "Hovmester":    "d0000000-0000-0000-0000-000000000002",
    "Servitor":     "d0000000-0000-0000-0000-000000000002",
    "Servitør":     "d0000000-0000-0000-0000-000000000002",
    "Bartender":    "d0000000-0000-0000-0000-000000000003",
    "Daglig leder": "d0000000-0000-0000-0000-000000000000"
  }'::JSONB;
  r RECORD;
  mapped_dept_id UUID;
BEGIN
  FOR r IN
    SELECT DISTINCT role FROM public.schedule_shift
    WHERE department_id IS NULL AND position_id IS NULL
  LOOP
    mapped_dept_id := (role_to_dept_map ->> r.role)::UUID;
    IF mapped_dept_id IS NOT NULL THEN
      UPDATE public.schedule_shift
      SET department_id = mapped_dept_id
      WHERE department_id IS NULL
        AND position_id IS NULL
        AND role = r.role;
      RAISE NOTICE 'M1 role-fallback: mapped role "%" → department %', r.role, mapped_dept_id;
    ELSE
      RAISE NOTICE 'M1 role-fallback: no mapping for role "%" — rows remain NULL', r.role;
    END IF;
  END LOOP;
END $$;

-- Step 3: fail-fast if any NULLs remain after both backfill passes
-- (position orphans OR unmapped roles)
DO $$
DECLARE
  null_count int;
BEGIN
  SELECT count(*) INTO null_count
  FROM public.schedule_shift
  WHERE department_id IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION
      'M1 blocked: schedule_shift has % rows with NULL department_id after both backfill passes — '
      'check for unmapped roles or position orphans',
      null_count;
  END IF;
END $$;

-- Step 4: promote to NOT NULL
ALTER TABLE public.schedule_shift
  ALTER COLUMN department_id SET NOT NULL;

-- Re-enable the temporal-lock trigger now that backfill is complete.
ALTER TABLE public.schedule_shift ENABLE TRIGGER trg_schedule_shift_temporal_lock;

COMMIT;
