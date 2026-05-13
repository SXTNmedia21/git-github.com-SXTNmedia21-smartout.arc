// =============================================================================
// auth_test.ts — F-EF-05 regression guard for analyze-workspace
// -----------------------------------------------------------------------------
// S4: anon call without valid bearer → 401 response (verifyInternalAuth gate)
// S5: valid service-role bearer → request processed (auth gate not blocking)
//
// Uses source-parsing approach (same pattern as livekit-webhook/hygiene_test.ts)
// to avoid importing the handler and starting Deno.serve.
//
// Run: deno test --allow-read supabase/functions/analyze-workspace/auth_test.ts
// =============================================================================

import { assert } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

// ─── S4: auth gate exists before any DB or business logic ────────────────────
Deno.test("F-EF-05 S4: verifyInternalAuth called before try-block (before DB access)", () => {
  const authIdx = source.indexOf("verifyInternalAuth(req)");
  const tryIdx = source.indexOf("try {");

  assert(authIdx !== -1, "verifyInternalAuth call not found in source — auth gate missing");
  assert(tryIdx !== -1, "try-block not found in source");
  assert(
    authIdx < tryIdx,
    "F-EF-05 regression: verifyInternalAuth must appear BEFORE the try-block (DB access). Auth gate is out of order.",
  );
});

Deno.test("F-EF-05 S4: anon rejection path returns authResult.response (not an error throw)", () => {
  // The guard block must return authResult.response when !authResult.ok
  const okCheckIdx = source.indexOf("!authResult.ok");
  assert(okCheckIdx !== -1, "!authResult.ok check not found — rejection path missing");

  const afterCheck = source.slice(okCheckIdx, okCheckIdx + 200);
  assert(
    afterCheck.includes("return authResult.response"),
    "F-EF-05: rejection branch must return authResult.response, not throw",
  );
});

// ─── S5: service-role client used (not anon key) for DB writes ───────────────
Deno.test("F-EF-05 S5: DB client uses SUPABASE_SERVICE_ROLE_KEY (not SUPABASE_ANON_KEY)", () => {
  // After the auth gate, the supabase client must be created with service role key.
  // If the anon key is used for writes, the RLS allows only the authenticated user's rows —
  // a service-internal caller has no JWT, so writes would silently fail or no-op.
  const serviceRoleIdx = source.indexOf("SUPABASE_SERVICE_ROLE_KEY");
  const anonKeyInClientIdx = source.indexOf(
    'Deno.env.get("SUPABASE_ANON_KEY")',
  );

  assert(
    serviceRoleIdx !== -1,
    "F-EF-05 S5: SUPABASE_SERVICE_ROLE_KEY not found — DB client must use service role for server-internal writes",
  );

  // SUPABASE_ANON_KEY should NOT be used to construct the DB client after the auth gate.
  // It may still appear in imports or comments, but NOT as the key arg to createClient.
  // We check that no createClient call uses SUPABASE_ANON_KEY.
  const createClientIdx = source.indexOf("createClient(");
  assert(createClientIdx !== -1, "createClient not found");

  const afterFirstCreateClient = source.slice(createClientIdx, createClientIdx + 300);
  assert(
    !afterFirstCreateClient.includes("SUPABASE_ANON_KEY"),
    "F-EF-05 S5: createClient must use SUPABASE_SERVICE_ROLE_KEY, not SUPABASE_ANON_KEY",
  );
});

// ─── ADR-0029 comment present in source ──────────────────────────────────────
Deno.test("F-EF-05: ADR-0029 reference comment present in handler", () => {
  assert(
    source.includes("ADR-0029"),
    "ADR-0029 comment not found in source — add compliance reference per convention",
  );
});

// ─── sessionId validation exists ─────────────────────────────────────────────
Deno.test("F-EF-05: sessionId validated as non-empty string before DB write", () => {
  const sessionIdCheckIdx = source.indexOf('typeof sessionId !== "string"');
  assert(
    sessionIdCheckIdx !== -1,
    "sessionId type-guard not found — add typeof sessionId !== 'string' check",
  );

  // The check must appear before the DB update
  const updateIdx = source.indexOf(".update({");
  assert(updateIdx !== -1, ".update() call not found");
  assert(
    sessionIdCheckIdx < updateIdx,
    "sessionId validation must appear BEFORE the .update() DB call",
  );
});
