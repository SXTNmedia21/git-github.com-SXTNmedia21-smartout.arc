// =============================================================================
// error_hygiene_test.ts — F-EF-07 regression guard for heartbeat-dispatcher
// -----------------------------------------------------------------------------
// S2: error path on heartbeat_pickup RPC failure must NOT return error.message
//     in response body. Full detail goes to console.error; caller receives
//     { error: "internal" }.
//
// Uses source-parsing approach — importing the handler would start Deno.serve.
//
// Run: deno test --allow-read supabase/functions/heartbeat-dispatcher/error_hygiene_test.ts
// =============================================================================

import { assert } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

// ─── F-EF-07: RPC error branch must NOT expose error.message ─────────────────
Deno.test("F-EF-07 S2: RPC error branch does NOT use error.message in JSON response body", () => {
  // Find the RPC error check block
  const errorCheckIdx = source.indexOf("if (error)");
  assert(errorCheckIdx !== -1, "if (error) check not found — RPC error handler missing");

  const errorBlock = source.slice(errorCheckIdx, errorCheckIdx + 300);
  assert(
    !errorBlock.includes("error.message"),
    "F-EF-07 regression: RPC error branch must NOT return error.message — use { error: 'internal' }",
  );
});

Deno.test("F-EF-07 S2: RPC error branch returns opaque { error: 'internal' } body", () => {
  const errorCheckIdx = source.indexOf("if (error)");
  assert(errorCheckIdx !== -1, "if (error) check not found in source");

  const errorBlock = source.slice(errorCheckIdx, errorCheckIdx + 300);
  assert(
    errorBlock.includes('"internal"'),
    "F-EF-07 fix missing: RPC error branch must include { error: 'internal' }",
  );
});

Deno.test("F-EF-07 S2: RPC error branch logs full detail via console.error", () => {
  const errorCheckIdx = source.indexOf("if (error)");
  assert(errorCheckIdx !== -1, "if (error) check not found in source");

  const errorBlock = source.slice(errorCheckIdx, errorCheckIdx + 300);
  assert(
    errorBlock.includes("console.error"),
    "F-EF-07 fix missing: RPC error branch must call console.error to retain full detail server-side",
  );
});

Deno.test("F-EF-07 S2: RPC error branch returns HTTP 500", () => {
  const errorCheckIdx = source.indexOf("if (error)");
  assert(errorCheckIdx !== -1, "if (error) check not found in source");

  const errorBlock = source.slice(errorCheckIdx, errorCheckIdx + 300);
  assert(
    errorBlock.includes("status: 500"),
    "F-EF-07: RPC error path must return HTTP 500",
  );
});
