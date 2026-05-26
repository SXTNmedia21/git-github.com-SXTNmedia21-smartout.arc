// scripts/live-invoke/notifications.mjs
// Live-invoke smoke for the notifications domain — see scripts/live-invoke/README.md.
//
// What this catches (L-0348 family):
//   - Column drift on notification_outbox, notification, notification_preference,
//     notification_policy, notification_sent_log, guardian_signal (all sourced from
//     database.types.ts Row types — NEVER from migration SQL).
//   - RPC signature drift on fetch_pending_outbox.
//   - 4-channel funnel existence: process-notifications reads outbox → inserts
//     notification (in-app) + fans to push/email/sms. Each table in the chain
//     is exercised here.
//   - ADR-0394 (OneSignal push, 2026-05-22): push-dispatch reads profile.expo_push_token.
//     The profile table smoke covers that column.
//
// Design choices:
//   1. All tables live in the PUBLIC schema — no .schema() prefix needed.
//   2. Caller = service role → auth.uid() is null → RLS returns empty for
//      workspace-scoped rows. Expected: signature proven, no SQL error.
//   3. notification_preference PK is user_id (not id) — assertShape checks user_id.
//   4. notification_sent_log PK is notification_sent_log_id (not id) — checked below.
//   5. Empty result on assertShape is OK — empty signals signature OK, not drift.
//
// Smoke coverage (7 reads + 1 write-probe):
//   A. notification_outbox      — core outbox table (process-notifications consumer)
//   B. fetch_pending_outbox RPC — outbox consumer entry point, SECURITY DEFINER
//   C. notification             — in-app notification store (written by process-notifications)
//   D. notification_preference  — per-user channel preference (PK = user_id)
//   E. notification_policy      — per-workspace event→channel routing (ADR-0394)
//   F. notification_sent_log    — audit/analytics log (PK = notification_sent_log_id)
//   G. guardian_signal          — guardian-notify reads critical signals
//   H. Write-probe on notification_outbox — insert + verify + cleanup (service role)
//
// Usage:
//   op run --env-file=.env.template -- node scripts/live-invoke/notifications.mjs

import { client, header, assertOk, assertShape, result } from "./_lib.mjs";

const sb = client("service");

header("notifications");

// ── A. notification_outbox — core outbox table ───────────────────────────────
// process-notifications EF reads this via fetch_pending_outbox RPC + direct selects.
// Row keys from database.types.ts public.Tables.notification_outbox.Row (17 cols).
const outbox = await sb
  .from("notification_outbox")
  .select(
    "id, workspace_id, recipient_id, mode, priority, title, body, " +
    "action_url, metadata, allowed_channels, status, error_log, " +
    "scheduled_for, processed_at, retry_count, created_at, updated_at",
  )
  .limit(1);
assertOk("notification_outbox select (17 cols)", outbox);
assertShape("notification_outbox shape", outbox.data, [
  "id",
  "workspace_id",
  "recipient_id",
  "mode",
  "priority",
  "title",
  "body",
  "allowed_channels",
  "status",
  "retry_count",
  "created_at",
  "updated_at",
]);

// ── B. fetch_pending_outbox RPC — SECURITY DEFINER outbox consumer ───────────
// Called by process-notifications cron. Returns notification_outbox rows that are
// pending. Returns same shape as notification_outbox. Revoked from anon
// (migration 20260524000000_revoke_anon_security_definer_hardening.sql).
// Service role can still call it for smoke purposes.
const pendingOutbox = await sb.rpc("fetch_pending_outbox", { p_batch_size: 1 });
assertOk("rpc fetch_pending_outbox (p_batch_size=1)", pendingOutbox);
assertShape("fetch_pending_outbox shape", pendingOutbox.data, [
  "id",
  "workspace_id",
  "recipient_id",
  "mode",
  "title",
  "body",
  "allowed_channels",
  "status",
  "retry_count",
  "created_at",
]);

// ── C. notification — in-app notification store ──────────────────────────────
// process-notifications inserts here after processing outbox rows.
// Row keys from database.types.ts public.Tables.notification.Row (14 cols).
// Note: PK is `id` (UUID), NOT a serial int like notification_outbox.id.
const inAppNotifs = await sb
  .from("notification")
  .select(
    "id, workspace_id, recipient_id, title, body, action_url, " +
    "icon_type, group_key, is_read, read_at, metadata, created_at, updated_at",
  )
  .limit(1);
assertOk("notification (in-app) select (13 cols)", inAppNotifs);
assertShape("notification (in-app) shape", inAppNotifs.data, [
  "id",
  "workspace_id",
  "recipient_id",
  "title",
  "body",
  "icon_type",
  "is_read",
  "created_at",
  "updated_at",
]);

// ── D. notification_preference — per-user channel preference ─────────────────
// PK is user_id (not id). Checked by process-notifications before fanning to
// push/email/sms. Quiet hours respected per preference.
// Row keys from database.types.ts public.Tables.notification_preference.Row (13 cols).
const prefs = await sb
  .from("notification_preference")
  .select(
    "user_id, push_enabled, email_enabled, sms_enabled, browser_enabled, " +
    "training_enabled, work_enabled, community_enabled, " +
    "quiet_hours_start, quiet_hours_end, quiet_hours_timezone, " +
    "created_at, updated_at",
  )
  .limit(1);
assertOk("notification_preference select (13 cols)", prefs);
assertShape("notification_preference shape", prefs.data, [
  "user_id",
  "push_enabled",
  "email_enabled",
  "sms_enabled",
  "browser_enabled",
  "quiet_hours_start",
  "quiet_hours_end",
  "created_at",
  "updated_at",
]);

// ── E. notification_policy — per-workspace rate-limit / risk policy ──────────
// NOT the event→channel routing table (that is channel_notification_policy).
// notification_policy = domain-level rate-limit, quiet-hours, tier-ladder config.
// PK is notification_policy_id (not id).
// Row keys from database.types.ts public.Tables.notification_policy.Row (11 cols).
const policies = await sb
  .from("notification_policy")
  .select(
    "notification_policy_id, workspace_id, domain, is_active, " +
    "rate_limit_per_day, risk_level, tier_ladder, " +
    "quiet_hours, locale_overrides, created_at, updated_at",
  )
  .limit(1);
assertOk("notification_policy select (11 cols)", policies);
assertShape("notification_policy shape", policies.data, [
  "notification_policy_id",
  "workspace_id",
  "domain",
  "is_active",
  "rate_limit_per_day",
  "tier_ladder",
  "created_at",
  "updated_at",
]);

// ── E2. channel_notification_policy — per-workspace event→channel routing ─────
// ADR-0394 (OneSignal, 2026-05-22). Maps event_type to delivery_channels +
// priority per workspace. PK is id (UUID). Added by migration 20260415120500.
// Row keys from database.types.ts public.Tables.channel_notification_policy.Row (9 cols).
const channelPolicies = await sb
  .from("channel_notification_policy")
  .select(
    "id, workspace_id, channel_id, event_type, delivery_channels, " +
    "priority, respect_quiet_hours, created_at, updated_at",
  )
  .limit(1);
assertOk("channel_notification_policy select (9 cols)", channelPolicies);
assertShape("channel_notification_policy shape", channelPolicies.data, [
  "id",
  "workspace_id",
  "event_type",
  "delivery_channels",
  "priority",
  "respect_quiet_hours",
  "created_at",
  "updated_at",
]);

// ── F. notification_sent_log — audit + analytics log ─────────────────────────
// PK is notification_sent_log_id (not id). Added by migration 20260415120500.
// Tracks opened_at, converted_at for delivery analytics.
// Row keys from database.types.ts public.Tables.notification_sent_log.Row (11 cols).
const sentLog = await sb
  .from("notification_sent_log")
  .select(
    "notification_sent_log_id, notification_policy_id, workspace_id, " +
    "subject_profile_id, related_entity_id, related_entity_type, " +
    "channel, tier, sent_at, opened_at, converted_at",
  )
  .limit(1);
assertOk("notification_sent_log select (11 cols)", sentLog);
assertShape("notification_sent_log shape", sentLog.data, [
  "notification_sent_log_id",
  "workspace_id",
  "subject_profile_id",
  "related_entity_id",
  "related_entity_type",
  "channel",
  "tier",
  "sent_at",
]);

// ── G. guardian_signal — guardian-notify reads critical active signals ────────
// guardian-notify EF filters by severity='critical' AND status='active'.
// Row keys from database.types.ts public.Tables.guardian_signal.Row (19 cols).
const signals = await sb
  .from("guardian_signal")
  .select(
    "id, workspace_id, domain, signal_type, severity, status, title, " +
    "description, entity_id, entity_type, entity_label, data, " +
    "source_check_id, acknowledged_at, acknowledged_by, " +
    "resolved_at, expires_at, created_at, updated_at",
  )
  .limit(1);
assertOk("guardian_signal select (19 cols)", signals);
assertShape("guardian_signal shape", signals.data, [
  "id",
  "workspace_id",
  "domain",
  "signal_type",
  "severity",
  "status",
  "title",
  "created_at",
  "updated_at",
]);

// ── H. Write-probe on notification_outbox — insert + verify + cleanup ────────
// Mirrors the outbox.ts insertOutboxNotification path. Proves the insert shape
// has not drifted from the column set the consumer expects.
// Uses a synthetic marker in metadata to avoid polluting real data.
const marker = `probe_${Date.now()}`;
const ins = await sb
  .from("notification_outbox")
  .insert({
    workspace_id: "00000000-0000-0000-0000-000000000000",
    recipient_id: "00000000-0000-0000-0000-000000000001",
    mode: "work",  // enum: "training" | "work" | "community" (NOT "direct")
    priority: 0,
    title: "live-invoke smoke probe",
    body: "this row is safe to delete",
    action_url: null,
    metadata: { _smoke_marker: marker },
    allowed_channels: ["in_app"],
  })
  .select("id, metadata")
  .single();

// Insert may fail due to FK constraints (user/workspace don't exist in dev) —
// that is acceptable. The assertOk here is specifically guarding against
// column-name drift that would cause a 400 (column does not exist), not FK 422/23.
// If it fails with a FK constraint error code (23503), treat as column-OK.
if (ins.error) {
  const code = ins.error.code ?? "";
  if (code === "23503" || code === "23514") {
    // FK/check violation = columns exist, FK targets missing in dev seed. Column OK.
    console.log(`  · write-probe → FK/check constraint (${code}) — column shape OK`);
  } else {
    // Real column drift or unexpected error
    assertOk("write-probe notification_outbox insert", ins);
  }
} else {
  // Insert succeeded — verify and clean up
  const probeId = ins.data?.id;
  try {
    const read = await sb
      .from("notification_outbox")
      .select("id, metadata")
      .eq("id", probeId);
    assertOk("write-probe read-back", read);
  } finally {
    await sb.from("notification_outbox").delete().eq("id", probeId);
  }
}

result();
