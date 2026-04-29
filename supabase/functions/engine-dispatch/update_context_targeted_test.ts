// deno-lint-ignore-file no-console
// ============================================================================
// update_context_targeted_test.ts
// ----------------------------------------------------------------------------
// Structural guards for the `update_context_targeted` action_type added per
// ADR-0236 (Council 2026-04-29). This handler patches engine_state.context
// for a DIFFERENT state than the executing one — sibling of update_context
// (which patches the current state). Used by helpdesk_sla_breach_handler
// step 1 to write the original ticket's context.sla_breached_at while the
// breach-handler runs as a transient process (ADR-0235).
//
// Why source-parsing (same pattern as update_context_test.ts +
// haccp_phase2c_test.ts):
//   index.ts registers a top-level Deno.serve handler on import, so pulling
//   the module into a test would also start the HTTP server. Parsing the
//   source keeps the test hermetic and dependency-free. Behavioral tests
//   live in the deno-test / pgTAP suite.
//
// What the tests guard (mirrors ADR-0236 test plan):
//   1.  GATED_MUTATION_TYPES inclusion (ADR-0099).
//   2.  Case branch exists in executeStep switch.
//   3.  Target resolution priority: action_payload → context.target_state_id
//       → context.engine_state_id (ADR-0235 breach-handler convention).
//   4.  Workspace integrity guard exists (CVE-class).
//   5.  Workspace mismatch blocks source + emits cross_state_write_blocked.
//   6.  Target-not-found blocks source.
//   7.  Missing-target_state_id blocks source.
//   8.  Shallow merge of patch into TARGET context (not source context).
//   9.  Nested-path keys rejected.
//   10. Immutable-key stripping (id, workspace_id) with warn log.
//   11. Runtime sentinel substitution: "__now__" → ISO timestamp.
//   12. PII-safe logging — patch_keys only, never values (ADR-0163).
//   13. Advances source state on success.
//
// Run: deno test supabase/functions/engine-dispatch/update_context_targeted_test.ts
// ============================================================================

import { assert } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

/**
 * Extract the body of a `case "<name>": {` branch in executeStep.
 * Returns everything between the case label and the matching closing
 * `}` before the next sibling `case ` / `default:`.
 * Mirrors update_context_test.ts.
 */
function caseBody(text: string, caseName: string): string {
  const marker = `case "${caseName}":`;
  const start = text.indexOf(marker);
  assert(start !== -1, `case "${caseName}" not found in index.ts`);
  const nextCase = text.indexOf("\n    case ", start + marker.length);
  const nextDefault = text.indexOf("\n    default:", start + marker.length);
  const candidates = [nextCase, nextDefault].filter((i) => i !== -1);
  const end = candidates.length > 0 ? Math.min(...candidates) : text.length;
  return text.slice(start, end);
}

// ---------------------------------------------------------------------------
// 1. GATED_MUTATION_TYPES inclusion (ADR-0099)
// ---------------------------------------------------------------------------

Deno.test("update_context_targeted is in GATED_MUTATION_TYPES (ADR-0099)", () => {
  const gatedBlockStart = source.indexOf("const GATED_MUTATION_TYPES = new Set([");
  assert(gatedBlockStart !== -1, "GATED_MUTATION_TYPES literal not found");
  const gatedBlockEnd = source.indexOf("]);", gatedBlockStart);
  assert(gatedBlockEnd !== -1, "GATED_MUTATION_TYPES terminator not found");
  const block = source.slice(gatedBlockStart, gatedBlockEnd);
  assert(
    block.includes('"update_context_targeted"'),
    "update_context_targeted must be in GATED_MUTATION_TYPES — cross-state writes go through the same authority gate as current-state writes (ADR-0236)",
  );
});

// ---------------------------------------------------------------------------
// 2. Case branch exists
// ---------------------------------------------------------------------------

Deno.test("update_context_targeted — case branch exists in executeStep switch", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(body.length > 0, "update_context_targeted case branch is empty");
  assert(body.includes("case \"update_context_targeted\":"), "case label missing");
});

// ---------------------------------------------------------------------------
// 3. Target resolution priority chain
// ---------------------------------------------------------------------------

Deno.test("update_context_targeted — resolves target_state_id from action_payload first", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes("ap?.target_state_id") || body.includes("ap.target_state_id"),
    "update_context_targeted must read action_payload.target_state_id (priority 1 — explicit blueprint setting)",
  );
});

Deno.test("update_context_targeted — falls back to state.context.target_state_id", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes("ctx.target_state_id") || body.includes("context.target_state_id"),
    "update_context_targeted must fall back to state.context.target_state_id (priority 2 — forwarded via spawn payload)",
  );
});

Deno.test("update_context_targeted — falls back to state.context.engine_state_id", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes("ctx.engine_state_id") || body.includes("context.engine_state_id"),
    "update_context_targeted must fall back to state.context.engine_state_id (priority 3 — breach-handler convention per ADR-0235)",
  );
});

// ---------------------------------------------------------------------------
// 4. Workspace integrity guard exists (CVE-class)
// ---------------------------------------------------------------------------

Deno.test("update_context_targeted — looks up target row to read workspace_id", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes('.from("engine_state")'),
    "update_context_targeted must SELECT from engine_state to look up the target row",
  );
  assert(
    body.includes("workspace_id"),
    "update_context_targeted must read target.workspace_id for the integrity guard (CVE-class — ADR-0236)",
  );
});

Deno.test("update_context_targeted — compares source vs target workspace_id", () => {
  const body = caseBody(source, "update_context_targeted");
  // The guard is a string comparison: sourceWorkspaceId !== targetWorkspaceId
  assert(
    /sourceWorkspaceId\s*!==\s*targetWorkspaceId|state\.workspace_id\s*!==\s*target\.workspace_id/.test(
      body,
    ),
    "update_context_targeted must compare source.workspace_id vs target.workspace_id — mismatch is the CVE-class breach (ADR-0236)",
  );
});

// ---------------------------------------------------------------------------
// 5. Workspace mismatch blocks source + emits cross_state_write_blocked
// ---------------------------------------------------------------------------

Deno.test("update_context_targeted — emits engine.cross_state_write_blocked on workspace mismatch", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes("engine.cross_state_write_blocked"),
    "update_context_targeted must emit engine.cross_state_write_blocked on workspace mismatch — security telemetry (ADR-0236)",
  );
});

Deno.test("update_context_targeted — workspace mismatch blocks SOURCE state, not target", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes('last_error: `update_context_targeted: workspace mismatch') ||
      body.includes("workspace mismatch"),
    "update_context_targeted must record last_error containing 'workspace mismatch' when guard fails",
  );
  assert(
    body.includes('status: "blocked"'),
    "update_context_targeted must block source state on workspace mismatch (mirrors update_entity / update_context precedent — L-0085)",
  );
});

// ---------------------------------------------------------------------------
// 6. Target not found blocks source
// ---------------------------------------------------------------------------

Deno.test("update_context_targeted — target not found blocks source with clear error", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes("target_state_id not found"),
    "update_context_targeted must record last_error containing 'target_state_id not found' when target lookup returns no row (ADR-0236)",
  );
});

// ---------------------------------------------------------------------------
// 7. Missing target_state_id blocks source
// ---------------------------------------------------------------------------

Deno.test("update_context_targeted — missing target_state_id blocks source with clear error", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes("missing target_state_id"),
    "update_context_targeted must record last_error containing 'missing target_state_id' when all 3 priority sources are empty (ADR-0236)",
  );
});

// ---------------------------------------------------------------------------
// 8. Shallow merge of patch into TARGET context
// ---------------------------------------------------------------------------

Deno.test("update_context_targeted — shallow-merges patch into TARGET context (not source)", () => {
  const body = caseBody(source, "update_context_targeted");
  // Look for spread merge pattern with TARGET's context as base.
  assert(
    /\{\s*\.\.\.targetCurrent,\s*\.\.\.patch\s*\}/.test(body),
    "update_context_targeted must shallow-merge with TARGET's existing context: { ...targetCurrent, ...patch } — must NOT base merge on source.context (that would be update_context's job)",
  );
});

Deno.test("update_context_targeted — falls back to empty object when target.context is null", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes("?? {}") || body.includes("?? ({} as"),
    "update_context_targeted must default target.context to {} when null (engine_state.context is nullable)",
  );
});

Deno.test("update_context_targeted — UPDATE filters by target_state_id, not source.id", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes('.eq("id", targetStateId)'),
    "update_context_targeted must filter the UPDATE by targetStateId — that is the entire point of the cross-state primitive (ADR-0236)",
  );
});

// ---------------------------------------------------------------------------
// 9. Nested-path key rejection
// ---------------------------------------------------------------------------

Deno.test("update_context_targeted — rejects nested-path keys (foo.bar)", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes('k.includes(".")') || body.includes('".")'),
    "update_context_targeted must reject nested-path keys — shallow merge would create literal 'foo.bar' top-level keys",
  );
  assert(
    body.includes("nested-path keys not allowed"),
    "update_context_targeted must record a clear last_error for nested-path attempts",
  );
});

// ---------------------------------------------------------------------------
// 10. Immutable-key stripping
// ---------------------------------------------------------------------------

Deno.test("update_context_targeted — strips immutable id and workspace_id keys with warn log", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes('"id"') && body.includes('"workspace_id"'),
    "update_context_targeted must strip id + workspace_id — they are tenant/identity anchors, never patchable from a step",
  );
  assert(
    body.includes("stripped_immutable_keys"),
    "update_context_targeted must warn-log when an immutable key is stripped (helps misconfigured blueprints surface)",
  );
});

// ---------------------------------------------------------------------------
// 11. Runtime sentinel substitution
// ---------------------------------------------------------------------------

Deno.test("update_context_targeted — substitutes \"__now__\" with ISO timestamp", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes('"__now__"'),
    "update_context_targeted must support the \"__now__\" runtime sentinel — breach-handler blueprint is a static seed but sla_breached_at must be the actual fire time (ADR-0235 step 1)",
  );
  // Substitution swap pattern.
  assert(
    /v\s*===\s*"__now__"\s*\?\s*nowIso/.test(body) ||
      body.includes('=== "__now__" ? '),
    "update_context_targeted must substitute __now__ with new Date().toISOString() at fire time",
  );
});

// ---------------------------------------------------------------------------
// 12. PII-safe logging (ADR-0163)
// ---------------------------------------------------------------------------

Deno.test("update_context_targeted — logs patch_keys only, never patch values (ADR-0163)", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes("patch_keys:"),
    "update_context_targeted must log Object.keys(patch) for debuggability",
  );
  assert(
    !body.includes("patch_values:") && !body.includes("JSON.stringify(patch)"),
    "update_context_targeted must NEVER log patch values — context can carry PII (requester_profile_id, summaries) per ADR-0163",
  );
});

// ---------------------------------------------------------------------------
// 13. Advances source state on success
// ---------------------------------------------------------------------------

Deno.test("update_context_targeted — advances source to next step on success", () => {
  const body = caseBody(source, "update_context_targeted");
  assert(
    body.includes("await advanceToNextStep(supabase, state, step);"),
    "update_context_targeted must call advanceToNextStep on success — source state continues to step 2 (notification) per ADR-0235",
  );
});
