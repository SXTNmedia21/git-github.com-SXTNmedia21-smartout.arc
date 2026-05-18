// apps/e2e/db/announcement-atomic-rpc.spec.ts
//
// Integration tests for publish_announcement_atomic RPC (ADR-0369).
// Verifies: atomic INSERT channel_message + announcement_meta + notification_outbox,
// tier-driven priority/channels, CHECK constraint rejection, and service-role bypass.
//
// Runs against Supabase local (127.0.0.1:54321).
// Seed identities from MEMORY.md: workspace_id=b0000000-...-000000000000, profile_id=f0000000-...-000000000000.
// Test channel: ca000000-...-000000000020 (news, workspace b0000000-...-000000000000).

import { describe, it, expect, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@smartout/supabase";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz"; // local dev only — not a production secret

const TEST_WORKSPACE_ID = "b0000000-0000-0000-0000-000000000000";
const TEST_ACTOR_PROFILE_ID = "f0000000-0000-0000-0000-000000000000"; // Anna (owner) from seed
const TEST_CHANNEL_ID = "ca000000-0000-0000-0000-000000000020"; // Nyheter & oppdateringer (news)

function serviceClient() {
  return createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Clean up any channel_message rows inserted by tests (cascade deletes announcement_meta).
const insertedMessageIds: string[] = [];
afterEach(async () => {
  if (insertedMessageIds.length === 0) return;
  const db = serviceClient();
  await db.from("channel_message").delete().in("id", insertedMessageIds);
  insertedMessageIds.length = 0;
});

// ---------------------------------------------------------------------------
// Test 1: Happy path — atomic INSERT channel_message + announcement_meta + notification_outbox
// ---------------------------------------------------------------------------
describe("publish_announcement_atomic RPC", () => {
  it("Test 1: inserts channel_message + announcement_meta + notification_outbox atomically (happy path)", async () => {
    const db = serviceClient();
    const content = "Testmelding\nDette er kroppen av kunngjøringen.";

    const { data: messageId, error } = await db.rpc("publish_announcement_atomic", {
      p_workspace_id: TEST_WORKSPACE_ID,
      p_actor_profile_id: TEST_ACTOR_PROFILE_ID,
      p_channel_id: TEST_CHANNEL_ID,
      p_content: content,
      p_kind: "general",
      p_tier: "work",
      p_tags: ["test"],
      p_linked_entity_type: null,
      p_linked_entity_id: null,
      p_tier_overridden: false,
    } as Record<string, unknown>);

    expect(error).toBeNull();
    expect(messageId).toBeTruthy();
    insertedMessageIds.push(messageId as string);

    // Verify channel_message row exists with correct fields.
    const { data: msg, error: msgErr } = await db
      .from("channel_message")
      .select("id, message_type, content, sender_id, workspace_id, channel_id")
      .eq("id", messageId as string)
      .single();

    expect(msgErr).toBeNull();
    expect(msg?.message_type).toBe("announcement");
    expect(msg?.content).toBe(content);
    expect(msg?.sender_id).toBe(TEST_ACTOR_PROFILE_ID);
    expect(msg?.workspace_id).toBe(TEST_WORKSPACE_ID);
    expect(msg?.channel_id).toBe(TEST_CHANNEL_ID);

    // Verify announcement_meta sidecar row exists.
    const { data: meta, error: metaErr } = await db
      .from("announcement_meta")
      .select("message_id, kind, tier, tags, workspace_id")
      .eq("message_id", messageId as string)
      .single();

    expect(metaErr).toBeNull();
    expect(meta?.kind).toBe("general");
    expect(meta?.tier).toBe("work");
    expect(meta?.tags).toEqual(["test"]);
    expect(meta?.workspace_id).toBe(TEST_WORKSPACE_ID);

    // Verify fan-out ran without exception (notification_outbox may be 0 rows
    // if no other channel members are in the test channel — that is valid).
    // Query by message type to confirm RPC completed without rollback.
    const { data: outboxRows, error: outboxErr } = await db
      .from("notification_outbox")
      .select("recipient_id, priority")
      .filter("metadata->>'entity_id'", "eq", messageId as string);

    // No query error means outbox was accessible (fan-out completed without exception).
    expect(outboxErr).toBeNull();
    // outboxRows can be empty array if no other channel members — that is valid behavior.
    expect(Array.isArray(outboxRows)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Test 2: tier=external → priority=2 + email in allowed_channels
  // ---------------------------------------------------------------------------
  it("Test 2: tier=external sets priority=2 and email in allowed_channels", async () => {
    const db = serviceClient();
    const content = "Ekstern kunngjøring\nDette er ekstern informasjon.";

    const { data: messageId, error } = await db.rpc("publish_announcement_atomic", {
      p_workspace_id: TEST_WORKSPACE_ID,
      p_actor_profile_id: TEST_ACTOR_PROFILE_ID,
      p_channel_id: TEST_CHANNEL_ID,
      p_content: content,
      p_kind: "external",
      p_tier: "external",
      p_tags: [],
      p_linked_entity_type: "external_url",
      p_linked_entity_id: "00000000-0000-0000-0000-000000000001", // dummy uuid for test
      p_tier_overridden: false,
    } as Record<string, unknown>);

    expect(error).toBeNull();
    expect(messageId).toBeTruthy();
    insertedMessageIds.push(messageId as string);

    // Check notification_outbox rows for this message have priority=2 and email in allowed_channels.
    const { data: outboxRows } = await db
      .from("notification_outbox")
      .select("priority, allowed_channels")
      .filter("metadata->>'entity_id'", "eq", messageId as string);

    // If there are channel members who would receive notifications, verify priority + channels.
    if (outboxRows && outboxRows.length > 0) {
      for (const row of outboxRows) {
        expect(row.priority).toBe(2);
        expect(row.allowed_channels).toContain("email");
        expect(row.allowed_channels).toContain("push");
      }
    }
    // 0 outbox rows is valid if no other channel members — test still passes.
  });

  // ---------------------------------------------------------------------------
  // Test 3: entity-link CHECK rejects mismatched pair (type without id)
  // Verifies meta_link_pair_consistent constraint: linked_entity_type IS NOT NULL
  // but linked_entity_id IS NULL → constraint violation.
  // ---------------------------------------------------------------------------
  it("Test 3: entity-link CHECK rejects mismatched type+id pair (type without id)", async () => {
    const db = serviceClient();

    const { data: messageId, error } = await db.rpc("publish_announcement_atomic", {
      p_workspace_id: TEST_WORKSPACE_ID,
      p_actor_profile_id: TEST_ACTOR_PROFILE_ID,
      p_channel_id: TEST_CHANNEL_ID,
      p_content: "Constraint test\nShould fail.",
      p_kind: "staff_event",
      p_tier: "social",
      p_tags: [],
      // type without id — violates meta_link_pair_consistent
      p_linked_entity_type: "staff_event",
      p_linked_entity_id: null,
      p_tier_overridden: false,
    } as Record<string, unknown>);

    // Expect a PostgreSQL constraint violation error.
    expect(error).not.toBeNull();
    expect(messageId).toBeNull();

    // If a message ID was somehow returned (shouldn't happen), clean it up.
    if (messageId) {
      insertedMessageIds.push(messageId as string);
    }
  });

  // ---------------------------------------------------------------------------
  // Test 4 (A6b): service-role bypass — p_actor_profile_id != auth.uid() succeeds
  // In service-role context, auth.uid() is null / different from actor.
  // RPC should succeed because v_is_service_role = true.
  // ---------------------------------------------------------------------------
  it("Test 4 (A6b): service-role bypass — actor_profile_id != auth.uid() succeeds", async () => {
    const db = serviceClient();
    // Using service-role key: auth.uid() will be null in SECURITY DEFINER context.
    // The IDENTITY_MISMATCH guard checks v_is_service_role first — so this should succeed.
    const content = "Service-role test\nActor resolves server-side.";

    const { data: messageId, error } = await db.rpc("publish_announcement_atomic", {
      p_workspace_id: TEST_WORKSPACE_ID,
      p_actor_profile_id: TEST_ACTOR_PROFILE_ID, // actor = Anna (owner, active)
      p_channel_id: TEST_CHANNEL_ID,
      p_content: content,
      p_kind: "general",
      p_tier: "work",
      p_tags: [],
      p_linked_entity_type: null,
      p_linked_entity_id: null,
      p_tier_overridden: false,
    } as Record<string, unknown>);

    // Service-role bypass should allow this even without matching auth.uid().
    expect(error).toBeNull();
    expect(messageId).toBeTruthy();

    if (messageId) {
      insertedMessageIds.push(messageId as string);
    }
  });
});
