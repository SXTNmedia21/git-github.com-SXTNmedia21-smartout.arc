// deno-lint-ignore-file no-console
// ============================================================================
// auth_contract_test.ts
// ----------------------------------------------------------------------------
// Source-parsing contract tests for analyze-setup-documents auth posture.
//
// Why source-parse: index.ts registers a top-level Deno.serve and pulls a
// service-role client at import — a live test would need network + DB. Source
// parsing is hermetic and matches the journey-stuck-detector emit_contract_test
// pattern.
//
// What we assert (all failures = SMA-350 / ADR-0151 regression):
//   1. Presence-only auth check is followed by `getUser()` validation.
//   2. Caller's workspace membership is checked against the body workspace_id
//      via the anon-key client (RLS-enforced), not the service-role client.
//   3. Every storage_path is required to start with `${workspace_id}/` —
//      cross-workspace Storage reads return 403.
//   4. Service-role client is only constructed AFTER auth + ownership pass.
//
// Run: deno test supabase/functions/analyze-setup-documents/auth_contract_test.ts
// ============================================================================

import { assert, assertEquals } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

// ─── 1. Token must be validated via getUser(), not presence-only ────────────

Deno.test("auth bearer is validated via getUser(), not presence-only", () => {
  const getUserIdx = source.indexOf("authClient.auth.getUser()");
  assert(
    getUserIdx !== -1,
    "expected authClient.auth.getUser() call — presence-only check restored?",
  );
  // 401 must fire when getUser fails.
  const unauthorizedIdx = source.indexOf('"Unauthorized"', getUserIdx);
  assert(
    unauthorizedIdx !== -1 && unauthorizedIdx - getUserIdx < 800,
    "expected 401 Unauthorized response close to getUser() call",
  );
});

// ─── 2. workspace ownership check uses anon-key client, not service-role ────

Deno.test("workspace ownership check uses anon-key (RLS-enforced) client", () => {
  // The membership query must hang off `authClient`, not `supabase` (service role).
  const ownershipPattern = /authClient[\s\S]{0,40}\.from\("profile"\)/;
  assert(
    ownershipPattern.test(source),
    "expected ownership query via authClient.from(\"profile\") — service-role bypass restored?",
  );
});

Deno.test("403 fires when caller has no profile in requested workspace", () => {
  const noProfileIdx = source.indexOf("caller has no profile in this workspace");
  assert(noProfileIdx !== -1, "expected 403 Forbidden message for missing profile");
  // Status must be 403, not 401 (request is authenticated but unauthorized).
  const status403Idx = source.lastIndexOf("status: 403", noProfileIdx + 400);
  assert(status403Idx > noProfileIdx, "expected status: 403 on no-profile branch");
});

// ─── 3. storage_paths must be workspace-prefixed ────────────────────────────

Deno.test("every storage_path must start with workspace_id/", () => {
  const prefixIdx = source.indexOf("`${workspace_id}/`");
  assert(prefixIdx !== -1, "expected pathPrefix = `${workspace_id}/` guard");

  const startsWithIdx = source.indexOf(".startsWith(pathPrefix)", prefixIdx);
  assert(
    startsWithIdx !== -1 && startsWithIdx - prefixIdx < 400,
    "expected path.startsWith(pathPrefix) validation",
  );

  // Mismatched paths must return 403.
  const outsideIdx = source.indexOf("storage_path outside workspace");
  assert(outsideIdx !== -1, "expected 403 Forbidden message for cross-workspace path");
});

// ─── 4. service-role client constructed only after auth gate ────────────────

Deno.test("service-role client created after auth + ownership checks", () => {
  const serviceClientIdx = source.indexOf(
    "createClient(supabaseUrl, serviceKey)",
  );
  assert(serviceClientIdx !== -1, "expected service-role client construction");

  // It must appear after the ownership check (no profile → 403) lexically.
  const ownershipMsgIdx = source.indexOf("caller has no profile in this workspace");
  assertEquals(
    ownershipMsgIdx !== -1 && ownershipMsgIdx < serviceClientIdx,
    true,
    "service-role client must be created AFTER ownership 403 branch — found before",
  );
});

// ─── 5. body workspace_id is no longer trusted blindly ──────────────────────

Deno.test("body workspace_id is cross-checked against caller profile (ADR-0151)", () => {
  // The .eq("workspace_id", workspace_id) clause on the profile query is the
  // canonical cross-check — drop it and we silently regress to forgeable IDs.
  const eqPattern = /\.eq\("workspace_id",\s*workspace_id\)/;
  assert(
    eqPattern.test(source),
    'expected .eq("workspace_id", workspace_id) on profile membership query',
  );
});
