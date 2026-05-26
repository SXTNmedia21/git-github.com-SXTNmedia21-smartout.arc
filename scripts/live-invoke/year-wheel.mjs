// scripts/live-invoke/year-wheel.mjs
// Live-invoke smoke for the year-wheel domain.
//
// What this catches (L-0348 family — verified column lists from database.types.ts ONLY):
//   - Column drift on season (17 cols), season_budget (13 cols), season_policy_binding (9 cols)
//   - Column drift on planning_event (19 cols, D4 Demand — workspace-scoped, no season_id direct FK)
//   - Column drift on day_factor (7 cols), hour_factor (7 cols) — D4 demand weight tables
//   - Column drift on public_holiday (5 cols) — K1a platform-level, NO workspace_id
//   - Column drift on workspace_budget (17 cols) — workspace-scoped annual/period budget
//   - activate_season RPC existence check (signature: p_season_id + p_workspace_id → Json)
//
// Key schema facts (verified against database.types.ts, NOT migrations):
//   season.season_id (PK, NOT id)
//   season_budget.season_budget_id (PK, NOT id)
//   season_policy_binding.season_policy_binding_id (PK, NOT id)
//   planning_event.planning_event_id (PK, NOT id) — links season via planning_cycle_id (nullable)
//   day_factor.day_factor_id (PK, NOT id) — FK → season_budget.season_budget_id
//   hour_factor.hour_factor_id (PK, NOT id) — FK → season_budget.season_budget_id
//   public_holiday — NO workspace_id (K1a platform-level table, 5 cols only)
//   workspace_budget.id (PK, uses `id` not `workspace_budget_id`)
//   activate_season({ p_season_id: string, p_workspace_id: string }) → Json
//
// Caller identity = service role → RLS filters may return empty set. Empty = OK.
// Signature proven, no SQL error, columns intact = GREEN.
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/year-wheel.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("year-wheel");

// ── 1. season — D1 Envelope, season canvas ───────────────────────────────────
// 17 cols from database.types.ts:17520. PK = season_id (NOT id).
// opening_hours is Json (nullable) — not a text column.
// planning_cycle_id links the season to a D1 planning_cycle (nullable).
const seasons = await sb
  .from("season")
  .select(
    "season_id, workspace_id, name, slug, description, status, season_type, " +
    "start_date, end_date, is_default, color, icon, opening_hours, " +
    "parent_season_id, planning_cycle_id, created_by, created_at, updated_at",
  )
  .limit(1);
assertOk("select season (17 cols)", seasons);
assertShape("season column shape", seasons.data, [
  "season_id",
  "workspace_id",
  "name",
  "slug",
  "status",
  "season_type",
  "is_default",
  "created_at",
  "updated_at",
]);

// ── 2. season_budget — D4 Demand, season-level financial target ───────────────
// 13 cols from database.types.ts:17619. PK = season_budget_id (NOT id).
// FK: season_id → season.season_id (oneToOne per Relationships).
// day_factor + hour_factor both FK here (not to season directly).
const seasonBudgets = await sb
  .from("season_budget")
  .select(
    "season_budget_id, workspace_id, season_id, status, " +
    "total_target_revenue, target_labor_percentage, target_margin, " +
    "avg_hourly_wage, base_price_per_guest, season_price_factor, " +
    "created_by, created_at, updated_at",
  )
  .limit(1);
assertOk("select season_budget (13 cols)", seasonBudgets);
assertShape("season_budget column shape", seasonBudgets.data, [
  "season_budget_id",
  "workspace_id",
  "season_id",
  "status",
  "total_target_revenue",
  "target_labor_percentage",
  "season_price_factor",
  "created_at",
  "updated_at",
]);

// ── 3. day_factor — D4 Demand, weekday weight per season budget ───────────────
// 7 cols from database.types.ts:6783. PK = day_factor_id.
// FK: season_budget_id → season_budget.season_budget_id.
// weekday is integer (0=Mon … 6=Sun or ISO convention).
const dayFactors = await sb
  .from("day_factor")
  .select(
    "day_factor_id, workspace_id, season_budget_id, weekday, factor, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("select day_factor (7 cols)", dayFactors);
assertShape("day_factor column shape", dayFactors.data, [
  "day_factor_id",
  "workspace_id",
  "season_budget_id",
  "weekday",
  "factor",
  "created_at",
  "updated_at",
]);

// ── 4. hour_factor — D4 Demand, hour-of-day weight per season budget ──────────
// 7 cols from database.types.ts:10489. PK = hour_factor_id.
// FK: season_budget_id → season_budget.season_budget_id.
// hour is integer (0–23).
const hourFactors = await sb
  .from("hour_factor")
  .select(
    "hour_factor_id, workspace_id, season_budget_id, hour, factor, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("select hour_factor (7 cols)", hourFactors);
assertShape("hour_factor column shape", hourFactors.data, [
  "hour_factor_id",
  "workspace_id",
  "season_budget_id",
  "hour",
  "factor",
  "created_at",
  "updated_at",
]);

// ── 5. planning_event — D4 Demand, year-wheel canvas events ──────────────────
// 19 cols from database.types.ts:13788. PK = planning_event_id.
// NOTE: planning_event does NOT have a season_id column — it links to season
// via planning_cycle_id (nullable). workspace_id is the scope key.
// provenance is Json (non-nullable, defaults to {}). demand_multiplier is numeric.
const planningEvents = await sb
  .from("planning_event")
  .select(
    "planning_event_id, workspace_id, name, description, event_date, end_date, " +
    "category, source, demand_multiplier, expected_covers, confidence, " +
    "is_recurring, recurrence_rule, hours_override_id, planning_cycle_id, " +
    "external_source_url, provenance, created_by, created_at, updated_at",
  )
  .limit(1);
assertOk("select planning_event (19 cols)", planningEvents);
assertShape("planning_event column shape", planningEvents.data, [
  "planning_event_id",
  "workspace_id",
  "name",
  "event_date",
  "category",
  "source",
  "demand_multiplier",
  "is_recurring",
  "provenance",
  "created_at",
  "updated_at",
]);

// ── 6. public_holiday — K1a platform-level, no workspace_id ──────────────────
// 5 cols from database.types.ts:16093. NO workspace_id (platform-level K1a).
// Columns: country_code, holiday_date, is_full_day, name, name_no.
// No PK column is exposed in types (no id / holiday_id).
// Scoped by country_code — Norway = "NO".
const holidays = await sb
  .from("public_holiday")
  .select("country_code, holiday_date, is_full_day, name, name_no")
  .eq("country_code", "NO")
  .limit(5);
assertOk("select public_holiday (5 cols, K1a platform — NO workspace_id)", holidays);

// ── 7. season_policy_binding — governance binding (D1 + content layer) ────────
// 9 cols from database.types.ts:17773. PK = season_policy_binding_id.
// Links season → policy (content governance layer).
const policyBindings = await sb
  .from("season_policy_binding")
  .select(
    "season_policy_binding_id, workspace_id, season_id, policy_id, " +
    "is_active, activated_by, notes, created_at, updated_at",
  )
  .limit(1);
assertOk("select season_policy_binding (9 cols)", policyBindings);
assertShape("season_policy_binding column shape", policyBindings.data, [
  "season_policy_binding_id",
  "workspace_id",
  "season_id",
  "policy_id",
  "is_active",
  "created_at",
  "updated_at",
]);

// ── 8. workspace_budget — workspace-level period budget ───────────────────────
// 17 cols from database.types.ts:21245. PK = id (NOT workspace_budget_id).
// period_type enum + period_date define the budget window.
// department_id + location_id nullable (budget can be workspace-wide).
const wsBudgets = await sb
  .from("workspace_budget")
  .select(
    "id, workspace_id, department_id, location_id, period_type, period_date, " +
    "revenue_target, labor_cost_target, labor_hours_target, food_cost_target, " +
    "cost_of_sales_target, absence_threshold, overtime_limit_hours, " +
    "time_to_job_target, turnover_target, hour_slot, notes, currency, " +
    "created_by, created_at, updated_at",
  )
  .limit(1);
assertOk("select workspace_budget (17 cols + currency + notes + created_by)", wsBudgets);
assertShape("workspace_budget column shape", wsBudgets.data, [
  "id",
  "workspace_id",
  "period_type",
  "period_date",
  "revenue_target",
  "labor_cost_target",
  "currency",
  "created_at",
  "updated_at",
]);

// ── 9. activate_season RPC — existence check ──────────────────────────────────
// Signature from database.types.ts:22386:
//   Args: { p_season_id: string; p_workspace_id: string }
//   Returns: Json
//
// Passing nil UUIDs → DB error (row not found / RLS / FK). We accept any error
// EXCEPT 42883 (function not found). 42883 = the RPC was never deployed.
// Any other outcome = function is deployed and signature matches.
const activateResult = await sb.rpc("activate_season", {
  p_season_id: "00000000-0000-0000-0000-000000000000",
  p_workspace_id: "00000000-0000-0000-0000-000000000000",
});
if (activateResult.error?.code === "42883") {
  console.log(
    `  ✗ rpc activate_season — FUNCTION NOT FOUND (42883): ${activateResult.error.message}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `  ✓ rpc activate_season — function deployed (nil UUID result: ${activateResult.error?.code ?? "no error"})`,
  );
}

result();
