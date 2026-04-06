// packages/ai/src/capabilities/communication/tools.ts
// Migrated from legacy chat_* tables to Komm channel_* tables (2026-03-28)
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

export const getConversations = defineTool({
  name: "get_conversations",
  description: "List the employee's active communication channels with latest message preview",
  schema: z.object({
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe("Maximum number of channels to return"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // Get channel IDs where this profile is a member
    const { data: memberData, error: memberError } = await supabase
      .from("channel_member")
      .select("channel_id")
      .eq("profile_id", ctx.profileId);

    if (memberError) {
      return `Error loading channels: ${memberError.message}`;
    }

    if (!memberData || memberData.length === 0) {
      return "No active channels found.";
    }

    const channelIds = memberData.map((m) => m.channel_id);

    // Fetch channels with member details
    const { data, error } = await supabase
      .from("channel")
      .select(
        "id, name, description, channel_type, updated_at, members:channel_member(profile:profile_id(display_name))",
      )
      .eq("workspace_id", ctx.workspaceId)
      .in("id", channelIds)
      .order("updated_at", { ascending: false })
      .limit(params.limit);

    if (error) {
      return `Error loading channels: ${error.message}`;
    }

    if (!data || data.length === 0) {
      return "No active channels found.";
    }

    return JSON.stringify(data);
  },
});

export const getUnreadCount = defineTool({
  name: "get_unread_count",
  description: "Get the total number of unread messages across all channels",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    const { data, error } = await supabase
      .from("channel_member")
      .select("unread_count")
      .eq("profile_id", ctx.profileId);

    if (error) {
      return `Error loading unread count: ${error.message}`;
    }

    const total = (data ?? []).reduce(
      (sum, row) => sum + ((row as { unread_count?: number }).unread_count ?? 0),
      0,
    );
    return JSON.stringify({ total_unread: total });
  },
});

export const sendMessage = defineTool({
  name: "send_message",
  description: "Send a text message to a communication channel",
  schema: z.object({
    channel_id: z.string().uuid().describe("The channel ID to send the message to"),
    content: z.string().min(1).max(2000).describe("The message text to send"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // Verify the user is a member of this channel
    const { data: member, error: memberError } = await supabase
      .from("channel_member")
      .select("id")
      .eq("channel_id", params.channel_id)
      .eq("profile_id", ctx.profileId)
      .single();

    if (memberError || !member) {
      return "You are not a member of this channel.";
    }

    // Insert the message
    const { data, error } = await supabase
      .from("channel_message")
      .insert({
        channel_id: params.channel_id,
        sender_profile_id: ctx.profileId,
        content: params.content,
        message_type: "text",
      })
      .select("id, content, created_at")
      .single();

    if (error) {
      return `Error sending message: ${error.message}`;
    }

    // Emit engine event for audit trail (ADR-0069 — agent tools must emit)
    await supabase.from("engine_event").insert({
      workspace_id: ctx.workspaceId,
      event_type: "channel_message.sent",
      payload: {
        channel_id: params.channel_id,
        message_id: data.id,
        source: "agent",
        actor_id: ctx.profileId,
      },
    });

    return JSON.stringify({ sent: true, message: data });
  },
});
