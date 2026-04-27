-- Cascade D1 completion (part 2 of 2): derive schedule_shift.department_id from position on write
--
-- Pairs with 20260519000000_schedule_shift_dept_backfill.sql. The backfill
-- fixed existing rows; this trigger keeps the invariant true for future
-- INSERTs and UPDATEs that change position_id.
--
-- Design notes:
--   • Trigger fires BEFORE INSERT OR UPDATE OF position_id — an UPDATE that
--     clears department_id without touching position_id is respected (user
--     intent preserved). Only a position change carries new department context.
--   • department_id is only derived when NULL — never overwrites an explicit value.
--   • ON DELETE SET NULL on department_id FK is preserved (migration
--     20260421100350 set this); orphaned shifts after dept deletion keep
--     position_id intact so re-derivation still works on next UPDATE.

CREATE OR REPLACE FUNCTION schedule_shift_derive_department_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.department_id IS NULL AND NEW.position_id IS NOT NULL THEN
    SELECT department_id INTO NEW.department_id
    FROM position
    WHERE position_id = NEW.position_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schedule_shift_derive_department_id_tg ON schedule_shift;

CREATE TRIGGER schedule_shift_derive_department_id_tg
  BEFORE INSERT OR UPDATE OF position_id
  ON schedule_shift
  FOR EACH ROW
  EXECUTE FUNCTION schedule_shift_derive_department_id();

COMMENT ON FUNCTION schedule_shift_derive_department_id IS
  'Cascade D1: derives schedule_shift.department_id from position.department_id when NULL and position_id is set. Completes the "backfill from position" mandate documented on the column (migration 20260421100350).';
