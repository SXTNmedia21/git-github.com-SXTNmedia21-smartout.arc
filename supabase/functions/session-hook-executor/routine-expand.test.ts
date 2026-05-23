// =============================================================================
// routine-expand.test.ts — G6 regression guard for session-hook-executor
// -----------------------------------------------------------------------------
// Verifies that the linked_routine_id branch:
//   (a) expands routine steps into one task per step (not a single stub),
//   (b) stamps the provenance triple (origin='routine', generated_by='cron',
//       source_reference=routine_id),
//   (c) resolves day_line_id via fn_resolve_single_day_line (ADR-0367).
//
// Uses the source-parsing approach (same pattern as analyze-workspace/auth_test.ts
// and engine-dispatch/update_context_targeted_test.ts) to avoid importing the
// handler, starting Deno.serve, or requiring a live Supabase connection.
//
// Run: deno test --allow-read supabase/functions/session-hook-executor/routine-expand.test.ts
// =============================================================================

import { assert } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

// ─── G6 fix: stub replaced by per-step expansion ─────────────────────────────

Deno.test("G6: linked_routine_id branch resolves procedure_id via procedureIdByRoutine map", () => {
  // The fix requires a lookup map built from routine rows before the hot loop.
  assert(
    source.includes("procedureIdByRoutine"),
    "G6 regression: procedureIdByRoutine map not found — stub has NOT been replaced with per-step expansion",
  );
});

Deno.test("G6: routine branch iterates routineSteps (not a single insert)", () => {
  // The expanded branch must use routineSteps.map(...) not a singular insert.
  assert(
    source.includes("routineSteps.map("),
    "G6 regression: routineSteps.map() not found — routine branch still inserts a single stub task",
  );
});

Deno.test("G6: routine branch does NOT contain stub title 'Rutine: '", () => {
  // The old stub used a hardcoded `Rutine: ${hook.hook_type}` title.
  // After the fix this literal must not appear.
  assert(
    !source.includes("`Rutine: ${hook.hook_type}`"),
    "G6 regression: stub title 'Rutine: ${hook.hook_type}' still present — single-stub path not removed",
  );
});

// ─── Provenance triple ────────────────────────────────────────────────────────

Deno.test("provenance: routine branch stamps origin = 'routine'", () => {
  assert(
    source.includes("origin: \"routine\""),
    "Provenance triple incomplete: origin='routine' not found in routine branch",
  );
});

Deno.test("provenance: routine branch stamps generated_by = 'cron'", () => {
  // Both procedure and routine branches should set generated_by='cron'.
  // Count occurrences — must appear at least twice (once per branch).
  const matches = source.match(/generated_by:\s*["']cron["']/g) ?? [];
  assert(
    matches.length >= 2,
    `Provenance triple: expected ≥2 generated_by='cron' entries (procedure + routine branch), found ${matches.length}`,
  );
});

Deno.test("provenance: routine branch stamps source_reference = hook.linked_routine_id", () => {
  assert(
    source.includes("source_reference: hook.linked_routine_id"),
    "Provenance triple incomplete: source_reference=hook.linked_routine_id not found in routine branch",
  );
});

Deno.test("provenance: procedure branch stamps origin = 'procedure'", () => {
  assert(
    source.includes("origin: \"procedure\""),
    "Provenance triple incomplete: origin='procedure' not found in procedure branch",
  );
});

Deno.test("provenance: procedure branch stamps source_reference = hook.linked_procedure_id", () => {
  assert(
    source.includes("source_reference: hook.linked_procedure_id"),
    "Provenance triple incomplete: source_reference=hook.linked_procedure_id not found in procedure branch",
  );
});

// ─── day_line_id anchoring (ADR-0367) ────────────────────────────────────────

Deno.test("ADR-0367: fn_resolve_single_day_line called before both task-insert branches", () => {
  const resolveIdx = source.indexOf("fn_resolve_single_day_line");
  const procedureInsertIdx = source.indexOf("linked_procedure_id) {");
  const routineInsertIdx = source.indexOf("linked_routine_id) {");

  assert(resolveIdx !== -1, "fn_resolve_single_day_line not found in source");
  assert(procedureInsertIdx !== -1, "linked_procedure_id branch not found");
  assert(routineInsertIdx !== -1, "linked_routine_id branch not found");

  // The RPC call must precede both branches
  assert(
    resolveIdx < procedureInsertIdx,
    "ADR-0367: fn_resolve_single_day_line must be called BEFORE the linked_procedure_id branch",
  );
  assert(
    resolveIdx < routineInsertIdx,
    "ADR-0367: fn_resolve_single_day_line must be called BEFORE the linked_routine_id branch",
  );
});

Deno.test("ADR-0367: routine branch passes anchoredDayLineId to day_line_id", () => {
  // Both branches must pass day_line_id: anchoredDayLineId ?? null
  const matches = source.match(/day_line_id:\s*anchoredDayLineId\s*\?\?\s*null/g) ?? [];
  assert(
    matches.length >= 2,
    `ADR-0367: expected ≥2 day_line_id: anchoredDayLineId ?? null entries (procedure + routine branch), found ${matches.length}`,
  );
});

// ─── Routine pre-fetch (batch query before hot loop) ─────────────────────────

Deno.test("perf: routine rows fetched in batch before the session loop (not inside loop)", () => {
  // The routine SELECT must appear BEFORE the `for (const session of sessions)` loop.
  const routineSelectIdx = source.indexOf('from("routine")');
  const sessionLoopIdx = source.indexOf("for (const session of sessions)");

  assert(routineSelectIdx !== -1, '"routine" table select not found in source');
  assert(sessionLoopIdx !== -1, "session loop not found in source");
  assert(
    routineSelectIdx < sessionLoopIdx,
    "Perf: routine rows should be fetched BEFORE the session loop, not inside it",
  );
});

Deno.test("perf: routine step fetch also runs before the session loop", () => {
  const routineStepsSelectIdx = source.indexOf("routineProcedureIds");
  const sessionLoopIdx = source.indexOf("for (const session of sessions)");

  assert(routineStepsSelectIdx !== -1, "routineProcedureIds not found — batch pre-fetch missing");
  assert(sessionLoopIdx !== -1, "session loop not found in source");
  assert(
    routineStepsSelectIdx < sessionLoopIdx,
    "Perf: routine step pre-fetch must happen BEFORE the session loop",
  );
});
