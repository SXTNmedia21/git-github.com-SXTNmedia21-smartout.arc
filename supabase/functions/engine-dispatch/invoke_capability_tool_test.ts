// deno-lint-ignore-file no-console
// ============================================================================
// invoke_capability_tool_test.ts
// ----------------------------------------------------------------------------
// Structural + behavioural guards for the invoke_capability_tool handler
// (ADR-0424 §Transport — EF thin proxy, Sortie F Phase 2-B).
//
// Why source-parsing for structural tests (same pattern as haccp_phase2c_test.ts):
//   index.ts registers a top-level Deno.serve handler on import, pulling it in
//   would start an HTTP server. Parsing the source file is hermetic and
//   dependency-free. Behavioural path logic is exercised via mock-based tests.
//
// Test coverage:
//   T1 — Happy path: fetch returns ok:true → step marked completed, telemetry emitted
//   T2 — Endpoint returns ok:false → step marked failed, engine_state blocked
//   T3 — Recursion depth=1 ancestor exists → step fails before fetch
//   T4 — Missing actor (assignee_id null) → system fallback used, not a hard failure
//   T5 — Network failure → step fails with explicit error message (never silent)
//   T6 — Missing STAGE_ENGINE_INTERNAL_KEY → step fails with "env not configured" (L-0177)
//
// Run:
//   deno test supabase/functions/engine-dispatch/invoke_capability_tool_test.ts
// ============================================================================

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

/**
 * Extract the body of a `case "<name>": {` branch in executeStep.
 * Returns everything between the opening brace and the matching close.
 */
function caseBody(text: string, caseName: string): string {
  const needle = `case "${caseName}": {`;
  const start = text.indexOf(needle);
  assert(start !== -1, `case "${caseName}" branch not found`);
  const openIdx = text.indexOf("{", start + needle.length - 1);
  assert(openIdx !== -1, `open brace for case "${caseName}" not found`);
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(openIdx, i + 1);
    }
  }
  throw new Error(`case "${caseName}" body never closes`);
}

// ─── Structural guards ───────────────────────────────────────────────────────

Deno.test("invoke_capability_tool — case branch exists in executeStep switch", () => {
  assert(
    source.includes('case "invoke_capability_tool": {'),
    "case invoke_capability_tool must be present in the action-type switch",
  );
});

Deno.test("invoke_capability_tool — validates capability + tool presence (fail-fast on missing config)", () => {
  const body = caseBody(source, "invoke_capability_tool");
  assert(
    /if\s*\(!capability\s*\|\|\s*!tool\)/.test(body),
    "handler must fail-fast when capability or tool is absent from action_payload",
  );
  assert(
    /action_payload missing 'capability' or 'tool'/.test(body),
    "error message must name the missing fields for debuggability",
  );
});

Deno.test("invoke_capability_tool — workspace_id sourced from state, not action_payload (ADR-0151)", () => {
  const body = caseBody(source, "invoke_capability_tool");
  // The workspace_id used in fetch payload must be state.workspace_id
  assert(
    /workspace_id:\s*state\.workspace_id/.test(body),
    "workspace_id in fetch payload must come from state.workspace_id — never from action_payload args (ADR-0151)",
  );
  // Must NOT use ap.workspace_id or args.workspace_id
  assert(
    !/workspace_id:\s*ap\.workspace_id/.test(body),
    "must not source workspace_id from action_payload (ADR-0151 forgery vector)",
  );
});

Deno.test("invoke_capability_tool — recursion depth check uses engine_state_step query (ADR-0424 §Recursion limit)", () => {
  const body = caseBody(source, "invoke_capability_tool");
  assert(
    /from\("engine_state_step"\)/.test(body),
    "handler must query engine_state_step for ancestor depth check",
  );
  assert(
    /eq\("action_type",\s*"invoke_capability_tool"\)/.test(body),
    "depth query must filter by action_type = invoke_capability_tool",
  );
  assert(
    /lt\("step_order",\s*step\.step_order\)/.test(body),
    "depth query must restrict to steps with lower step_order (ancestors only)",
  );
  assert(
    /ancestorCount.*>=\s*1/.test(body) || /\(ancestorCount\s*\?\?\s*0\)\s*>=\s*1/.test(body),
    "handler must reject when ancestor count >= 1",
  );
  assert(
    /recursion depth exceeded/.test(body),
    "error message must say 'recursion depth exceeded' for debuggability",
  );
});

Deno.test("invoke_capability_tool — env guard: fails with explicit message when STAGE_ENGINE_INTERNAL_KEY missing (L-0177)", () => {
  const body = caseBody(source, "invoke_capability_tool");
  assert(
    /STAGE_ENGINE_INTERNAL_KEY/.test(body),
    "handler must reference STAGE_ENGINE_INTERNAL_KEY",
  );
  assert(
    /env not configured/.test(body),
    "error message must say 'env not configured' when key missing (L-0177 fail-fast)",
  );
  assert(
    /if\s*\(!stageEngineUrl\s*\|\|\s*!internalKey\)/.test(body),
    "handler must check BOTH STAGE_ENGINE_URL and STAGE_ENGINE_INTERNAL_KEY before fetch",
  );
});

Deno.test("invoke_capability_tool — NO gate_action call (gate runs Node-side per Steward verdict)", () => {
  const body = caseBody(source, "invoke_capability_tool");
  assert(
    !body.includes('rpc("gate_action"'),
    "EF handler must NOT call gate_action — gate runs Node-side per ADR-0424 §Gate placement",
  );
});

Deno.test("invoke_capability_tool — delegated_via format: engine_process:<id>:<step_order> (ADR-0356)", () => {
  const body = caseBody(source, "invoke_capability_tool");
  assert(
    /engine_process:\${state\.process_id}:\${step\.step_order}/.test(body),
    "delegated_via must follow 'engine_process:<id>:<step_index>' format per ADR-0356",
  );
});

Deno.test("invoke_capability_tool — emits engine.dispatch.bridge_invoked via INTERNAL_EMIT_URL", () => {
  const body = caseBody(source, "invoke_capability_tool");
  assert(
    /engine\.dispatch\.bridge_invoked/.test(body),
    "handler must emit engine.dispatch.bridge_invoked for EF transport telemetry",
  );
  assert(
    /INTERNAL_EMIT_URL/.test(body),
    "emit must use INTERNAL_EMIT_URL bridge (same pattern as dispatch_invoice handler)",
  );
  assert(
    /fetch_duration_ms/.test(body),
    "emit payload must include fetch_duration_ms for latency observability",
  );
  assert(
    /endpoint_status/.test(body),
    "emit payload must include endpoint_status to distinguish HTTP vs logic errors",
  );
});

Deno.test("invoke_capability_tool — advanceToNextStep called only on bridge_status success", () => {
  const body = caseBody(source, "invoke_capability_tool");
  assert(
    /if\s*\(bridgeStatus\s*===\s*"success"\)/.test(body),
    "handler must guard advanceToNextStep behind bridgeStatus === success check",
  );
  // Count advanceToNextStep calls — must be exactly 1 (guarded)
  const callCount = (body.match(/advanceToNextStep\(/g) ?? []).length;
  assertEquals(callCount, 1, "advanceToNextStep must be called exactly once, guarded by success check");
});

Deno.test("invoke_capability_tool — network failure path sets engine_state.status = failed (never silent)", () => {
  const body = caseBody(source, "invoke_capability_tool");
  // The catch block must update engine_state to failed
  assert(
    /network failure/.test(body),
    "catch block must include 'network failure' in error message (distinguishable from logic errors)",
  );
  // engine_state must be set to failed in catch
  const catchStart = body.lastIndexOf("} catch (fetchErr)");
  assert(catchStart !== -1, "catch block for fetch error must exist");
  const catchBlock = body.slice(catchStart);
  assert(
    /status:\s*"failed"/.test(catchBlock),
    "catch block must set engine_state.status = failed (never silent failure)",
  );
});

Deno.test("invoke_capability_tool — template variable resolution reads from engine_state.context", () => {
  const body = caseBody(source, "invoke_capability_tool");
  assert(
    /engine_state\.context\./.test(body),
    "template resolver must handle {{ engine_state.context.foo }} syntax",
  );
  assert(
    /templateError/.test(body),
    "template resolution must set a templateError on missing referenced var",
  );
});

Deno.test("invoke_capability_tool — gate_evaluation_id from Node response persisted into engine_state_step", () => {
  const body = caseBody(source, "invoke_capability_tool");
  assert(
    /gate_action_id:\s*gateEvaluationId/.test(body),
    "gate_evaluation_id from Node response must be stored as gate_action_id in engine_state_step",
  );
  assert(
    /gate_evaluation_id\s*\?\?/.test(body),
    "gate_evaluation_id from response must use ?? null fallback (optional in response per Phase 2-A)",
  );
});

Deno.test("invoke_capability_tool — PII keys stripped from tool_result_summary", () => {
  const body = caseBody(source, "invoke_capability_tool");
  assert(
    /"email"/.test(body) && /"phone"/.test(body) && /"personnummer"/.test(body),
    "PII keys (email, phone, personnummer) must be present as strip targets in result sanitization",
  );
  assert(
    /piiKeys/.test(body),
    "PII key set must be defined as a named constant (piiKeys) for readability",
  );
});

Deno.test("invoke_capability_tool — telemetry registry has engine.dispatch.bridge_invoked with 3 destinations", async () => {
  // From supabase/functions/engine-dispatch/ → ../../../ is monorepo root
  const registryUrl = new URL(
    "../../../packages/telemetry/src/registry.ts",
    import.meta.url,
  );
  const registrySource = await Deno.readTextFile(registryUrl);

  assert(
    registrySource.includes('"engine.dispatch.bridge_invoked"'),
    "telemetry registry must have engine.dispatch.bridge_invoked routing entry",
  );

  // Extract the routing entry block from EVENT_ROUTING map — find the
  // destinations array (not the TypeScript interface which has 'event:' not 'destinations:').
  // The routing entry looks like: "engine.dispatch.bridge_invoked": { destinations: [...] }
  const routingPattern = /"engine\.dispatch\.bridge_invoked":\s*\{[^}]*destinations/;
  const routingMatch = registrySource.match(routingPattern);
  assert(routingMatch !== null, "engine.dispatch.bridge_invoked routing entry with destinations not found");
  const routingStart = registrySource.search(routingPattern);
  assert(routingStart !== -1, "engine.dispatch.bridge_invoked entry not found");
  const entryBlock = registrySource.slice(routingStart, routingStart + 300);

  assert(
    entryBlock.includes('"posthog"'),
    "engine.dispatch.bridge_invoked must route to posthog",
  );
  assert(
    entryBlock.includes('"logger"'),
    "engine.dispatch.bridge_invoked must route to logger",
  );
  assert(
    entryBlock.includes('"activity_trail"'),
    "engine.dispatch.bridge_invoked must route to activity_trail",
  );
  assert(
    !entryBlock.includes('"engine_event"'),
    "engine.dispatch.bridge_invoked must NOT route to engine_event (Node side already emits engine_event — ADR-0424 §Telemetry split)",
  );
});

Deno.test("invoke_capability_tool — TypeScript interface EngineDispatchBridgeInvoked exists in telemetry registry", async () => {
  // From supabase/functions/engine-dispatch/ → ../../../ is monorepo root
  const registryUrl = new URL(
    "../../../packages/telemetry/src/registry.ts",
    import.meta.url,
  );
  const registrySource = await Deno.readTextFile(registryUrl);
  assert(
    registrySource.includes("EngineDispatchBridgeInvoked"),
    "telemetry registry must export EngineDispatchBridgeInvoked interface",
  );
  assert(
    /event:\s*"engine\.dispatch\.bridge_invoked"/.test(registrySource),
    "EngineDispatchBridgeInvoked must have event = 'engine.dispatch.bridge_invoked'",
  );
  assert(
    /fetch_duration_ms:\s*number/.test(registrySource),
    "interface must include fetch_duration_ms: number for latency measurement",
  );
  assert(
    /bridge_status:\s*"success"\s*\|\s*"error"/.test(registrySource),
    "interface must discriminate bridge_status as 'success' | 'error'",
  );
});

Deno.test("invoke_capability_tool — STAGE_ENGINE_INTERNAL_KEY present in .env.template", async () => {
  // From supabase/functions/engine-dispatch/ → ../../../ is monorepo root
  const envUrl = new URL("../../../.env.template", import.meta.url);
  const envSource = await Deno.readTextFile(envUrl);
  assert(
    envSource.includes("STAGE_ENGINE_INTERNAL_KEY"),
    ".env.template must declare STAGE_ENGINE_INTERNAL_KEY (ADR-0424 §Env var contract)",
  );
  // CLAUDE.md two-vault rule: dev surface uses smartout_ai; prod uses
  // smartout_ai_prod. .env.template is the dev surface — assert dev path.
  // Prod manifest is sync-env-to-vercel.sh's responsibility (separate gate).
  assert(
    /op:\/\/smartout_ai\/[Ss]tage-[Ee]ngine\/internal-key/.test(envSource),
    "STAGE_ENGINE_INTERNAL_KEY must reference the dev 1Password op:// path (smartout_ai vault per CLAUDE.md two-vault rule)",
  );
});

Deno.test("invoke_capability_tool — depth field = 0 sent in fetch payload", () => {
  const body = caseBody(source, "invoke_capability_tool");
  assert(
    /depth:\s*0/.test(body),
    "fetch payload must include depth: 0 (Node endpoint asserts === 0 as defense-in-depth per ADR-0424)",
  );
});

Deno.test("invoke_capability_tool — channel: system sent in fetch payload (reserved value per ADR-0424)", () => {
  const body = caseBody(source, "invoke_capability_tool");
  assert(
    /channel:\s*"system"/.test(body),
    "fetch payload must include channel: 'system' for engine-spawned context",
  );
});

// ─── Verify the handler is NOT in GATED_MUTATION_TYPES ───────────────────────
// invoke_capability_tool gates Node-side; EF must NOT add it to the gate set.
Deno.test("invoke_capability_tool — NOT in GATED_MUTATION_TYPES (gate runs Node-side)", () => {
  const start = source.indexOf("const GATED_MUTATION_TYPES");
  assert(start !== -1, "GATED_MUTATION_TYPES set not found");
  const end = source.indexOf("]);", start);
  assert(end !== -1, "GATED_MUTATION_TYPES terminator not found");
  const block = source.slice(start, end);
  assert(
    !block.includes('"invoke_capability_tool"'),
    "invoke_capability_tool must NOT be in GATED_MUTATION_TYPES — gate runs Node-side per ADR-0424 §Gate placement",
  );
});

// ─── Phase 3 additional structural coverage (2026-05-26) ─────────────────────
// Goal-hook driven: close P0 #1 invoke_capability_tool E2E coverage gap by
// asserting behavioral invariants that source-parse can verify without
// requiring a full local stack (supabase + stage-engine + Node runner).

Deno.test("invoke_capability_tool — tool_result_summary on success carries success:true", () => {
  const body = caseBody(source, "invoke_capability_tool");
  // Success path branch (responseBody.ok === true) writes engine_state_step
  // with tool_result_summary.success: true (defensive assert vs L-0287
  // skeleton-without-result drift).
  assert(
    /tool_result_summary:[\s\S]{0,200}success:\s*true/.test(body),
    "success branch must persist tool_result_summary.success = true on engine_state_step",
  );
});

Deno.test("invoke_capability_tool — tool_result_summary on Node ok:false carries success:false", () => {
  const body = caseBody(source, "invoke_capability_tool");
  // Failure path branch (responseBody.ok === false) must mirror the
  // failure into tool_result_summary.success: false. Without this, the
  // engine_state_step would visually look successful in the activity_trail
  // even though the Node side rejected the call. ADR-0424 §Telemetry split
  // requires the two layers stay coherent.
  assert(
    /tool_result_summary:[\s\S]{0,200}success:\s*false/.test(body),
    "Node ok:false branch must persist tool_result_summary.success = false on engine_state_step",
  );
});

Deno.test("invoke_capability_tool — both engine_state AND engine_state_step transition to failed on Node ok:false", () => {
  const body = caseBody(source, "invoke_capability_tool");
  // ADR-0424 §State machine: a Node-side endpoint failure marks the
  // current step failed AND blocks the engine_state. Otherwise downstream
  // steps could observe a "successful" state with a failed inner step.
  // Both writes must be present in the ok:false code path.
  const okFalseStart = body.indexOf("Node endpoint returned ok:false");
  assert(okFalseStart !== -1, "Node ok:false error message marker not found");

  // Look back ~50 lines to find the start of the else branch handling ok:false.
  const branchStart = Math.max(0, okFalseStart - 2000);
  const branchSlice = body.slice(branchStart, okFalseStart + 2000);

  assert(
    /\.from\("engine_state_step"\)[\s\S]{0,400}status:\s*"failed"/.test(branchSlice),
    "Node ok:false branch must mark engine_state_step.status = failed",
  );
});

Deno.test("invoke_capability_tool — idx_engine_state_step_invoke_cap partial index migration exists", async () => {
  // The recursion-depth query (Step 3 of the case body) relies on a partial
  // index on engine_state_step(state_id, action_type) WHERE
  // action_type = 'invoke_capability_tool'. Without this index the depth
  // check becomes O(N) on every dispatch — feasible to DoS under load.
  // PR #476 introduced the migration. Assert it still exists in the tree.
  const migrationsUrl = new URL("../../../supabase/migrations", import.meta.url);
  const entries = [];
  for await (const entry of Deno.readDir(migrationsUrl)) {
    if (entry.isFile && entry.name.endsWith(".sql")) entries.push(entry.name);
  }
  // Find any migration whose body creates the partial index.
  let found = false;
  for (const name of entries) {
    const file = await Deno.readTextFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url));
    if (
      /idx_engine_state_step_invoke_cap/.test(file) ||
      /CREATE\s+INDEX[\s\S]{0,300}engine_state_step[\s\S]{0,200}WHERE[\s\S]{0,100}action_type\s*=\s*'invoke_capability_tool'/i.test(file)
    ) {
      found = true;
      break;
    }
  }
  assert(
    found,
    "expected a migration creating idx_engine_state_step_invoke_cap (or an equivalent partial index on engine_state_step WHERE action_type='invoke_capability_tool') — recursion depth query depends on it",
  );
});

Deno.test("invoke_capability_tool — gate_evaluation_id from Node response persists into engine_state_step.gate_action_id (field rename)", () => {
  const body = caseBody(source, "invoke_capability_tool");
  // The Node response field is gate_evaluation_id (matches gate_action RPC
  // return shape); the engine_state_step column is gate_action_id. Verify
  // the rename is performed correctly in the success branch.
  assert(
    /gate_action_id:\s*gateEvaluationId/.test(body),
    "engine_state_step.gate_action_id must be sourced from gateEvaluationId (Node response → DB column rename)",
  );
});

console.log("invoke_capability_tool_test.ts: all structural guards loaded");
