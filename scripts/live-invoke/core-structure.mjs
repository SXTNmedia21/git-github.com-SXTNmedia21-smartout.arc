// scripts/live-invoke/core-structure.mjs
// Live-invoke smoke for the core-structure domain (D1 Envelope in cascade model).
//
// What this catches (L-0348 family):
//   - Column drift on department, location, department_operating_hours,
//     department_hours_override, planning_cycle, position, workspace_operating_hours
//   - PK naming: department_id, location_id, position_id, planning_cycle_id, zone_id
//     (these differ from the generic "id" pattern used by DOH/WHO override tables)
//   - The L-0348 trap: department_operating_hours uses `id` (not `department_operating_hours_id`),
//     has NO `operating_hours_id`, and had NO workspace_id on framework_rule (K1a platform)
//   - Column list derived from packages/supabase/src/database.types.ts Row shapes ONLY
//     (never from migration SQL — that's the L-0348 root cause)
//
// Capabilities covered:
//   - D1 Envelope reads used by cascade scheduler (packages/ai/src/capabilities/scheduler/)
//   - Department/location lookups used by turnus tools (packages/ai/src/capabilities/turnus/)
//   - workspace_operating_hours fallback path (when dept has no hours configured)
//
// Caller identity = service role → RLS not in scope here (column/signature smoke only).
// Empty result = OK — we are proving schema, not data presence.
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/core-structure.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("core-structure");

// ── 1. department — D1 Envelope anchor ────────────────────────────────────────
// 16 cols from database.types.ts Row (line 6939). PK = department_id (not id).
// Key traps caught by L-0348 class: slug, source, classification_confidence cols
// exist but are easy to forget; manager_profile_id nullable FK.
const departments = await sb
  .from("department")
  .select(
    "department_id, workspace_id, name, slug, source, " +
    "description, icon, color, is_active, sort_order, " +
    "department_type, manager_profile_id, " +
    "classification_confidence, classification_source, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("select department (16 cols)", departments);
assertShape("department column shape", departments.data, [
  "department_id",
  "workspace_id",
  "name",
  "slug",
  "source",
  "is_active",
  "created_at",
  "updated_at",
]);

// ── 2. location — physical location anchor ────────────────────────────────────
// 16 cols from database.types.ts Row (line 12435). PK = location_id (not id).
// Note: no department_id here — the join is via department_location table.
const locations = await sb
  .from("location")
  .select(
    "location_id, workspace_id, name, slug, source, " +
    "description, address, floor, location_type, " +
    "is_active, sort_order, capacity, " +
    "latitude, longitude, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("select location (16 cols)", locations);
assertShape("location column shape", locations.data, [
  "location_id",
  "workspace_id",
  "name",
  "slug",
  "location_type",
  "is_active",
  "created_at",
  "updated_at",
]);

// ── 3. department_operating_hours — D1 weekly schedule template ───────────────
// 15 cols from database.types.ts Row (line 7173). PK = id (NOT department_operating_hours_id).
// L-0348 TRAP: historically accessed as `operating_hours` (wrong table name).
// Also: no `name` column, provenance is Json type (not string).
const doh = await sb
  .from("department_operating_hours")
  .select(
    "id, workspace_id, department_id, location_id, season_id, " +
    "day_of_week, open_time, close_time, " +
    "open_offset_minutes, close_offset_minutes, " +
    "is_closed, is_derived, provenance, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("select department_operating_hours (15 cols, PK=id)", doh);
assertShape("department_operating_hours column shape", doh.data, [
  "id",
  "workspace_id",
  "department_id",
  "day_of_week",
  "is_closed",
  "created_at",
  "updated_at",
]);

// ── 4. department_hours_override — per-date exception ────────────────────────
// 13 cols from database.types.ts Row (line 7022). PK = id (not override_id).
// Used for public holidays, seasonal closures, one-off date overrides.
const overrides = await sb
  .from("department_hours_override")
  .select(
    "id, workspace_id, department_id, location_id, season_id, " +
    "planning_event_id, override_date, " +
    "open_time, close_time, is_closed, reason, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("select department_hours_override (13 cols, PK=id)", overrides);
assertShape("department_hours_override column shape", overrides.data, [
  "id",
  "workspace_id",
  "department_id",
  "override_date",
  "is_closed",
  "created_at",
  "updated_at",
]);

// ── 5. planning_cycle — D1 planning envelope ─────────────────────────────────
// 10 cols from database.types.ts Row (line 13727). PK = planning_cycle_id.
// Drives week-template and turnus period boundaries.
const cycles = await sb
  .from("planning_cycle")
  .select(
    "planning_cycle_id, workspace_id, " +
    "name, status, " +
    "start_date, end_date, " +
    "total_revenue_target, " +
    "created_by, created_at, updated_at",
  )
  .limit(1);
assertOk("select planning_cycle (10 cols)", cycles);
assertShape("planning_cycle column shape", cycles.data, [
  "planning_cycle_id",
  "workspace_id",
  "name",
  "status",
  "start_date",
  "end_date",
  "created_at",
  "updated_at",
]);

// ── 6. position — role slot within a department ───────────────────────────────
// 16 cols from database.types.ts Row (line 15011). PK = position_id.
// Note: position is per-department (department_id FK), NOT per-person per CLAUDE.md.
// skill_requirements is Json nullable.
const positions = await sb
  .from("position")
  .select(
    "position_id, workspace_id, department_id, " +
    "name, slug, description, icon, color, " +
    "is_active, sort_order, minimum_role, " +
    "profession_id, season_id, skill_requirements, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("select position (16 cols)", positions);
assertShape("position column shape", positions.data, [
  "position_id",
  "workspace_id",
  "department_id",
  "name",
  "slug",
  "is_active",
  "created_at",
  "updated_at",
]);

// ── 7. workspace_operating_hours — fallback hours when dept has no config ─────
// 8 cols from database.types.ts Row (line 21755). PK = id.
// Fallback used by scheduler when department_operating_hours has no rows
// for a given day. Note: is_closed is boolean | null (nullable, unlike dept hours).
const woh = await sb
  .from("workspace_operating_hours")
  .select(
    "id, workspace_id, " +
    "day_of_week, open_time, close_time, is_closed, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("select workspace_operating_hours (8 cols, PK=id)", woh);
assertShape("workspace_operating_hours column shape", woh.data, [
  "id",
  "workspace_id",
  "day_of_week",
  "is_closed",
  "created_at",
  "updated_at",
]);

result();
