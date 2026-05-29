-- schema-precondition-checks.sql
-- ADR-0430 Phase b — PLAN-0 pre-flight schema queries
-- Executed: 2026-05-28
-- Run with: docker exec supabase_db_smartout.ai psql -U postgres -d postgres -f <path>
-- All queries are READ-ONLY (SELECT / information_schema lookups).

-- ============================================================
-- AC-0.5  Pre-2 — Verify composite PK on shift_session_day_line
-- Expected: 1 row for shift_session_day_line_pkey
-- Columns: (shift_session_id, day_line_id)
-- ============================================================
SELECT conname
FROM pg_constraint
WHERE conrelid = 'shift_session_day_line'::regclass
  AND contype = 'p';

-- Get the actual PK column names and ordinal positions:
SELECT kcu.column_name, kcu.ordinal_position
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'shift_session_day_line'
ORDER BY kcu.ordinal_position;

-- ============================================================
-- AC-0.6  M0.5 — Position-orphan reconciliation
-- Expected: 0 rows (no orphans)
-- Note: schedule_shift PK = schedule_shift_id; position PK = position_id
-- ============================================================
SELECT s.schedule_shift_id, s.position_id
FROM schedule_shift s
LEFT JOIN position p ON s.position_id = p.position_id
WHERE s.department_id IS NULL
  AND s.position_id IS NOT NULL
  AND p.department_id IS NULL;

-- ============================================================
-- AC-0.8  Pre-5 — pg_depend audit (normal dependencies on schedule_shift)
-- Expected: classified output — see pg-depend-audit.txt
-- ============================================================
SELECT
  dep.classid::regclass::text AS dep_class,
  dep.deptype,
  CASE dep.classid::regclass::text
    WHEN 'pg_constraint' THEN (SELECT conname FROM pg_constraint WHERE oid = dep.objid)
    WHEN 'pg_rewrite'    THEN (SELECT ev_class::regclass::text || ' (view rule)' FROM pg_rewrite WHERE oid = dep.objid)
    WHEN 'pg_trigger'    THEN (SELECT tgname FROM pg_trigger WHERE oid = dep.objid)
    WHEN 'pg_policy'     THEN (SELECT polname FROM pg_policy WHERE oid = dep.objid)
    ELSE dep.objid::text
  END AS dependent_name,
  dep.refobjsubid AS ref_col_num,
  a.attname AS ref_column
FROM pg_depend dep
JOIN pg_class c ON c.oid = dep.refobjid AND c.relname = 'schedule_shift'
LEFT JOIN pg_attribute a ON a.attrelid = dep.refobjid AND a.attnum = dep.refobjsubid
WHERE dep.refobjid = 'schedule_shift'::regclass::oid
  AND dep.deptype = 'n'
ORDER BY dep.classid, dep.objid;

-- ============================================================
-- AC-0.9  Pre-6 — Verify engine_authority_config.channel_constraint
-- Expected: 1 row if present; 0 rows = BLOCKER (migration required)
-- ============================================================
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'engine_authority_config'
  AND column_name = 'channel_constraint';

-- ============================================================
-- AC-0.10 Pre-7 — Verify UNIQUE constraints on zone(id, location_id)
--                  and day_line(id, location_id)
-- Expected: unique index covering (zone_id, location_id) on zone
--           and (day_line_id, location_id) on day_line
-- ============================================================
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('zone', 'day_line')
ORDER BY tablename, indexname;

-- Full columns on engine_authority_config (AC-0.9 context):
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'engine_authority_config'
ORDER BY ordinal_position;
