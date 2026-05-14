// deno-lint-ignore-file no-console
// ============================================================================
// hygiene_test.ts — F-WH-02 + F-WH-04 regression guards for livekit-webhook
// ----------------------------------------------------------------------------
// F-WH-02: Missing env vars must never leak env names in 500 response body.
// F-WH-04: room_finished handler must use ON CONFLICT (call_session_id) — not bare INSERT.
//
// Uses source-parsing approach (same pattern as engine-dispatch entity_pk_test.ts)
// to avoid importing the handler and starting Deno.serve.
//
// Run: deno test supabase/functions/livekit-webhook/hygiene_test.ts
// ============================================================================

import { assert } from "jsr:@std/assert@1";

const SOURCE_URL = new URL("./index.ts", import.meta.url);
const source = await Deno.readTextFile(SOURCE_URL);

// ─── F-WH-02: env var guard present ─────────────────────────────────────────
Deno.test("F-WH-02: handler checks LIVEKIT_API_KEY and LIVEKIT_API_SECRET before constructing WebhookReceiver", () => {
  // The guard block must appear BEFORE the WebhookReceiver construction
  const guardIdx = source.indexOf("missing config");
  const receiverIdx = source.indexOf("new WebhookReceiver(");

  assert(guardIdx !== -1, "F-WH-02 fix missing: 'missing config' sentinel not found in source");
  assert(receiverIdx !== -1, "WebhookReceiver construction not found in source");
  assert(
    guardIdx < receiverIdx,
    "F-WH-02 fix out of order: env guard must appear before WebhookReceiver construction",
  );
});

Deno.test("F-WH-02: 500 response body does not contain env var names on missing config", () => {
  // The response body for the missing-config path must not mention the env var names.
  // Find the missing-config guard block and assert it returns "missing config" without leaking names.
  const guardStart = source.indexOf("missing config");
  assert(guardStart !== -1, "missing config sentinel not in source");

  // Extract the surrounding return statement (within 400 chars)
  const vicinity = source.slice(Math.max(0, guardStart - 200), guardStart + 200);

  // The error body should NOT contain the literal env var names
  assert(
    !vicinity.includes('"LIVEKIT_API_KEY"') || vicinity.includes("console.error"),
    "Env var name LIVEKIT_API_KEY must only appear in console.error, not in response body",
  );
  assert(
    !vicinity.includes('"LIVEKIT_API_SECRET"') || vicinity.includes("console.error"),
    "Env var name LIVEKIT_API_SECRET must only appear in console.error, not in response body",
  );
});

// ─── F-WH-04: call_log uses upsert ON CONFLICT, not bare insert ──────────────
Deno.test("F-WH-04: call_log insert uses upsert with onConflict call_session_id", () => {
  // Find the call_log table operation
  const callLogIdx = source.indexOf('"call_log"');
  assert(callLogIdx !== -1, "call_log table reference not found in source");

  // Locate the upsert call after the call_log reference
  const postCallLog = source.slice(callLogIdx);
  assert(
    postCallLog.includes(".upsert("),
    "F-WH-04 fix missing: call_log must use .upsert(), not .insert()",
  );
  assert(
    postCallLog.includes("call_session_id"),
    "F-WH-04 fix missing: upsert must specify onConflict: 'call_session_id'",
  );
  assert(
    postCallLog.includes("ignoreDuplicates: true"),
    "F-WH-04 fix missing: upsert must use ignoreDuplicates: true",
  );
});

Deno.test("F-WH-04: call_log does NOT use bare .insert() for the room_finished log", () => {
  // Find the room_finished case and verify no bare insert follows for call_log
  const roomFinishedIdx = source.indexOf('"room_finished"');
  assert(roomFinishedIdx !== -1, '"room_finished" case not found in source');

  const roomSection = source.slice(roomFinishedIdx, roomFinishedIdx + 2000);

  // call_log block must not have .insert( without an immediately preceding upsert comment
  // More precisely: the call_log table reference in room_finished must use .upsert
  const callLogInRoom = roomSection.indexOf('"call_log"');
  assert(callLogInRoom !== -1, "call_log reference not found in room_finished section");

  const afterCallLog = roomSection.slice(callLogInRoom, callLogInRoom + 300);
  assert(
    !afterCallLog.includes(".insert("),
    "F-WH-04 regression: call_log uses bare .insert() — must use .upsert() for idempotency",
  );
});
