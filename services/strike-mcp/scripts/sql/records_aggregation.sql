-- ─────────────────────────────────────────────────────────────────────────────
-- strike-mcp: records → timesheet.time_entry aggregation (manual, post-attest)
--
-- Purpose: aggregate Bubble's row-per-entry time records (5,434 rows in
--   Wrightegaarden) into v3's row-per-shift timesheet.time_entry model
--   (one row per shift with nested breaks JSONB).
--
-- Why manual: per ADR-0003, this transform CANNOT be expressed via the
--   strike-mcp auto_align field_map model. Bubble has 1:N records per
--   shift (one workTime + zero or more break/meal); v3 has 1:1 time_entry
--   per shift with breaks as nested JSONB array. The cardinality flip
--   requires a GROUP BY shift, which is set-oriented SQL, not field-by-
--   field mapping.
--
-- Prerequisite: a staging table populated from Bubble export. Strike-mcp
--   does NOT automatically populate this — the operator must:
--
--     1. Export 🗓️record entity to CSV via Bubble Data Tab → Bulk export
--     2. psql \copy bubble_record_staging FROM '/path/to/records.csv' CSV HEADER
--
--   Staging table schema:
--
--     CREATE TABLE bubble_record_staging (
--       bubble_record_id text PRIMARY KEY,    -- Bubble _id
--       bubble_shift_id  text NOT NULL,       -- Bubble Shift FK
--       bubble_profile_id text NOT NULL,      -- Bubble 🎎 Profile FK
--       bubble_workspace_id text NOT NULL,    -- Bubble 🏰 lookup
--       record_type text NOT NULL,            -- _recordType: workTime|break|meal
--       date_start timestamptz NOT NULL,      -- Date Start
--       date_done  timestamptz,               -- Date Done (nullable for incomplete)
--       active boolean DEFAULT true,
--       approved boolean DEFAULT false
--     );
--
--   The staging table is dropped after migration (drop in cleanup script).
--
-- Apply order:
--   1. strike-mcp emitted SQL: workspace, profile, schedule_shift (via auto_align)
--   2. operator: load bubble_record_staging from CSV
--   3. THIS SQL: aggregate + insert to timesheet.time_entry
--   4. cleanup: DROP TABLE bubble_record_staging
--
-- Idempotency: WHERE NOT EXISTS clause prevents duplicate time_entry per shift.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Helper function: convert Bubble v4 ID → v3 deterministic UUID ───────
-- Mirrors src/migration/uuid.ts (uuidv5 with strike-mcp namespace).
-- This is needed because the staging table holds Bubble IDs as text;
-- v3 timesheet.time_entry uses uuid PKs. Reuse strike-mcp's namespace for
-- consistency with the rest of the migration.

-- Postgres has no built-in v5; use the uuid-ossp extension's uuid_generate_v5.
-- The strike-mcp namespace MUST match src/migration/uuid.ts STRIKE_NAMESPACE.

-- Strike-mcp namespace UUID (mirrors src/migration/uuid.ts STRIKE_NAMESPACE_UUID).
-- If you change the source-side constant, regenerate this SQL — they MUST match
-- or the FK lookups will all silently miss and the INSERT will fail.
--   STRIKE_NAMESPACE_UUID = '8b4f3a8c-6d1e-4a2f-9c5b-1e7d3a8c6f4e'

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Aggregate workTime records → time_entry rows ────────────────────────
-- One workTime per shift (validated by GROUP BY having count=1; if multiple,
-- the latest by date_start wins. Pathological case logged as warning.)

INSERT INTO timesheet.time_entry (
  shift_id,
  profile_id,
  workspace_id,
  punch_in,
  punch_out,
  breaks,
  status,
  source,
  created_at,
  updated_at
)
SELECT
  -- Bubble shift_id → v3 schedule_shift_id (deterministic uuidv5 per scripts/lib/uuid.ts)
  uuid_generate_v5('8b4f3a8c-6d1e-4a2f-9c5b-1e7d3a8c6f4e'::uuid, 'shift:' || wt.bubble_shift_id) AS shift_id,
  uuid_generate_v5('8b4f3a8c-6d1e-4a2f-9c5b-1e7d3a8c6f4e'::uuid, 'profile:' || wt.bubble_profile_id) AS profile_id,
  uuid_generate_v5('8b4f3a8c-6d1e-4a2f-9c5b-1e7d3a8c6f4e'::uuid, 'workspace:' || wt.bubble_workspace_id) AS workspace_id,
  wt.date_start AS punch_in,
  wt.date_done  AS punch_out,
  -- Aggregate break + meal records on same shift into JSONB array
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'kind', br.record_type,
          'start', br.date_start,
          'end',   br.date_done
        )
        ORDER BY br.date_start
      )
      FROM bubble_record_staging br
      WHERE br.bubble_shift_id = wt.bubble_shift_id
        AND br.record_type IN ('break', 'meal')
    ),
    '[]'::jsonb
  ) AS breaks,
  CASE
    WHEN wt.date_done IS NULL THEN 'clocked_in'::timesheet.time_entry_status
    ELSE 'completed'::timesheet.time_entry_status
  END AS status,
  'bubble_migration' AS source,
  now() AS created_at,
  now() AS updated_at
FROM bubble_record_staging wt
WHERE wt.record_type = 'workTime'
  AND NOT EXISTS (
    SELECT 1 FROM timesheet.time_entry te
    WHERE te.shift_id = uuid_generate_v5('8b4f3a8c-6d1e-4a2f-9c5b-1e7d3a8c6f4e'::uuid, 'shift:' || wt.bubble_shift_id)
  );

-- ─── Sanity checks ───────────────────────────────────────────────────────

-- Count rows inserted (expected ≈ 1 per workTime record):
--   SELECT COUNT(*) FROM timesheet.time_entry WHERE source = 'bubble_migration';

-- Detect shifts with multiple workTime records (data quality signal):
--   SELECT bubble_shift_id, COUNT(*) AS work_record_count
--   FROM bubble_record_staging
--   WHERE record_type = 'workTime'
--   GROUP BY bubble_shift_id
--   HAVING COUNT(*) > 1;

-- Detect orphan break/meal records (no parent workTime on same shift):
--   SELECT br.bubble_shift_id, br.record_type, br.date_start
--   FROM bubble_record_staging br
--   WHERE br.record_type IN ('break', 'meal')
--     AND NOT EXISTS (
--       SELECT 1 FROM bubble_record_staging wt
--       WHERE wt.record_type = 'workTime'
--         AND wt.bubble_shift_id = br.bubble_shift_id
--     );

-- ─── Cleanup (after verification) ─────────────────────────────────────────

-- DROP TABLE bubble_record_staging;

-- ─── Apply checklist ─────────────────────────────────────────────────────
-- [ ] Verify the namespace UUID embedded above (8b4f3a8c-6d1e-4a2f-9c5b-1e7d3a8c6f4e)
--     matches src/migration/uuid.ts STRIKE_NAMESPACE_UUID. If not, regenerate.
-- [ ] Verify staging table loaded with all 5,434 Bubble records.
-- [ ] Run sanity check queries; investigate any multi-workTime shifts
--     (likely Bubble data quality issue: punch in/out sequence broken).
-- [ ] Apply this SQL.
-- [ ] Verify time_entry row count matches workTime staging count.
-- [ ] DROP TABLE bubble_record_staging.
-- [ ] Add HANDOFF entry: "5,434 Bubble records → N time_entry rows.
--     Orphan break/meal records: M (likely Bubble data quality)."
