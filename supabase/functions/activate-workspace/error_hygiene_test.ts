// =============================================================================
// error_hygiene_test.ts — F-EF-06 regression guard for activate-workspace
// -----------------------------------------------------------------------------
// S1: catch block must NOT return error.message in response body.
//     Full detail goes to console.error; caller receives { error: "internal" }.
//
// Uses source-parsing approach — importing the handler would start Deno.serve.
//
// Run: deno test --allow-read supabase/functions/activate-workspace/error_hygiene_test.ts
// =============================================================================

import { assert } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

// ─── F-EF-06: catch block must NOT expose error.message ──────────────────────
Deno.test("F-EF-06 S1: catch block does NOT use error.message in JSON response body", () => {
  // Find the outer catch block (the one wrapping the main handler logic).
  const catchIdx = source.lastIndexOf("} catch (error)");
  assert(catchIdx !== -1, "catch block not found in source");

  const catchBody = source.slice(catchIdx, catchIdx + 400);
  assert(
    !catchBody.includes("error.message"),
    "F-EF-06 regression: catch block must NOT return error.message in response body — use { error: 'internal' }",
  );
});

Deno.test("F-EF-06 S1: catch block returns opaque { error: 'internal' } body", () => {
  const catchIdx = source.lastIndexOf("} catch (error)");
  assert(catchIdx !== -1, "catch block not found in source");

  const catchBody = source.slice(catchIdx, catchIdx + 400);
  assert(
    catchBody.includes('"internal"'),
    "F-EF-06 fix missing: catch body must include { error: 'internal' }",
  );
});

Deno.test("F-EF-06 S1: catch block logs full detail via console.error", () => {
  const catchIdx = source.lastIndexOf("} catch (error)");
  assert(catchIdx !== -1, "catch block not found in source");

  const catchBody = source.slice(catchIdx, catchIdx + 400);
  assert(
    catchBody.includes("console.error"),
    "F-EF-06 fix missing: catch block must call console.error to retain full error detail server-side",
  );
});

Deno.test("F-EF-06 S1: catch block returns HTTP 500 (not 400)", () => {
  const catchIdx = source.lastIndexOf("} catch (error)");
  assert(catchIdx !== -1, "catch block not found in source");

  const catchBody = source.slice(catchIdx, catchIdx + 400);
  assert(
    catchBody.includes("status: 500"),
    "F-EF-06 fix: unhandled server errors must return HTTP 500, not 400",
  );
  assert(
    !catchBody.includes("status: 400"),
    "F-EF-06 regression: catch block must not return 400 for unhandled server errors",
  );
});
