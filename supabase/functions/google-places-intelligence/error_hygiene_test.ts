// =============================================================================
// error_hygiene_test.ts — F-EF-08 regression guard for google-places-intelligence
// -----------------------------------------------------------------------------
// S3: catch block on unhandled exception must return HTTP 500 (not 200) with
//     opaque { success: false, error: "internal" } body.
//     Was: HTTP 200 + { success: true, reason: "exception", error: error.message }
//     — misleading to monitors and leaks internal error detail.
//
// Uses source-parsing approach — importing the handler would start Deno.serve.
//
// Run: deno test --allow-read supabase/functions/google-places-intelligence/error_hygiene_test.ts
// =============================================================================

import { assert } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

// ─── F-EF-08: catch block must NOT leak error detail or return HTTP 200 ───────
Deno.test("F-EF-08 S3: catch block does NOT include error.message or String(error) in response", () => {
  const catchIdx = source.lastIndexOf("} catch (error: unknown)");
  assert(catchIdx !== -1, "catch block not found — expected '} catch (error: unknown)'");

  const catchBody = source.slice(catchIdx, catchIdx + 600);
  assert(
    !catchBody.includes("error.message"),
    "F-EF-08 regression: catch must NOT return error.message in body",
  );
  assert(
    !catchBody.includes("String(error)"),
    "F-EF-08 regression: catch must NOT return String(error) in body",
  );
  assert(
    !catchBody.includes('"exception"'),
    "F-EF-08 regression: reason:exception exposes info about internal flow — remove from response",
  );
});

Deno.test("F-EF-08 S3: catch block returns HTTP 500 (not 200)", () => {
  const catchIdx = source.lastIndexOf("} catch (error: unknown)");
  assert(catchIdx !== -1, "catch block not found in source");

  const catchBody = source.slice(catchIdx, catchIdx + 600);
  assert(
    catchBody.includes("status: 500"),
    "F-EF-08 fix missing: exception path must return HTTP 500 — monitors need correct status codes",
  );
  // Ensure the old HTTP 200 fallthrough is gone from the catch block
  assert(
    !catchBody.includes("status: 200"),
    "F-EF-08 regression: catch block must NOT return status 200 for exceptions",
  );
});

Deno.test("F-EF-08 S3: catch block returns { success: false, error: 'internal' }", () => {
  const catchIdx = source.lastIndexOf("} catch (error: unknown)");
  assert(catchIdx !== -1, "catch block not found in source");

  const catchBody = source.slice(catchIdx, catchIdx + 600);
  assert(
    catchBody.includes('"internal"'),
    "F-EF-08 fix missing: catch body must include { error: 'internal' }",
  );
  assert(
    catchBody.includes("success: false") || catchBody.includes('"success":false'),
    "F-EF-08 fix missing: catch body must include success: false to signal failure clearly",
  );
  // The old success: true must be gone from catch block
  assert(
    !catchBody.includes("success: true"),
    "F-EF-08 regression: catch block must NOT return success: true for exceptions",
  );
});

Deno.test("F-EF-08 S3: catch block logs full detail via console.error", () => {
  const catchIdx = source.lastIndexOf("} catch (error: unknown)");
  assert(catchIdx !== -1, "catch block not found in source");

  const catchBody = source.slice(catchIdx, catchIdx + 600);
  assert(
    catchBody.includes("console.error"),
    "F-EF-08 fix missing: catch block must call console.error to retain full error detail server-side",
  );
});
