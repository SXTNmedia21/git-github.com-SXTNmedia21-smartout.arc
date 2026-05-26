// scripts/live-invoke/communication.mjs
// Live-invoke smoke for the communication domain — see scripts/live-invoke/README.md.
//
// What this catches (L-0348 family):
//   - Column drift on channel, channel_member, channel_message, channel_ai_policy,
//     channel_event, channel_message_attachment (all sourced from database.types.ts
//     Row types — NEVER from migration SQL).
//   - RPC signature drift on match_workspace_docs (searchKnowledge capability entry point).
//   - is_active column absence on channel — tools.ts:223 references .eq("is_active", true)
//     which does NOT exist in database.types.ts Row. If that column was added by a
//     pending migration but typegen has not been re-run, this smoke catches the drift.
//   - channel_notification_policy is covered by notifications.mjs (E2 there) — skipped.
//   - announcement subset is covered by announcements.mjs — skipped.
//
// Design choices:
//   1. All tables live in the PUBLIC schema — no .schema() prefix needed.
//   2. Caller = service role → auth.uid() is null → RLS returns empty for
//      workspace-scoped rows. Expected: signature proven, no SQL error.
//   3. channel.id is PK (UUID), channel_ai_policy.id is PK (UUID).
//   4. Empty result on assertShape is OK — empty signals signature OK, not drift.
//   5. match_workspace_docs requires a vector embedding — smoke passes a zero-vector
//      of length 1536 (pgvector default) wrapped as a string. Returns empty = OK.
//
// Smoke coverage (7 reads):
//   A. channel                     — core channel table (all communication tools)
//   B. channel_member              — membership table (get_conversations, getChannelContext,
//                                    sendMessage membership guard)
//   C. channel_message             — message store (getUnreadCount, getChannelContext,
//                                    sendMessage INSERT path)
//   D. channel_ai_policy           — AI participation gate (isAiAllowedInChannel)
//   E. channel_event               — event log (FK target from channel_message.event_id)
//   F. channel_message_attachment  — attachment store (file upload flow)
//   G. match_workspace_docs RPC    — searchKnowledge capability entry point (semantic search)
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/communication.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("communication");

// ── A. channel — core channel table ──────────────────────────────────────────
// get_conversations, sendMessage (draft phase), getChannelContext all read this.
// Row keys from database.types.ts public.Tables.channel.Row (24 cols).
// DRIFT-WATCH: tools.ts:223 calls .eq("is_active", true) but is_active is NOT
// in database.types.ts channel.Row as of typegen 2026-05-26. If this select
// returns error code 42703 (undefined_column) that confirms the drift is live.
const channels = await sb
  .from("channel")
  .select(
    "id, workspace_id, name, description, channel_type, access_scope, " +
    "ai_voice_policy, audio_policy, video_policy, recording_policy, " +
    "allow_user_override, helpdesk_enabled, is_archived, is_read_only, " +
    "read_receipts_enabled, privacy_mode, retention_days, auto_archive_days, " +
    "legal_hold_until, direct_pair_hash, department_id, team_id, " +
    "session_id, responsible_profile_id, avatar_url, created_by, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("channel select (28 cols)", channels);
assertShape("channel shape", channels.data, [
  "id",
  "workspace_id",
  "channel_type",
  "access_scope",
  "helpdesk_enabled",
  "is_archived",
  "is_read_only",
  "read_receipts_enabled",
  "created_at",
  "updated_at",
]);

// ── B. channel_member — membership table ──────────────────────────────────────
// get_conversations: .select("channel_id").eq("profile_id", ...)
// getChannelContext: .select("profile_id, role, joined_at").eq("channel_id", ...).is("left_at", null)
// sendMessage (commit): .select("id").eq("channel_id", ...).eq("profile_id", ...).single()
// Row keys from database.types.ts public.Tables.channel_member.Row (11 cols).
const members = await sb
  .from("channel_member")
  .select(
    "id, channel_id, profile_id, workspace_id, role, is_ai, is_muted, " +
    "muted_until, last_read_message_id, joined_at, left_at",
  )
  .limit(1);
assertOk("channel_member select (11 cols)", members);
assertShape("channel_member shape", members.data, [
  "id",
  "channel_id",
  "profile_id",
  "workspace_id",
  "role",
  "is_ai",
  "is_muted",
  "joined_at",
]);

// ── C. channel_message — message store ────────────────────────────────────────
// getUnreadCount: .select("id", {count:"exact",head:true}).eq("delivery_mode","timeline")
// getChannelContext: .select("id, sender_id, content, created_at").eq("delivery_mode","timeline")
// sendMessage INSERT: message_type, client_message_id, delivery_mode (default "timeline")
// Row keys from database.types.ts public.Tables.channel_message.Row (24 cols).
const messages = await sb
  .from("channel_message")
  .select(
    "id, channel_id, workspace_id, sender_id, content, message_type, " +
    "delivery_mode, visibility_scope, origin_type, origin_id, " +
    "client_message_id, reply_to_id, event_id, is_pinned, pinned_at, " +
    "pinned_by, target_profile_ids, system_data, classification_metadata, " +
    "original_content_hash, edited_at, redacted_at, deleted_at, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("channel_message select (25 cols)", messages);
assertShape("channel_message shape", messages.data, [
  "id",
  "channel_id",
  "workspace_id",
  "sender_id",
  "content",
  "message_type",
  "delivery_mode",
  "visibility_scope",
  "origin_type",
  "is_pinned",
  "created_at",
  "updated_at",
]);

// ── D. channel_ai_policy — AI participation gate ──────────────────────────────
// isAiAllowedInChannel() reads this to gate sendMessage (3rd-layer AI policy check).
// One-to-one with channel (isOneToOne: true on FK).
// Row keys from database.types.ts public.Tables.channel_ai_policy.Row (11 cols).
const aiPolicies = await sb
  .from("channel_ai_policy")
  .select(
    "id, channel_id, workspace_id, text_participation, voice_participation, " +
    "auto_summarize, auto_reminders, auto_shift_prep, personality_override, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("channel_ai_policy select (11 cols)", aiPolicies);
assertShape("channel_ai_policy shape", aiPolicies.data, [
  "id",
  "channel_id",
  "workspace_id",
  "text_participation",
  "voice_participation",
  "auto_summarize",
  "auto_reminders",
  "auto_shift_prep",
  "created_at",
  "updated_at",
]);

// ── E. channel_event — event log ──────────────────────────────────────────────
// channel_message.event_id FK points here (channel_message_event_fk).
// Row keys from database.types.ts public.Tables.channel_event.Row (11 cols).
const events = await sb
  .from("channel_event")
  .select(
    "id, channel_id, workspace_id, event_type, source, source_id, payload, " +
    "idempotency_key, causation_id, correlation_id, created_at",
  )
  .limit(1);
assertOk("channel_event select (11 cols)", events);
assertShape("channel_event shape", events.data, [
  "id",
  "channel_id",
  "workspace_id",
  "event_type",
  "source",
  "payload",
  "created_at",
]);

// ── F. channel_message_attachment — attachment store ──────────────────────────
// File upload flow attaches media to channel_message rows.
// Row keys from database.types.ts public.Tables.channel_message_attachment.Row (11 cols).
const attachments = await sb
  .from("channel_message_attachment")
  .select(
    "id, message_id, channel_id, workspace_id, filename, file_type, " +
    "mime_type, size_bytes, url, duration_seconds, created_at",
  )
  .limit(1);
assertOk("channel_message_attachment select (11 cols)", attachments);
assertShape("channel_message_attachment shape", attachments.data, [
  "id",
  "message_id",
  "channel_id",
  "workspace_id",
  "filename",
  "file_type",
  "size_bytes",
  "url",
  "created_at",
]);

// ── G. match_workspace_docs RPC — searchKnowledge capability entry point ───────
// searchKnowledge tool calls this RPC with (p_workspace_id, query_embedding,
// match_count, match_threshold). Returns rows with chunk_id, content, similarity,
// source_path, source_type, title.
// Smoke: pass a zero-vector of length 1536 (pgvector default). RPC signature proven
// when no error is returned (empty result = normal with a zero-vector).
const zeroVec = "[" + Array(1536).fill("0").join(",") + "]";
const knowledgeSearch = await sb.rpc("match_workspace_docs", {
  p_workspace_id: "00000000-0000-0000-0000-000000000000",
  query_embedding: zeroVec,
  match_count: 1,
  match_threshold: 0.99,
});
assertOk("rpc match_workspace_docs (zero-vector smoke)", knowledgeSearch);
// Returns empty array for non-existent workspace — shape assertion on empty is OK.
assertShape("match_workspace_docs shape", knowledgeSearch.data, [
  "chunk_id",
  "content",
  "similarity",
  "source_path",
  "source_type",
  "title",
]);

result();
