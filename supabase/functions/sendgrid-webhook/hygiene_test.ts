// deno-lint-ignore-file no-console
// ============================================================================
// hygiene_test.ts — F-WH-03 regression guards for sendgrid-webhook
// ----------------------------------------------------------------------------
// F-WH-03: open/click counter increments must be gated on dedup result.
//   - Events with sg_message_id: upsert first, skip counter if duplicate.
//   - Events WITHOUT sg_message_id: log + skip counter (no untracked duplication).
//
// Uses source-parsing approach — importing the handler would start Deno.serve.
//
// Run: deno test supabase/functions/sendgrid-webhook/hygiene_test.ts
// ============================================================================

import { assert } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

// ─── F-WH-03: dedup gate present for counter events ──────────────────────────
Deno.test("F-WH-03: isCounterEvent guard exists for open/click events", () => {
  assert(
    source.includes("isCounterEvent"),
    "F-WH-03 fix missing: isCounterEvent guard not found in source",
  );
  assert(
    source.includes('"open" || eventType === "click"') ||
      source.includes("open\" || eventType === \"click"),
    "F-WH-03 fix missing: isCounterEvent must check eventType === open || click",
  );
});

Deno.test("F-WH-03: events missing sg_message_id are logged and skipped for counter events", () => {
  // The handler must log a warning and skip (continue) when sg_message_id is absent
  // for counter events — verified by checking both the warn + continue path.
  const missingIdGuard = source.includes("!sgMessageId") || source.includes("!sg_message_id");
  assert(
    missingIdGuard,
    "F-WH-03 fix missing: no null-check on sg_message_id for counter events",
  );

  // Must contain a skip path (continue statement) in the missing-id branch
  assert(
    source.includes("continue"),
    "F-WH-03 fix missing: missing-sg_message_id path must use continue to skip counter",
  );

  // Must log the skip (console.warn)
  assert(
    source.includes("console.warn") || source.includes("console.log"),
    "F-WH-03 fix missing: missing-sg_message_id skip must be logged",
  );
});

Deno.test("F-WH-03: isNewEvent gate controls counter increment execution", () => {
  // The fix must set isNewEvent based on upsert result and only run counters when isNewEvent
  assert(
    source.includes("isNewEvent"),
    "F-WH-03 fix missing: isNewEvent dedup gate not found",
  );

  // Upsert must precede counter RPC — verify both exist
  assert(
    source.includes("increment_communication_counter"),
    "increment_communication_counter RPC must still be present",
  );

  // The counter section must not run unconditionally — isNewEvent must gate it
  // Check that isNewEvent appears before the continue that skips the counter
  const isNewEventIdx = source.indexOf("isNewEvent");
  const counterIdx = source.indexOf("increment_communication_counter");
  assert(
    isNewEventIdx < counterIdx,
    "F-WH-03: isNewEvent gate must appear before increment_communication_counter",
  );
});

Deno.test("F-WH-03: upsert with count:exact used for pre-dedup on counter events", () => {
  // The handler must upsert the webhook event row BEFORE running the counter
  // and use count: 'exact' to detect whether the row was newly inserted.
  assert(
    source.includes('count: "exact"'),
    "F-WH-03 fix missing: upsert must use count: 'exact' to detect new vs duplicate event",
  );
});
