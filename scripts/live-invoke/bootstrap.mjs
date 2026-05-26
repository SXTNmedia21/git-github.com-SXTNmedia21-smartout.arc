// scripts/live-invoke/bootstrap.mjs
// Live-invoke smoke for the bootstrap domain.
//
// What this catches (L-0348 — column drift that mocks miss):
//   - Column drift on workspace_bootstrap_run (12 cols), workspace_bootstrap_gate (17 cols)
//   - RPC signature drift on fn_list_open_bootstrap_gates (core progression read)
//   - fn_list_open_bootstrap_gates return shape (17 cols, mirrors workspace_bootstrap_gate Row)
//   - fn_close_bootstrap_gate existence (write-path RPC — nil UUID existence check)
//   - fn_skip_bootstrap_gate existence (write-path RPC — nil UUID existence check)
//   - workspace table (6 key cols — identity layer bootstrap-cascade EF reads)
//   - bootstrap_botsson_channel RPC existence (called by bootstrap chain to resolve push channel)
//
// Design choices:
//   - Column lists derived from packages/supabase/src/database.types.ts Row shapes ONLY.
//     Never from migration SQL (L-0348 hard rule).
//   - Write-path RPCs (fn_close_bootstrap_gate, fn_skip_bootstrap_gate,
//     bootstrap_botsson_channel) are existence-checked via nil UUID call:
//     PGRST/DB error = deployed; 42883 = function not found (real deployment gap).
//   - industry_config and workspace_setup_state are NOT in database.types.ts as of
//     2026-05-26 — these names do not correspond to public schema tables at this
//     typegen revision. Smoke omits them rather than asserting phantom columns.
//
// Capabilities covered:
//   - bootstrap-cascade Edge Function (supabase/functions/bootstrap-cascade/)
//   - admin setup wizard backend (11-step gate progression)
//   - workspace bootstrap gate open/close/skip lifecycle
//   - bootstrap_botsson_channel push routing
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/bootstrap.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("bootstrap");

// ── 1. workspace_bootstrap_run — audit table for bootstrap runs ───────────────
// 12 cols from database.types.ts Row (line 21174).
// PK is `id` (not workspace_bootstrap_run_id). source_path + status required.
// framework_binding_id FK → workspace_framework_binding.id (nullable).
const bootstrapRuns = await sb
  .from("workspace_bootstrap_run")
  .select(
    "id, workspace_id, source_path, status, current_step, steps_completed, " +
    "framework_binding_id, started_at, completed_at, error_payload, warnings, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("select workspace_bootstrap_run (13 cols)", bootstrapRuns);
assertShape("workspace_bootstrap_run column shape", bootstrapRuns.data, [
  "id",
  "workspace_id",
  "source_path",
  "status",
  "current_step",
  "steps_completed",
  "started_at",
  "completed_at",
  "error_payload",
  "warnings",
  "created_at",
  "updated_at",
]);

// ── 2. workspace_bootstrap_gate — gate progression per workspace ──────────────
// 17 cols from database.types.ts Row (line 21086).
// PK is workspace_bootstrap_gate_id. gate_slug + workspace_id uniquely identify.
// status is bootstrap_gate_status enum. depends_on + metadata are Json.
const bootstrapGates = await sb
  .from("workspace_bootstrap_gate")
  .select(
    "workspace_bootstrap_gate_id, workspace_id, gate_slug, status, required, " +
    "display_label_en, display_label_no, description, capability_slug, " +
    "industry_source, suggested_day, depends_on, metadata, " +
    "skip_reason, closed_at, closed_by, closed_via, created_at, updated_at",
  )
  .limit(1);
assertOk("select workspace_bootstrap_gate (19 cols)", bootstrapGates);
assertShape("workspace_bootstrap_gate column shape", bootstrapGates.data, [
  "workspace_bootstrap_gate_id",
  "workspace_id",
  "gate_slug",
  "status",
  "required",
  "display_label_en",
  "display_label_no",
  "capability_slug",
  "industry_source",
  "suggested_day",
  "depends_on",
  "metadata",
  "skip_reason",
  "closed_at",
  "closed_by",
  "closed_via",
  "created_at",
  "updated_at",
]);

// ── 3. fn_list_open_bootstrap_gates RPC — core progression read ───────────────
// Primary read that the bootstrap wizard UI calls to render step state.
// Args: p_workspace_id (required). Returns Setof workspace_bootstrap_gate.
// Passing nil UUID = returns empty (RLS/no rows) — that is correct smoke behavior.
// Shape matches workspace_bootstrap_gate Row (17 cols, line 22765).
const openGates = await sb.rpc("fn_list_open_bootstrap_gates", {
  p_workspace_id: "00000000-0000-0000-0000-000000000000",
});
assertOk("rpc fn_list_open_bootstrap_gates (nil workspace)", openGates);
assertShape("fn_list_open_bootstrap_gates return shape", openGates.data, [
  "workspace_bootstrap_gate_id",
  "workspace_id",
  "gate_slug",
  "status",
  "required",
  "display_label_en",
  "display_label_no",
  "capability_slug",
  "industry_source",
  "suggested_day",
  "depends_on",
  "metadata",
  "skip_reason",
  "closed_at",
  "closed_by",
  "closed_via",
  "created_at",
  "updated_at",
]);

// ── 4. fn_close_bootstrap_gate RPC — existence check (write-path) ─────────────
// Called by wizard step completion. Requires valid gate_slug + profile_id + workspace_id.
// Nil UUIDs will cause DB-level error — we accept any error EXCEPT 42883.
// 42883 = function was never deployed. Any other error = function exists.
const closeGateResult = await sb.rpc("fn_close_bootstrap_gate", {
  p_gate_slug: "probe_smoke_gate",
  p_profile_id: "00000000-0000-0000-0000-000000000000",
  p_via: "smoke_test",
  p_workspace_id: "00000000-0000-0000-0000-000000000000",
});
if (closeGateResult.error?.code === "42883") {
  console.log(
    `  ✗ rpc fn_close_bootstrap_gate — FUNCTION NOT FOUND (42883): ${closeGateResult.error.message}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `  ✓ rpc fn_close_bootstrap_gate — deployed (nil UUID returned: ${closeGateResult.error?.code ?? "no error"})`,
  );
}

// ── 5. fn_skip_bootstrap_gate RPC — existence check (write-path) ──────────────
// Called when wizard step is explicitly skipped. Same existence-check pattern.
const skipGateResult = await sb.rpc("fn_skip_bootstrap_gate", {
  p_gate_slug: "probe_smoke_gate",
  p_profile_id: "00000000-0000-0000-0000-000000000000",
  p_reason: "smoke_test_probe",
  p_workspace_id: "00000000-0000-0000-0000-000000000000",
});
if (skipGateResult.error?.code === "42883") {
  console.log(
    `  ✗ rpc fn_skip_bootstrap_gate — FUNCTION NOT FOUND (42883): ${skipGateResult.error.message}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `  ✓ rpc fn_skip_bootstrap_gate — deployed (nil UUID returned: ${skipGateResult.error?.code ?? "no error"})`,
  );
}

// ── 6. workspace table — identity layer read ──────────────────────────────────
// bootstrap-cascade EF reads workspace to resolve slug, timezone, industry, and
// status before running any bootstrap step. Verifying key cols from the 40-col
// Row shape (line 20883). Selecting the 8 cols the EF most critically uses.
const workspaces = await sb
  .from("workspace")
  .select(
    "workspace_id, slug, name, status, timezone, language, " +
    "onboarding_completed, setup_guide_completed, created_at, updated_at",
  )
  .limit(1);
assertOk("select workspace (10 key cols for bootstrap-cascade)", workspaces);
assertShape("workspace column shape (bootstrap-cascade subset)", workspaces.data, [
  "workspace_id",
  "slug",
  "name",
  "status",
  "timezone",
  "language",
  "onboarding_completed",
  "setup_guide_completed",
  "created_at",
  "updated_at",
]);

// ── 7. bootstrap_botsson_channel RPC — existence check ────────────────────────
// Resolves the push channel for the workspace's Botsson instance. Called during
// bootstrap-cascade chain to route notifications. Returns string (channel id).
// Nil UUID = DB error (no row), not 42883. Same existence pattern.
const botssonChannelResult = await sb.rpc("bootstrap_botsson_channel", {
  p_workspace_id: "00000000-0000-0000-0000-000000000000",
});
if (botssonChannelResult.error?.code === "42883") {
  console.log(
    `  ✗ rpc bootstrap_botsson_channel — FUNCTION NOT FOUND (42883): ${botssonChannelResult.error.message}`,
  );
  process.exitCode = 1;
} else {
  console.log(
    `  ✓ rpc bootstrap_botsson_channel — deployed (nil UUID returned: ${botssonChannelResult.error?.code ?? "no error"})`,
  );
}

result();
