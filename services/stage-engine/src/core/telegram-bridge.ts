// ============================================
// telegram-bridge.ts
// Manages the Telegram chat bridge — connects Smartout channel_message
// (employee chat) to the admin's Telegram account in real time.
//
// One bridge at a time: only one active bridge exists. Opening a new one
// automatically closes any previous bridge.
//
// Flow:
//   Admin opens bridge → /bridge <channelId> in Telegram
//   Employee messages → PG NOTIFY fires → relayToTelegram()
//   Admin replies → Telegram webhook → relayToSmartout()
//   Admin closes → /done in Telegram → closeBridge()
//
// The PG NOTIFY listener in index.ts calls relayToTelegram() directly.
// The Telegram webhook handler calls relayToSmartout() for non-command text.
// ============================================

import { supabaseAdmin } from "../lib/supabase.js";
import { sendTelegramMessage } from "./telegram.js";
import { emitGuardianEvent } from "./guardian-bus.js";
import { getSecrets } from "../secrets.js";

// Matches the telegram_chat_bridge table shape
export type ActiveBridge = {
  id: string;
  channelId: string;
  sessionId: string;
};

// ---------------------------------------------------------------------------
// Bridge queries
// ---------------------------------------------------------------------------

/**
 * Returns the currently active bridge, or null if none exists.
 * Used by the webhook handler to decide whether to relay or route normally.
 */
export async function hasActiveBridge(): Promise<ActiveBridge | null> {
  const { data, error } = await supabaseAdmin
    .from("telegram_chat_bridge")
    .select("id, channel_id, session_id")
    .eq("status", "active")
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    channelId: data.channel_id,
    sessionId: data.session_id,
  };
}

// ---------------------------------------------------------------------------
// Bridge lifecycle
// ---------------------------------------------------------------------------

/**
 * Opens a bridge to a Smartout channel.
 * Closes any existing active bridge first to ensure only one is active.
 * Sends a confirmation message to Telegram with the channel name.
 *
 * @param sessionId - The engine_session the admin is operating from
 * @param channelId - The channel_message channel to bridge to
 * @returns The new bridge's UUID
 */
export async function openBridge(sessionId: string, channelId: string): Promise<string> {
  // Only one bridge active at a time — close any existing before opening a new one
  await closeBridge();

  // telegram_chat_id is required by the migration schema
  const telegramChatId = Number(getSecrets().telegramAdminChatId ?? "0");

  // Create the new bridge row. context is NOT a column on telegram_chat_bridge —
  // any contextual info is communicated via Telegram messages instead.
  const { data: bridge, error } = await supabaseAdmin
    .from("telegram_chat_bridge")
    .insert({
      session_id: sessionId,
      channel_id: channelId,
      telegram_chat_id: telegramChatId,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !bridge) {
    throw new Error(`[telegram-bridge] Failed to open bridge: ${error?.message}`);
  }

  // Look up channel name for a friendly confirmation message
  const { data: channel } = await supabaseAdmin
    .from("channel")
    .select("name")
    .eq("id", channelId)
    .single();

  const channelName = channel?.name ?? channelId;

  await sendTelegramMessage(`Bridge opened to: ${channelName}. Type to reply. /done to close.`);

  // guardian_log.workspace_id is NOT NULL with a FK to workspace — "platform" is not a valid UUID.
  // The bridge operates at the platform level with no workspace context, so we look up the
  // workspace from the channel to emit a scoped event if possible.
  const { data: channelRow } = await supabaseAdmin
    .from("channel")
    .select("workspace_id")
    .eq("id", channelId)
    .single();

  if (channelRow?.workspace_id) {
    emitGuardianEvent({
      session_id: sessionId,
      workspace_id: channelRow.workspace_id,
      event_type: "telegram.bridge.opened",
      actor: "admin",
      summary: `Bridge opened to channel: ${channelName}`,
      data: { bridge_id: bridge.id, channel_id: channelId, channel_name: channelName },
    });
  }

  return bridge.id;
}

/**
 * Closes the active bridge (or a specific bridge by ID).
 * Sets status='closed', closed_at=now(), and sends a confirmation to Telegram.
 *
 * @param bridgeId - If provided, only close this specific bridge. Otherwise closes all active.
 */
export async function closeBridge(bridgeId?: string): Promise<void> {
  // Build the update query — always filter on status='active'
  let query = supabaseAdmin
    .from("telegram_chat_bridge")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("status", "active");

  if (bridgeId) {
    query = query.eq("id", bridgeId);
  }

  const { data: closed } = await query.select("id, session_id, channel_id");

  // Only send Telegram confirmation if something was actually closed
  if (closed && closed.length > 0) {
    await sendTelegramMessage("Bridge closed.");

    for (const row of closed) {
      // Look up workspace_id from the channel — needed for guardian_log FK (NOT NULL)
      const { data: channelRow } = await supabaseAdmin
        .from("channel")
        .select("workspace_id")
        .eq("id", row.channel_id)
        .single();

      if (channelRow?.workspace_id) {
        emitGuardianEvent({
          session_id: row.session_id ?? "unknown",
          workspace_id: channelRow.workspace_id,
          event_type: "telegram.bridge.closed",
          actor: "admin",
          summary: "Bridge closed",
          data: { bridge_id: row.id, channel_id: row.channel_id },
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Message relay
// ---------------------------------------------------------------------------

/**
 * Relays a new channel_message to Telegram.
 * Called by the PG NOTIFY listener in index.ts when a message is inserted.
 *
 * Skips messages with no senderProfileId — those are admin messages written
 * by relayToSmartout(), preventing an echo loop.
 *
 * @param channelId - The channel the message was posted to
 * @param senderProfileId - null for admin messages (skipped to prevent echo)
 * @param content - The message text
 */
export async function relayToTelegram(
  channelId: string,
  senderProfileId: string | null,
  content: string,
): Promise<void> {
  // Skip admin messages — they were written by us, relaying them would echo
  if (!senderProfileId) return;

  const bridge = await hasActiveBridge();
  if (!bridge || bridge.channelId !== channelId) return;

  // Look up sender display name for attribution in Telegram
  const { data: profile } = await supabaseAdmin
    .from("profile")
    .select("display_name")
    .eq("id", senderProfileId)
    .single();

  const displayName = profile?.display_name ?? "Unknown";
  const telegramText = `[${displayName}]: ${content}`;

  await sendTelegramMessage(telegramText);

  // Fetch workspace_id from the channel for the guardian_log FK
  const { data: channelRow } = await supabaseAdmin
    .from("channel")
    .select("workspace_id")
    .eq("id", channelId)
    .single();

  if (channelRow?.workspace_id) {
    emitGuardianEvent({
      session_id: bridge.sessionId,
      workspace_id: channelRow.workspace_id,
      event_type: "telegram.bridge.message_relayed",
      actor: "system",
      summary: `Relayed message from ${displayName}`,
      data: {
        bridge_id: bridge.id,
        channel_id: channelId,
        sender_profile_id: senderProfileId,
        content,
      },
    });
  }
}

/**
 * Relays an admin's Telegram reply into Smartout as a channel_message.
 *
 * Inserts with origin_type='webhook' and system_data.source='telegram_admin'
 * so relayToTelegram() skips it (that function only relays messages with a
 * non-null senderProfileId, which is only set for actual employee messages).
 *
 * NOTE: channel_message.sender_id is NOT NULL — we look up the channel's
 * workspace_id and find an AI/system channel member to use as the sender.
 * If none exists the relay is skipped and an error is logged.
 *
 * @param text - The admin's reply text from Telegram
 * @returns true if the message was relayed, false if no bridge is active or insert failed
 */
export async function relayToSmartout(text: string): Promise<boolean> {
  const bridge = await hasActiveBridge();
  if (!bridge) return false;

  // channel_message requires workspace_id and a valid sender_id (NOT NULL FK to profile).
  // Fetch both from the channel row.
  const { data: channelRow } = await supabaseAdmin
    .from("channel")
    .select("workspace_id")
    .eq("id", bridge.channelId)
    .single();

  if (!channelRow?.workspace_id) {
    console.error(
      "[telegram-bridge] Could not resolve workspace_id for channel:",
      bridge.channelId,
    );
    return false;
  }

  // Find an AI/system channel member to represent the admin relay message.
  // This is the closest available profile for system-originated messages.
  const { data: aiMember } = await supabaseAdmin
    .from("channel_member")
    .select("profile_id")
    .eq("channel_id", bridge.channelId)
    .eq("is_ai", true)
    .is("left_at", null)
    .limit(1)
    .single();

  if (!aiMember?.profile_id) {
    console.error(
      "[telegram-bridge] No AI channel member found to represent admin relay in channel:",
      bridge.channelId,
    );
    return false;
  }

  const { error } = await supabaseAdmin.from("channel_message").insert({
    channel_id: bridge.channelId,
    workspace_id: channelRow.workspace_id,
    sender_id: aiMember.profile_id,
    content: text,
    message_type: "text",
    origin_type: "webhook", // signals this came from Telegram admin relay, not a real employee
    system_data: { source: "telegram_admin" }, // used by relayToTelegram() echo-loop prevention
  });

  if (error) {
    console.error("[telegram-bridge] Failed to insert channel_message:", error.message);
    return false;
  }

  if (channelRow.workspace_id) {
    emitGuardianEvent({
      session_id: bridge.sessionId,
      workspace_id: channelRow.workspace_id,
      event_type: "telegram.bridge.message_relayed",
      actor: "admin",
      summary: `Admin replied to channel ${bridge.channelId}`,
      data: {
        bridge_id: bridge.id,
        channel_id: bridge.channelId,
        content: text,
      },
    });
  }

  return true;
}
