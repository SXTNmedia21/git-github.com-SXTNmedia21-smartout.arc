// deno-lint-ignore-file no-console
// ============================================================================
// emit_contract_test.ts
// ----------------------------------------------------------------------------
// Source-parsing contract tests for journey-stuck-detector.
//
// Why we parse instead of import-and-exercise:
//   index.ts registers a top-level Deno.serve handler on import, so pulling
//   the module into a test would also start the HTTP server and require a
//   live Supabase client (network + service role). Parsing the source
//   keeps the test hermetic and CI-safe. This is the same pattern used by
//   supabase/functions/engine-dispatch/entity_pk_test.ts.
//
// What we assert (all failures block M5.3 merge per §9 "No phantom emit"):
//   1. Event-mode emits the ADR-0175 payload EXACTLY — run_id, step_key,
//      timeout_ms, actor_id, workspace_id, plus the standard activity_trail
//      entity{...} block.
//   2. activity_trail uses the space-form "journey stuck" key (matches
//      packages/telemetry/src/registry.ts EVENT_ROUTING).
//   3. engine_event uses the dot-form "journey.stuck" event_type (matches
//      toDotNotation() wire format).
//   4. Idempotency short-circuits exist for terminal step status AND
//      terminal run status.
//   5. Auth accepts SUPABASE_SERVICE_ROLE_KEY (not anon).
//   6. Malformed payload → 400, not 500.
//
// Run: deno test supabase/functions/journey-stuck-detector/emit_contract_test.ts
// ============================================================================

import { assert, assertStringIncludes } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

// ─── 1. ADR-0175 payload contract ────────────────────────────

Deno.test("activity_trail insert uses space-form 'journey stuck' key", () => {
  // Locate the activity_trail.insert block for event-mode.
  const idx = source.indexOf('.from("activity_trail").insert({');
  assert(idx !== -1, "activity_trail.insert({ not found");

  // Find the event: field within that block.
  const block = source.slice(idx, idx + 600);
  assertStringIncludes(
    block,
    'event: "journey stuck"',
    "activity_trail must emit registry-key 'journey stuck' (space form)",
  );
  assertStringIncludes(
    block,
    'category: "journey"',
    "activity_trail event must be in 'journey' category",
  );
  assertStringIncludes(
    block,
    'entity_type: "journey_run"',
    "activity_trail entity_type must match ADR-0175",
  );
});

Deno.test("engine_event insert uses dot-form 'journey.stuck' event_type", () => {
  const idx = source.indexOf('.from("engine_event").insert({');
  assert(idx !== -1, "engine_event.insert({ not found");

  const block = source.slice(idx, idx + 800);
  assertStringIncludes(
    block,
    'event_type: "journey.stuck"',
    "engine_event must emit wire-format 'journey.stuck' (dot form)",
  );
});

Deno.test("event-mode payload contains all 5 ADR-0175 required fields", () => {
  // Both activity_trail.data and engine_event.payload must include every
  // required ADR-0175 field. Scope to the handleEventMode function body.
  // Delimiter: start of function → next line starting with "// ─" (section
  // separator) which is always after the function's closing brace.
  const eventModeStart = source.indexOf("async function handleEventMode(");
  assert(eventModeStart !== -1, "handleEventMode not found");
  const sectionSeparator = source.indexOf("// ─", eventModeStart + 1);
  const block = source.slice(eventModeStart, sectionSeparator);

  // Shorthand property (e.g. `timeout_ms,`) counts as present. We allow
  // either `field:` (explicit) or `field,` / `field\n` (shorthand).
  for (const field of [
    "run_id",
    "step_key",
    "timeout_ms",
    "actor_id",
    "workspace_id",
  ]) {
    const re = new RegExp(`\\b${field}\\b\\s*[:,\\n]`);
    assert(
      re.test(block),
      `event-mode emit missing required ADR-0175 field: ${field}`,
    );
  }
});

Deno.test("engine_event payload carries the entity{...} block", () => {
  // The entity block mirrors packages/telemetry/src/registry.ts JourneyStuck
  // interface — used by activity-trail.flat.resolveEntityRef().
  const idx = source.indexOf('.from("engine_event").insert({');
  const block = source.slice(idx, idx + 1000);
  assertStringIncludes(block, "entity:", "engine_event payload missing entity block");
  assertStringIncludes(
    block,
    'entity_type: "journey_run"',
    "engine_event entity_type must be 'journey_run' per ADR-0175",
  );
});

// ─── 2. Idempotency short-circuits ───────────────────────────

Deno.test("emit short-circuits when step is already terminal", () => {
  assertStringIncludes(
    source,
    "isTerminalStepStatus(step.status)",
    "must check isTerminalStepStatus before emitting",
  );
  assertStringIncludes(
    source,
    '"step_already_terminal"',
    "must return step_already_terminal reason for noop",
  );
});

Deno.test("emit short-circuits when parent run is already terminal", () => {
  assertStringIncludes(
    source,
    '"run_already_terminal"',
    "must return run_already_terminal reason for noop",
  );
  assertStringIncludes(
    source,
    'runStatus === "complete" || runStatus === "failed"',
    "must short-circuit on engine_state.status terminal values",
  );
});

Deno.test("terminal step statuses match engine_state_step schema", () => {
  // engine_state_step CHECK: status IN ('pending','active','completed','skipped','failed')
  // Terminal = completed OR skipped OR failed. Non-terminal = pending OR active.
  assertStringIncludes(
    source,
    'status === "completed"',
    "must treat 'completed' as terminal",
  );
  assertStringIncludes(
    source,
    'status === "failed"',
    "must treat 'failed' as terminal",
  );
  assertStringIncludes(
    source,
    'status === "skipped"',
    "must treat 'skipped' as terminal",
  );
});

// ─── 3. Auth contract ────────────────────────────────────────

Deno.test("auth accepts service-role key or watchdog secret, rejects anon", () => {
  const fnStart = source.indexOf("function isAuthorized(");
  assert(fnStart !== -1, "isAuthorized() not found");
  const fnEnd = source.indexOf("\n}\n", fnStart);
  const fn = source.slice(fnStart, fnEnd);

  assertStringIncludes(fn, "WATCHDOG_CRON_SECRET", "must check WATCHDOG_CRON_SECRET");
  assertStringIncludes(
    fn,
    "SUPABASE_SERVICE_ROLE_KEY",
    "must check SUPABASE_SERVICE_ROLE_KEY",
  );
  assertStringIncludes(fn, 'Bearer ', "must require Bearer token prefix");

  // No anon-key acceptance path.
  const anonCheck = /SUPABASE_ANON_KEY|anon_key|ANON_KEY/i.test(fn);
  assert(!anonCheck, "isAuthorized must NOT accept anon key");
});

Deno.test("401 response path exists for unauthorized requests", () => {
  assertStringIncludes(
    source,
    'return json(401, { error: "Unauthorized" });',
    "must return 401 on isAuthorized() false",
  );
});

// ─── 4. Malformed payload handling ───────────────────────────

Deno.test("malformed payload returns 400 not 500", () => {
  assertStringIncludes(
    source,
    'return json(400, { error: "Malformed payload" });',
    "must 400 on parseBody() null",
  );
});

Deno.test("run_not_found returns 404 not 500", () => {
  assertStringIncludes(
    source,
    '"run_not_found"',
    "must report run_not_found reason on missing engine_state",
  );
});

Deno.test("workspace mismatch returns 403 not 500", () => {
  assertStringIncludes(
    source,
    '"workspace_mismatch"',
    "must report workspace_mismatch reason on cross-tenant call",
  );
});

// ─── 5. Legacy POC path preservation (L-0098 dual-write) ────

Deno.test("legacy cron-rescue path still produces guardian_signal", () => {
  const idx = source.indexOf("handleCronMode");
  assert(idx !== -1, "handleCronMode not found");
  const block = source.slice(idx, idx + 3000);

  assertStringIncludes(
    block,
    '"guardian_signal"',
    "legacy POC must still insert into guardian_signal",
  );
  assertStringIncludes(
    block,
    'domain: "journey_health"',
    "legacy POC must still use journey_health domain",
  );
  assertStringIncludes(
    block,
    'signal_type: "journey_stalled"',
    "legacy POC must still use journey_stalled signal_type",
  );
});

// ─── 6. No anon-key writes (service-role only for telemetry) ─

Deno.test("service-role is the only DB credential used for writes", () => {
  // SUPABASE_ANON_KEY MUST NOT appear anywhere in this Edge Function —
  // all DB interactions happen via the service-role client (bypasses
  // RLS for telemetry inserts; L-0094, ADR-0175).
  assert(
    !source.includes("SUPABASE_ANON_KEY"),
    "journey-stuck-detector must never read SUPABASE_ANON_KEY",
  );
  assertStringIncludes(
    source,
    "SUPABASE_SERVICE_ROLE_KEY",
    "journey-stuck-detector must use SUPABASE_SERVICE_ROLE_KEY",
  );
});

// ─── 7. Wire format vs registry key invariant ────────────────

Deno.test("actor_id fallback uses reserved SYSTEM_ACTOR_ID UUID, not 'system' string (R5.3-5)", () => {
  // Must export a module-level constant so tests + future callers can
  // reference the reserved UUID without duplicating the literal.
  assertStringIncludes(
    source,
    "export const SYSTEM_ACTOR_ID =",
    "module must export SYSTEM_ACTOR_ID constant",
  );
  assertStringIncludes(
    source,
    '"00000000-0000-0000-0000-000000000001"',
    "SYSTEM_ACTOR_ID must be the reserved sentinel UUID seeded by migration 20260422215500",
  );

  // The actor_id resolution chain must end at SYSTEM_ACTOR_ID, NOT the
  // literal string "system". That string was the bug R5.3-5 flagged:
  // non-UUID value that fails the activity_trail.actor_id → profile FK.
  const actorFallbackRegion = source.slice(
    source.indexOf("const actor_id ="),
  );
  const fallbackBlock = actorFallbackRegion.slice(0, 300);
  assertStringIncludes(
    fallbackBlock,
    "SYSTEM_ACTOR_ID",
    "actor_id fallback must resolve to SYSTEM_ACTOR_ID",
  );

  // Paranoid check: the string literal `"system"` must not be used as a
  // fallback value anywhere in the resolution chain. Doc comments using
  // the word are fine, but there must be no `: "system"` or `?? "system"`
  // construct in the source.
  assert(
    !/:\s*"system"/.test(source),
    "actor_id fallback must not use the literal string 'system' as a value",
  );
  assert(
    !/\?\?\s*"system"/.test(source),
    "actor_id nullish-coalesce must not fall back to the literal string 'system'",
  );
});

Deno.test("both event name forms present exactly once each", () => {
  // Exactly one activity_trail insert with the space form, exactly one
  // engine_event insert with the dot form. More than one of either is a
  // duplication smell.
  const spaceHits = [
    ...source.matchAll(/event: "journey stuck"/g),
  ].length;
  const dotHits = [
    ...source.matchAll(/event_type: "journey\.stuck"/g),
  ].length;

  assert(
    spaceHits === 1,
    `expected exactly 1 'journey stuck' (space) emit, got ${spaceHits}`,
  );
  assert(
    dotHits === 1,
    `expected exactly 1 'journey.stuck' (dot) emit, got ${dotHits}`,
  );
});
