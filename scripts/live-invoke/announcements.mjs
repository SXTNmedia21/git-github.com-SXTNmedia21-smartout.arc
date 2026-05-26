// scripts/live-invoke/announcements.mjs
// Live-invoke smoke for the announcements domain (Wave A + Wave B).
//
// What this catches (L-0348 family):
//   - Column drift on announcement_meta (9 cols, PK = message_id — NOT id)
//   - Column drift on channel_message filtered by message_type='announcement' (25 cols)
//   - RPC signature drift on get_channel_messages (announcement-enriched view, 26 cols)
//   - RPC signature drift on publish_announcement_atomic (returns string UUID)
//   - Column drift on channel_member (audience-resolver read path)
//   - Wave B: fn_publish_announcement_notifications signature (returns undefined)
//
// Design choices:
//   1. announcement_meta PK is message_id (UUID FK to channel_message.id) — NOT id.
//      assertShape checks message_id, NOT id. This is the most common drift trap.
//   2. channel_message is filtered WHERE message_type='announcement' to target the
//      announcement slice of the multi-type messages table.
//   3. get_channel_messages RPC requires p_channel_id. We pass a synthetic UUID;
//      empty result = signature OK (no channel with that ID exists in dev seed).
//   4. publish_announcement_atomic write-probe: FK constraints on channel_id +
//      actor_profile_id will fire (dev seed likely missing both). FK error (23503)
//      = columns exist. Any 400-class non-FK error = column drift.
//   5. fn_publish_announcement_notifications is a trigger-style function (Returns:
//      undefined). We verify it exists via a call that will fail with auth.uid()=null
//      FK violations — not a column-shape check, just an existence check.
//   6. Caller = service role → auth.uid() is null → RLS returns empty for
//      workspace-scoped rows. Expected: signature proven, no SQL error.
//
// Smoke coverage (6 reads + 1 write-probe):
//   A. announcement_meta         — Wave B table (PK=message_id, 9 cols)
//   B. channel_message           — base message table, announcement slice (25 cols)
//   C. get_channel_messages RPC  — announcement-enriched cursor read (26 cols)
//   D. channel_member            — audience-resolver read path (publish-announcement.ts:204)
//   E. publish_announcement_atomic write-probe — signature (Wave B RPC, returns UUID)
//   F. fn_publish_announcement_notifications existence — Wave B trigger-style fn
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/announcements.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("announcements");

// ── A. announcement_meta — Wave B core metadata table ───────────────────────
// TRAP: PK is message_id (UUID, FK to channel_message.id), NOT id.
//       Nine columns total. No workspace_id column on meta itself (workspace_id
//       is on channel_message; meta carries workspace_id for RLS only).
// Source: packages/supabase/src/database.types.ts:2494-2507 (Row type)
const announcementMeta = await sb
  .from("announcement_meta")
  .select(
    "message_id, workspace_id, kind, tier, tier_overridden, " +
    "tags, linked_entity_id, linked_entity_type, created_at",
  )
  .limit(1);
assertOk("announcement_meta select (9 cols)", announcementMeta);
assertShape("announcement_meta shape (PK=message_id)", announcementMeta.data, [
  "message_id",
  "workspace_id",
  "kind",
  "tier",
  "tier_overridden",
  "tags",
  "created_at",
]);

// ── B. channel_message — base table, announcement slice ──────────────────────
// channel_message is a multi-type table. Announcements are rows where
// message_type='announcement'. 25 columns total.
// Source: packages/supabase/src/database.types.ts:4153-4180 (Row type)
const announcementMessages = await sb
  .from("channel_message")
  .select(
    "id, channel_id, workspace_id, sender_id, content, message_type, " +
    "delivery_mode, visibility_scope, origin_type, origin_id, " +
    "is_pinned, pinned_at, pinned_by, reply_to_id, target_profile_ids, " +
    "event_id, client_message_id, system_data, classification_metadata, " +
    "original_content_hash, edited_at, deleted_at, redacted_at, " +
    "created_at, updated_at",
  )
  .eq("message_type", "announcement")
  .limit(1);
assertOk(
  "channel_message WHERE message_type='announcement' (25 cols)",
  announcementMessages,
);
assertShape("channel_message announcement shape", announcementMessages.data, [
  "id",
  "channel_id",
  "workspace_id",
  "sender_id",
  "content",
  "message_type",
  "delivery_mode",
  "visibility_scope",
  "is_pinned",
  "created_at",
  "updated_at",
]);

// ── C. get_channel_messages RPC — announcement-enriched cursor read ──────────
// The capability's primary read path. Joins channel_message + announcement_meta
// + reactions + attachments. Returns 26 columns including announcement_kind,
// announcement_tier, announcement_tags, announcement_link_id, announcement_link_type.
// Requires p_channel_id. Synthetic UUID → empty result is expected (no such channel).
// Source: packages/supabase/src/database.types.ts:22854-22884 (Returns type)
const channelMessages = await sb.rpc("get_channel_messages", {
  p_channel_id: "00000000-0000-0000-0000-000000000000",
  p_limit: 10,
});
assertOk("rpc get_channel_messages (p_channel_id=synthetic)", channelMessages);
assertShape("get_channel_messages shape (26 cols)", channelMessages.data, [
  "message_id",
  "channel_id",
  "sender_id",
  "content",
  "message_type",
  "created_at",
  "is_pinned",
  "announcement_kind",
  "announcement_tier",
  "announcement_tags",
  "announcement_link_id",
  "announcement_link_type",
]);

// ── D. channel_member — audience-resolver read path ──────────────────────────
// publish-announcement.ts:204 checks channel membership before resolving audience.
// PK is id (UUID). 12 columns.
// Source: packages/supabase/src/database.types.ts:4075-4088 (Row type)
const channelMembers = await sb
  .from("channel_member")
  .select(
    "id, channel_id, workspace_id, profile_id, role, is_ai, is_muted, " +
    "muted_until, last_read_message_id, joined_at, left_at",
  )
  .limit(1);
assertOk("channel_member select (11 cols)", channelMembers);
assertShape("channel_member shape", channelMembers.data, [
  "id",
  "channel_id",
  "workspace_id",
  "profile_id",
  "role",
  "is_ai",
  "is_muted",
  "joined_at",
]);

// ── E. publish_announcement_atomic write-probe ───────────────────────────────
// Wave B RPC. Inserts channel_message + announcement_meta atomically. Returns
// string (UUID of the new message_id). FK violations on channel_id + actor_profile_id
// are expected (dev seed). Any 400-class PGRST error (not 23503/23514) = column drift.
// Source: packages/supabase/src/database.types.ts:23066-23086 (Args + Returns)
const atomicProbe = await sb.rpc("publish_announcement_atomic", {
  p_workspace_id: "00000000-0000-0000-0000-000000000000",
  p_actor_profile_id: "00000000-0000-0000-0000-000000000001",
  p_channel_id: "00000000-0000-0000-0000-000000000002",
  p_content: "live-invoke smoke probe — safe to delete",
  p_kind: "general",
  p_tier: "work",
  p_tier_overridden: false,
  p_tags: ["smoke"],
  p_target_profile_ids: [],
  p_visibility_scope: "all_members",
});

if (atomicProbe.error) {
  const code = atomicProbe.error.code ?? "";
  if (code === "23503" || code === "23514" || code === "P0001") {
    // FK/check/raise violation = RPC exists + signature valid. Data missing in dev. OK.
    console.log(
      `  · publish_announcement_atomic → FK/check constraint (${code}) — RPC signature OK`,
    );
  } else {
    // Unexpected error — could be column drift (42703) or missing function (42883)
    assertOk("rpc publish_announcement_atomic (write-probe)", atomicProbe);
  }
} else {
  // RPC succeeded (dev seed has matching workspace/channel/profile) — clean up the probe
  const probeMessageId = atomicProbe.data;
  console.log(
    `  ✓ publish_announcement_atomic → string UUID (${probeMessageId?.slice(0, 8)}…)`,
  );
  if (probeMessageId) {
    // Clean up: delete announcement_meta first (FK child), then channel_message
    await sb
      .from("announcement_meta")
      .delete()
      .eq("message_id", probeMessageId);
    await sb.from("channel_message").delete().eq("id", probeMessageId);
    console.log(`  · write-probe cleaned up (message_id: ${probeMessageId?.slice(0, 8)}…)`);
  }
}

// ── F. fn_publish_announcement_notifications existence check ─────────────────
// Wave B trigger-style function called after publish_announcement_atomic.
// Returns undefined (not a row set). We call it with synthetic args to prove
// it exists. FK violations are expected; missing function = 42883 error.
// Source: packages/supabase/src/database.types.ts:22808-22820 (Args + Returns)
const notifyProbe = await sb.rpc("fn_publish_announcement_notifications", {
  p_workspace_id: "00000000-0000-0000-0000-000000000000",
  p_message_id: "00000000-0000-0000-0000-000000000003",
  p_channel_id: "00000000-0000-0000-0000-000000000002",
  p_sender_id: "00000000-0000-0000-0000-000000000001",
  p_content: "smoke probe",
  p_tier: "work",
  p_visibility_scope: "all_members",
  p_target_profile_ids: [],
});

if (notifyProbe.error) {
  const code = notifyProbe.error.code ?? "";
  if (code === "23503" || code === "23514" || code === "P0001") {
    // FK/check violation = function exists + signature valid. Data missing in dev. OK.
    console.log(
      `  · fn_publish_announcement_notifications → FK/check constraint (${code}) — exists + signature OK`,
    );
  } else if (code === "42883") {
    // Function does not exist — hard failure
    assertOk("rpc fn_publish_announcement_notifications (existence)", notifyProbe);
  } else {
    // Other unexpected error
    assertOk("rpc fn_publish_announcement_notifications (existence)", notifyProbe);
  }
} else {
  console.log(`  ✓ fn_publish_announcement_notifications → exists + returned (undefined)`);
}

result();
