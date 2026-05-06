// deno-lint-ignore-file no-console
// ============================================================================
// haccp_phase2c_test.ts
// ----------------------------------------------------------------------------
// Structural guards for the HACCP Phase 2c handlers landed in B5:
//   - create_deviation
//   - validate_settlement
//   - lock_checkout
//
// Why source-parsing (same pattern as entity_pk_test.ts):
//   index.ts registers a top-level Deno.serve handler on import, so pulling
//   the module into a test would also start the HTTP server. Parsing the
//   source keeps the test hermetic and dependency-free. The alternative —
//   spinning up a local Supabase + seeding engine_process rows and driving
//   executeStep end-to-end — lives in the deno-test / pgTAP suite, not in
//   this file.
//
// What the tests guard:
//   1. Invariant 11 (ADR-0196 / L-0124): every "work started" handler
//      either writes a real domain artefact or blocks the state. No
//      silent advance-without-mutation.
//   2. L-0134: handlers propagate the gate_evaluation_id into their
//      engine_event payloads (not just the allow boolean).
//   3. L-0085: silent-noop guards — insert / update / edge-invoke errors
//      must block engine_state before advanceToNextStep is reached.
//
// Run:
//   deno test supabase/functions/engine-dispatch/haccp_phase2c_test.ts
// ============================================================================

import { assert, assertEquals } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

/**
 * Extract the body of a `case "<name>":` branch in executeStep. Returns
 * everything between the opening `case "<name>": {` and the matching
 * closing `}` before the next `case ` / `default:` sibling. Relies on
 * the handler using a block-scoped body, which every handler in
 * index.ts does today.
 */
function caseBody(text: string, caseName: string): string {
  const needle = `case "${caseName}": {`;
  const start = text.indexOf(needle);
  assert(start !== -1, `case "${caseName}" branch not found`);
  // Walk forward tracking brace depth starting from the `{` of the case.
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

// ──────────────────────────────────────────────────────────────────────
// Gate-plumbing — shared prerequisite. The three handlers all rely on
// the function-scope `gateEvaluation` hoist so they can stamp
// gate_evaluation_id into their engine_event rows (L-0134).
// ──────────────────────────────────────────────────────────────────────

Deno.test("gateEvaluation hoisted to function scope (L-0134 prerequisite)", () => {
  assert(
    /let gateEvaluation:\s*\n?\s*\|\s*\{/.test(source),
    "gateEvaluation must be declared at executeStep function scope so " +
      "HACCP handlers can propagate gate_evaluation_id into engine_event",
  );
  assert(
    /gate_evaluation_id:\s*gate\.gate_evaluation_id,?\s*\n/.test(source),
    "gateEvaluation must capture gate_evaluation_id from the RPC result",
  );
  assert(
    /downgrade_to:\s*gate\.downgrade_to\s*\?\?\s*null/.test(source),
    "gateEvaluation must capture downgrade_to from the RPC result (L-0134)",
  );
  assert(
    /four_eyes_required:\s*gate\.four_eyes_required\s*\?\?\s*false/.test(source),
    "gateEvaluation must capture four_eyes_required from the RPC result (L-0134)",
  );
});

Deno.test("all three HACCP action types remain in GATED_MUTATION_TYPES (ADR-0099)", () => {
  const start = source.indexOf("const GATED_MUTATION_TYPES");
  assert(start !== -1, "GATED_MUTATION_TYPES set not found");
  const end = source.indexOf("]);", start);
  assert(end !== -1, "GATED_MUTATION_TYPES terminator not found");
  const block = source.slice(start, end);
  for (const action of ["create_deviation", "validate_settlement", "lock_checkout"]) {
    assert(
      block.includes(`"${action}"`),
      `${action} missing from GATED_MUTATION_TYPES — gate_action would be skipped`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────
// create_deviation — happy path writes deviation row + engine_event,
// failure path blocks engine_state.
// ──────────────────────────────────────────────────────────────────────

Deno.test("create_deviation — inserts into deviation and selects deviation_id", () => {
  const body = caseBody(source, "create_deviation");
  assert(
    /\.from\("deviation"\)\s*\.insert\(/.test(body),
    "create_deviation must insert into the deviation table",
  );
  assert(
    /\.select\("deviation_id"\)/.test(body),
    "create_deviation must select deviation_id so the engine_event can " +
      "reference the artefact (Invariant 11 ADR-0196 — no phantom emit)",
  );
});

Deno.test("create_deviation — blocks engine_state on insert error (L-0085)", () => {
  const body = caseBody(source, "create_deviation");
  assert(
    /if\s*\(insertError\s*\|\|\s*!deviationRow\)/.test(body),
    "create_deviation must check insert error AND missing row",
  );
  assert(
    /status:\s*"blocked"[\s\S]{0,400}return;/.test(body),
    "create_deviation must set engine_state=blocked and return before " +
      "advanceToNextStep when the insert fails (L-0085 silent-noop guard)",
  );
});

Deno.test("create_deviation — emits ops.deviation_created with gate linkage (L-0134)", () => {
  const body = caseBody(source, "create_deviation");
  assert(
    /event_type:\s*"ops\.deviation_created"/.test(body),
    "create_deviation must emit ops.deviation_created after successful insert",
  );
  assert(
    /gate_evaluation_id:\s*gateEvaluation\?\.gate_evaluation_id\s*\?\?\s*null/.test(body),
    "create_deviation must stamp gate_evaluation_id into the engine_event payload",
  );
  assert(
    /four_eyes_required:\s*gateEvaluation\?\.four_eyes_required/.test(body),
    "create_deviation must stamp four_eyes_required into the engine_event payload (L-0134)",
  );
});

Deno.test("create_deviation — conditioned_skip path emits a trail row", () => {
  const body = caseBody(source, "create_deviation");
  assert(
    /event_type:\s*"ops\.deviation_conditioned_skip"/.test(body),
    "create_deviation must emit ops.deviation_conditioned_skip when the " +
      "action_payload condition evaluates false (otherwise the skip is invisible)",
  );
});

Deno.test("create_deviation — enum inputs fall back to safe defaults", () => {
  const body = caseBody(source, "create_deviation");
  assert(
    /VALID_DOMAINS\s*=\s*new Set\(\[[^\]]*"safety"[^\]]*"system"[^\]]*\]\)/.test(body),
    "create_deviation must validate domain against deviation_domain enum values",
  );
  assert(
    /VALID_SEVERITIES\s*=\s*new Set\(\[[^\]]*"low"[^\]]*"critical"[^\]]*\]\)/.test(body),
    "create_deviation must validate severity against deviation_severity enum values",
  );
});

// ──────────────────────────────────────────────────────────────────────
// validate_settlement — must resolve a reconciliation_id, must not
// swallow edge function errors, must emit with gate linkage.
// ──────────────────────────────────────────────────────────────────────

Deno.test("validate_settlement — blocks when reconciliation_id unresolvable", () => {
  const body = caseBody(source, "validate_settlement");
  assert(
    /if\s*\(!reconciliationId\)/.test(body),
    "validate_settlement must require a resolvable reconciliation_id",
  );
  assert(
    /status:\s*"blocked"[\s\S]{0,500}reconciliation_id missing/.test(body),
    "validate_settlement must block engine_state when reconciliation_id is missing",
  );
});

Deno.test("validate_settlement — propagates edge function errors (L-0085)", () => {
  const body = caseBody(source, "validate_settlement");
  assert(
    /if\s*\(edgeError\)/.test(body),
    "validate_settlement must observe the edge function error surface",
  );
  assert(
    /status:\s*"blocked"[\s\S]{0,500}validate_settlement failed/.test(body),
    "validate_settlement must block engine_state on edge function failure " +
      "(Invariant 11 — no silent console.error swallow, ADR-0196 L-0124)",
  );
  // The old shape swallowed errors with console.error and advanced.
  // Guard against re-regression.
  assert(
    !/catch\s*\([^)]*\)\s*\{\s*console\.error[^}]*\}\s*\}\s*await advanceToNextStep/.test(body),
    "validate_settlement must not swallow edge errors and advance — this " +
      "is the exact phantom pattern B5 resolves",
  );
});

Deno.test("validate_settlement — emits ops.settlement_validated with gate linkage", () => {
  const body = caseBody(source, "validate_settlement");
  assert(
    /event_type:\s*"ops\.settlement_validated"/.test(body),
    "validate_settlement must emit ops.settlement_validated after a successful call",
  );
  assert(
    /gate_evaluation_id:\s*gateEvaluation\?\.gate_evaluation_id\s*\?\?\s*null/.test(body),
    "validate_settlement must stamp gate_evaluation_id into the engine_event payload",
  );
  assert(
    /within_threshold:\s*edgeResult\?\.within_threshold/.test(body),
    "validate_settlement must carry the edge-function outcome into the trail",
  );
});

// ──────────────────────────────────────────────────────────────────────
// lock_checkout — must actually mutate daily_reconciliation, must not
// be a pure advance-to-next stub (the pre-B5 phantom).
// ──────────────────────────────────────────────────────────────────────

Deno.test("lock_checkout — performs a real mutation (no phantom stub)", () => {
  const body = caseBody(source, "lock_checkout");
  assert(
    /\.from\("daily_reconciliation"\)\s*\.update\(\s*\{[\s\S]*?status:\s*"locked"/.test(body),
    "lock_checkout must flip daily_reconciliation.status to 'locked' " +
      "(Invariant 11 — gate passing without a mutation is the phantom pattern)",
  );
  assert(
    /locked_at:\s*nowIso/.test(body),
    "lock_checkout must stamp locked_at",
  );
  assert(
    /locked_by:\s*state\.assignee_id/.test(body),
    "lock_checkout must stamp locked_by from state.assignee_id",
  );
});

Deno.test("lock_checkout — blocks when target cannot be resolved", () => {
  const body = caseBody(source, "lock_checkout");
  assert(
    /if\s*\(!reconciliationId\)/.test(body),
    "lock_checkout must require a resolvable reconciliation_id",
  );
  assert(
    /if\s*\(fetchError\)/.test(body),
    "lock_checkout must observe the prior-row fetch error surface",
  );
  assert(
    /if\s*\(!priorRow\)/.test(body),
    "lock_checkout must block when the reconciliation row is missing",
  );
  assert(
    /workspace mismatch/.test(body),
    "lock_checkout must refuse to mutate rows belonging to a different " +
      "workspace than the engine_state (service-role safety belt)",
  );
});

Deno.test("lock_checkout — is idempotent when target already locked", () => {
  const body = caseBody(source, "lock_checkout");
  assert(
    /wasAlreadyLocked\s*=\s*priorRow\.status\s*===\s*"locked"/.test(body),
    "lock_checkout must detect already-locked rows (idempotent re-run)",
  );
  assert(
    /if\s*\(!wasAlreadyLocked\)/.test(body),
    "lock_checkout must skip the UPDATE when already locked",
  );
  assert(
    /was_already_locked:\s*wasAlreadyLocked/.test(body),
    "lock_checkout engine_event payload must surface the idempotency signal",
  );
});

Deno.test("lock_checkout — emits ops.checkout_locked with gate linkage", () => {
  const body = caseBody(source, "lock_checkout");
  assert(
    /event_type:\s*"ops\.checkout_locked"/.test(body),
    "lock_checkout must emit ops.checkout_locked",
  );
  assert(
    /gate_evaluation_id:\s*gateEvaluation\?\.gate_evaluation_id\s*\?\?\s*null/.test(body),
    "lock_checkout must stamp gate_evaluation_id into the engine_event payload (L-0134)",
  );
});

// ──────────────────────────────────────────────────────────────────────
// Aggregate guard — cross-handler coverage
// ──────────────────────────────────────────────────────────────────────

Deno.test("all three HACCP handlers emit a domain-specific engine_event", () => {
  for (const [caseName, eventType] of [
    ["create_deviation", "ops.deviation_created"],
    ["validate_settlement", "ops.settlement_validated"],
    ["lock_checkout", "ops.checkout_locked"],
  ] as const) {
    const body = caseBody(source, caseName);
    assertEquals(
      body.includes(`event_type: "${eventType}"`),
      true,
      `${caseName} must emit ${eventType} on success — Invariant 11 requires ` +
        "a verifiable artefact per handler (ADR-0196 / L-0124)",
    );
  }
});
