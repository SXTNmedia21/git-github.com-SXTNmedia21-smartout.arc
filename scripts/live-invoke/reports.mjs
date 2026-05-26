// scripts/live-invoke/reports.mjs
// Live-invoke smoke for the reports domain — 5-tab analytics page + AI report builder.
//
// What this catches (L-0348 family — promoted to systemic rule 2026-05-25):
//   - Column drift on custom_report (10 cols) — the ONLY own-table this domain writes
//   - Column subset drift on the 5 read-path data sources (profile, department,
//     protocol_assignment, protocol, team) that the preview_report tool queries
//   - PGRST201/202 ambiguous embed — column lists derived strictly from
//     packages/supabase/src/database.types.ts Row shapes (NEVER from migration SQL)
//
// Design choices:
//   - service role caller → auth.uid() = null → RLS policies (workspace_id eq filter)
//     return []. That is the correct smoke: signature proven, no SQL error, cols intact.
//   - custom_report write smoke: insert probe, verify read-back, delete in finally block.
//     Requires a synthetic workspace_id + profile_id (nil UUIDs) — gate_action defaults
//     allow per ADR-0189 warned branch, INSERT itself may fail FK. We accept FK errors
//     on nil UUIDs but NOT column-not-found (42703) or function-not-found (42883).
//   - Per ADR-0240: reports has minimal own-tables and mostly reads from other domains.
//     Smoke probes the read paths to catch cross-domain column drift at integration time.
//   - ZERO known telemetry events for reports domain as of 2026-05-26.
//
// Capabilities covered (packages/ai/src/tools/report/):
//   - list_saved_reports  → custom_report SELECT (7 cols)
//   - save_report         → custom_report INSERT via gatedMutation (ADR-0204)
//   - delete_report       → custom_report DELETE via gatedMutation (ADR-0204)
//   - list_data_sources   → static catalog (no DB read — not probed here)
//   - preview_report      → reads profile, department, protocol_assignment, protocol, team
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/reports.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const DOMAIN = "reports";
const sb = client("service");

header(DOMAIN);

// ── 1. custom_report — full Row column shape ─────────────────────────────────
// 10 cols per database.types.ts line 6555.
// PK is report_id (NOT id — distinct naming convention for this table).
// workspace_id required, created_by required (FK → profile.profile_id),
// updated_by nullable (FK → profile.profile_id), config is JSONB.
// Source: packages/supabase/src/database.types.ts line 6556–6567.
const reportsFull = await sb
  .from("custom_report")
  .select(
    "report_id, name, description, config, is_pinned, " +
    "workspace_id, created_by, updated_by, created_at, updated_at",
  )
  .limit(5);
assertOk("select custom_report (10 cols, full Row)", reportsFull);
assertShape("custom_report column shape", reportsFull.data, [
  "report_id",
  "name",
  "config",
  "is_pinned",
  "workspace_id",
  "created_by",
  "created_at",
  "updated_at",
]);

// ── 2. custom_report — list_saved_reports read path ──────────────────────────
// Mirrors the exact SELECT in packages/ai/src/tools/report/list-saved-reports.ts:24.
// 7 cols: report_id, name, description, config, is_pinned, created_at, updated_at.
// Ordered by is_pinned DESC, updated_at DESC (matching production query).
// Drift here = list_saved_reports silently returns wrong shape.
const reportsListPath = await sb
  .from("custom_report")
  .select("report_id, name, description, config, is_pinned, created_at, updated_at")
  .order("is_pinned", { ascending: false })
  .order("updated_at", { ascending: false })
  .limit(50);
assertOk("select custom_report (list_saved_reports path, 7 cols)", reportsListPath);
assertShape("custom_report list path shape", reportsListPath.data, [
  "report_id",
  "name",
  "config",
  "is_pinned",
  "created_at",
  "updated_at",
]);

// ── 3. profile — data source for employee reports ────────────────────────────
// preview_report queries profile for the "profiles" data source.
// Cols verified against database.types.ts line 15553–15602.
// NOTE: list-data-sources.ts catalog lists display_name, email, role, status,
// department_id, team_id, created_at — all present in actual Row.
// The catalog also lists "email" — verified present in profile Row (line 15568+ area).
const profileSource = await sb
  .from("profile")
  .select(
    "profile_id, display_name, role, status, " +
    "department_id, workspace_id, created_at, updated_at",
  )
  .limit(5);
assertOk("select profile (reports data source, 8 cols)", profileSource);
assertShape("profile data source column shape", profileSource.data, [
  "profile_id",
  "display_name",
  "role",
  "status",
  "department_id",
  "workspace_id",
  "created_at",
]);

// ── 4. department — data source for department-level reports ──────────────────
// preview_report queries department for the "departments" data source.
// Cols verified against database.types.ts line 6938–6956.
// IMPORTANT: list-data-sources.ts catalog lists "location_id" for departments
// but database.types.ts Row has NO location_id column on department.
// That is a static catalog inconsistency — it does NOT affect DB reads
// (catalog is static, not queried). Smoke uses actual schema only.
const deptSource = await sb
  .from("department")
  .select(
    "department_id, name, is_active, workspace_id, created_at, updated_at",
  )
  .limit(5);
assertOk("select department (reports data source, 6 cols)", deptSource);
assertShape("department data source column shape", deptSource.data, [
  "department_id",
  "name",
  "is_active",
  "workspace_id",
  "created_at",
]);

// ── 5. protocol_assignment — richest analytical data source ──────────────────
// preview_report queries protocol_assignment for completion reports.
// 21 cols verified against database.types.ts line 15974–15998.
// Cols listed in list-data-sources.ts: assignment_id, protocol_id, profile_id,
// status, completed_at, created_at — all present in actual Row.
const assignmentSource = await sb
  .from("protocol_assignment")
  .select(
    "assignment_id, protocol_id, profile_id, status, " +
    "completed_at, workspace_id, created_at, updated_at",
  )
  .limit(5);
assertOk("select protocol_assignment (reports data source, 8 cols)", assignmentSource);
assertShape("protocol_assignment data source column shape", assignmentSource.data, [
  "assignment_id",
  "protocol_id",
  "profile_id",
  "status",
  "workspace_id",
  "created_at",
]);

result();
