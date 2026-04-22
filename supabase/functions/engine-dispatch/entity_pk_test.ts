// deno-lint-ignore-file no-console
// ============================================================================
// entity_pk_test.ts
// ----------------------------------------------------------------------------
// Whitelist-shape test for the ENTITY_PK map + update_entity allowlist
// in index.ts. L-0085 documents the silent-noop trap when these two
// structures diverge. This test parses the source file and asserts both
// contain the Helpdesk/channel entries added 2026-04-20.
//
// Why we parse instead of import:
//   index.ts registers a top-level Deno.serve handler on import, so pulling
//   the module into a test would also start the HTTP server. Parsing the
//   source keeps the test hermetic and dependency-free. Until the map is
//   code-generated from database.types.ts (see L-0085 long-term fix), this
//   is the minimum guard against accidental deletion.
//
// Run: deno test supabase/functions/engine-dispatch/entity_pk_test.ts
// ============================================================================

import { assert } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

function entityPkBlock(text: string): string {
  const start = text.indexOf("const ENTITY_PK");
  assert(start !== -1, "ENTITY_PK constant not found in index.ts");
  const blockEnd = text.indexOf("};", start);
  assert(blockEnd !== -1, "ENTITY_PK block terminator not found");
  return text.slice(start, blockEnd);
}

function updateEntityAllowlist(text: string): string {
  // Locate the `case "update_entity":` branch and return the allowlist block.
  const caseStart = text.indexOf('case "update_entity":');
  assert(caseStart !== -1, 'update_entity case branch not found');
  const allowedStart = text.indexOf("const allowed = [", caseStart);
  assert(allowedStart !== -1, "update_entity allowlist not found");
  const allowedEnd = text.indexOf("];", allowedStart);
  assert(allowedEnd !== -1, "update_entity allowlist terminator not found");
  return text.slice(allowedStart, allowedEnd);
}

Deno.test("ENTITY_PK contains Helpdesk + channel entries (L-0085)", () => {
  const block = entityPkBlock(source);
  assert(/channel:\s*"id"/.test(block), "channel missing from ENTITY_PK");
  assert(
    /channel_message:\s*"id"/.test(block),
    "channel_message missing from ENTITY_PK",
  );
  assert(
    /engine_state:\s*"id"/.test(block),
    "engine_state missing from ENTITY_PK",
  );
});

Deno.test("ENTITY_PK keeps existing entries (regression guard)", () => {
  const block = entityPkBlock(source);
  const required: Array<[string, string]> = [
    ["daily_reconciliation", "id"],
    ["department_session", "department_session_id"],
    ["profile", "profile_id"],
    ["protocol_assignment", "assignment_id"],
    ["change_proposal", "change_proposal_id"],
    ["observer_request", "observer_request_id"],
  ];
  for (const [key, pk] of required) {
    const pattern = new RegExp(`${key}:\\s*"${pk}"`);
    assert(pattern.test(block), `${key}: "${pk}" missing from ENTITY_PK`);
  }
});

Deno.test("update_entity allowlist mirrors ENTITY_PK (L-0085 divergence guard)", () => {
  const allowlist = updateEntityAllowlist(source);
  const mustContain = [
    "daily_reconciliation",
    "department_session",
    "profile",
    "protocol_assignment",
    "change_proposal",
    "observer_request",
    "channel",
    "channel_message",
    "engine_state",
  ];
  for (const entry of mustContain) {
    const pattern = new RegExp(`"${entry}"`);
    assert(
      pattern.test(allowlist),
      `update_entity allowlist missing "${entry}" — divergence from ENTITY_PK is the L-0085 silent-noop trap`,
    );
  }
});
