// deno-lint-ignore-file no-console
// ============================================================================
// update_context_test.ts
// ----------------------------------------------------------------------------
// Structural guards for the `update_context` action_type added in T4 of
// PLAN-helpdesk-sla-timeout.md (ADR-0227 / Helpdesk SLA Phase 2).
//
// `update_context` is a sibling of `update_entity` but targets the
// CURRENT engine_state (state.id), not the linked domain row
// (state.entity_id). It exists so helpdesk_query_lifecycle step 4 can
// patch context.sla_breached_at after the wait_for_event resume.
//
// Why source-parsing (same pattern as entity_pk_test.ts +
// haccp_phase2c_test.ts):
//   index.ts registers a top-level Deno.serve handler on import, so
//   pulling the module into a test would also start the HTTP server.
//   Parsing the source keeps the test hermetic and dependency-free.
//   Behavioral tests live in the deno-test / pgTAP suite (not yet
//   present for this handler — see comment block at the top of the
//   case in index.ts for the manual sanity-check recipe).
//
// What the tests guard:
//   1. Action type added to GATED_MUTATION_TYPES (ADR-0099).
//   2. Handler patches engine_state by id (NOT entity_id) — the entire
//      reason this handler exists, distinct from update_entity.
//   3. Shallow merge is preserved (Phase 1 helpdesk tools write
//      desk_channel_id + summary + requester_profile_id at spawn —
//      must survive context patches).
//   4. Failure mode follows update_entity precedent: status="blocked"
//      + last_error + early return (L-0085 silent-noop guard).
//   5. Defensive guards exist for missing/malformed `set`, nested-path
//      keys, and immutable id/workspace_id.
//   6. PII-safe logging — patch keys only, never values (ADR-0163).
//
// Run: deno test supabase/functions/engine-dispatch/update_context_test.ts
// ============================================================================

import { assert } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

/**
 * Extract the body of a `case "<name>": {` branch in executeStep.
 * Returns everything between the opening `{` after the case label and
 * the matching closing `}` before the next sibling `case ` / `default:`.
 * Mirrors the helper in haccp_phase2c_test.ts.
 */
function caseBody(text: string, caseName: string): string {
  const marker = `case "${caseName}":`;
  const start = text.indexOf(marker);
  assert(start !== -1, `case "${caseName}" not found in index.ts`);
  // Find the next case or default after start
  const nextCase = text.indexOf("\n    case ", start + marker.length);
  const nextDefault = text.indexOf("\n    default:", start + marker.length);
  const candidates = [nextCase, nextDefault].filter((i) => i !== -1);
  const end = candidates.length > 0 ? Math.min(...candidates) : text.length;
  return text.slice(start, end);
}

// ---------------------------------------------------------------------------
// 1. GATED_MUTATION_TYPES inclusion
// ---------------------------------------------------------------------------

Deno.test("update_context is in GATED_MUTATION_TYPES (ADR-0099)", () => {
  // The set is defined inline inside executeStep — grep for the literal.
  const gatedBlockStart = source.indexOf("const GATED_MUTATION_TYPES = new Set([");
  assert(gatedBlockStart !== -1, "GATED_MUTATION_TYPES literal not found");
  const gatedBlockEnd = source.indexOf("]);", gatedBlockStart);
  assert(gatedBlockEnd !== -1, "GATED_MUTATION_TYPES terminator not found");
  const block = source.slice(gatedBlockStart, gatedBlockEnd);
  assert(
    block.includes('"update_context"'),
    "update_context must be in GATED_MUTATION_TYPES so SLA-driven context patches go through gate_action",
  );
});

// ---------------------------------------------------------------------------
// 2. Handler exists and targets state.id (NOT entity_id)
// ---------------------------------------------------------------------------

Deno.test("update_context — case branch exists in executeStep switch", () => {
  const body = caseBody(source, "update_context");
  assert(body.length > 0, "update_context case branch is empty");
  assert(body.includes("case \"update_context\":"), "case label missing");
});

Deno.test("update_context — targets state.id, never state.entity_id", () => {
  const body = caseBody(source, "update_context");
  assert(
    body.includes('.eq("id", state.id)'),
    "update_context must filter by state.id — that is the entire reason this handler exists, distinct from update_entity",
  );
  assert(
    !body.includes("state.entity_id"),
    "update_context must NOT reference state.entity_id — that is update_entity's domain (different row)",
  );
});

Deno.test("update_context — updates the engine_state table directly", () => {
  const body = caseBody(source, "update_context");
  assert(
    body.includes('.from("engine_state")'),
    "update_context must operate on engine_state",
  );
});

// ---------------------------------------------------------------------------
// 3. Shallow merge of context
// ---------------------------------------------------------------------------

Deno.test("update_context — shallow-merges patch with existing context", () => {
  const body = caseBody(source, "update_context");
  // Look for the spread merge pattern: `{ ...current, ...patch }`
  assert(
    /\{\s*\.\.\.current,\s*\.\.\.patch\s*\}/.test(body),
    "update_context must shallow-merge: { ...current, ...patch } — Phase 1 spawns context with desk_channel_id + summary + requester_profile_id, must be preserved",
  );
});

Deno.test("update_context — falls back to empty object when state.context is null", () => {
  const body = caseBody(source, "update_context");
  assert(
    body.includes("?? {}") || body.includes("?? ({} as"),
    "update_context must default state.context to {} when null (engine_state.context is nullable)",
  );
});

// ---------------------------------------------------------------------------
// 4. Failure mode follows update_entity precedent (L-0085)
// ---------------------------------------------------------------------------

Deno.test("update_context — blocks engine_state on update error (L-0085)", () => {
  const body = caseBody(source, "update_context");
  assert(
    body.includes('status: "blocked"'),
    "update_context must set status='blocked' on failure (mirrors update_entity precedent — L-0085 silent-noop guard)",
  );
  assert(
    body.includes("last_error:"),
    "update_context must record last_error so ops can diagnose blocked states",
  );
  assert(
    body.includes("return;"),
    "update_context must early-return on failure — never advance after a blocked state",
  );
});

// ---------------------------------------------------------------------------
// 5. Defensive guards
// ---------------------------------------------------------------------------

Deno.test("update_context — guards against missing or non-object `set`", () => {
  const body = caseBody(source, "update_context");
  assert(
    body.includes("typeof rawPatch !== \"object\"") || body.includes("!rawPatch"),
    "update_context must guard against missing `set` payload",
  );
  assert(
    body.includes("missing or non-object `set`"),
    "update_context must record a clear last_error for missing `set`",
  );
});

Deno.test("update_context — rejects nested-path keys (foo.bar)", () => {
  const body = caseBody(source, "update_context");
  assert(
    body.includes('k.includes(".")') || body.includes('".")'),
    "update_context must reject nested-path keys — shallow merge would create literal 'foo.bar' top-level keys",
  );
  assert(
    body.includes("nested-path keys not allowed"),
    "update_context must record a clear last_error for nested-path attempts",
  );
});

Deno.test("update_context — strips immutable id and workspace_id keys", () => {
  const body = caseBody(source, "update_context");
  assert(
    body.includes('"id"') && body.includes('"workspace_id"'),
    "update_context must strip id + workspace_id — they are tenant/identity anchors, never patchable from a step",
  );
  assert(
    body.includes("stripped_immutable_keys"),
    "update_context must warn-log when an immutable key is stripped (helps misconfigured blueprints surface)",
  );
});

// ---------------------------------------------------------------------------
// 6. PII-safe logging (ADR-0163)
// ---------------------------------------------------------------------------

Deno.test("update_context — logs patch_keys only, never patch values (ADR-0163)", () => {
  const body = caseBody(source, "update_context");
  assert(
    body.includes("patch_keys:"),
    "update_context must log Object.keys(patch) for debuggability",
  );
  assert(
    !body.includes("patch_values:") && !body.includes("JSON.stringify(patch)"),
    "update_context must NEVER log patch values — context can carry PII (requester_profile_id, summaries) per ADR-0163",
  );
});

// ---------------------------------------------------------------------------
// 7. Advances on success
// ---------------------------------------------------------------------------

Deno.test("update_context — advances to next step on success", () => {
  const body = caseBody(source, "update_context");
  assert(
    body.includes("await advanceToNextStep(supabase, state, step);"),
    "update_context must call advanceToNextStep on success — mirrors all other passive handlers",
  );
});
