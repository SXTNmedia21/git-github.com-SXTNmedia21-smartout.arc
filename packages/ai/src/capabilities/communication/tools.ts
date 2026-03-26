// packages/ai/src/capabilities/communication/tools.ts
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import type { SupabaseClient } from "@supabase/supabase-js";

export const getConversations = defineTool({
  name: "get_conversations",
  description: "List the employee's active chat conversations with latest message preview",
  schema: z.object({
    limit: z
      .number()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe("Maximum number of conversations to return"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Get conversation IDs where this profile is a participant
    const { data: participantData, error: participantError } = await supabase
      .from("chat_participant")
      .select("conversation_id")
      .eq("profile_id", ctx.profileId);

    if (participantError) {
      return `Error loading conversations: ${participantError.message}`;
    }

    if (!participantData || participantData.length === 0) {
      return "No active conversations found.";
    }

    const conversationIds = participantData.map((p) => p.conversation_id);

    // Fetch conversations with participant details
    const { data, error } = await supabase
      .from("chat_conversation")
      .select(
        "id, title, type, updated_at, last_message_preview, participants:chat_participant(profile:profile_id(display_name))",
      )
      .eq("workspace_id", ctx.workspaceId)
      .in("id", conversationIds)
      .order("updated_at", { ascending: false })
      .limit(params.limit);

    if (error) {
      return `Error loading conversations: ${error.message}`;
    }

    if (!data || data.length === 0) {
      return "No active conversations found.";
    }

    return JSON.stringify(data);
  },
});

export const getUnreadCount = defineTool({
  name: "get_unread_count",
  description: "Get the total number of unread messages across all conversations",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    const { data, error } = await supabase
      .from("chat_participant")
      .select("unread_count")
      .eq("profile_id", ctx.profileId);

    if (error) {
      return `Error loading unread count: ${error.message}`;
    }

    const total = (data ?? []).reduce((sum, row) => sum + (row.unread_count ?? 0), 0);
    return JSON.stringify({ total_unread: total });
  },
});

export const sendMessage = defineTool({
  name: "send_message",
  description: "Send a text message to an existing conversation",
  schema: z.object({
    conversation_id: z.string().uuid().describe("The conversation ID to send the message to"),
    content: z.string().min(1).max(2000).describe("The message text to send"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin as SupabaseClient;

    // Verify the user is a participant in this conversation
    const { data: participant, error: participantError } = await supabase
      .from("chat_participant")
      .select("id")
      .eq("conversation_id", params.conversation_id)
      .eq("profile_id", ctx.profileId)
      .single();

    if (participantError || !participant) {
      return "You are not a participant in this conversation.";
    }

    // Insert the message
    const { data, error } = await supabase
      .from("chat_message")
      .insert({
        conversation_id: params.conversation_id,
        sender_profile_id: ctx.profileId,
        content: params.content,
        type: "text",
      })
      .select("id, content, created_at")
      .single();

    if (error) {
      return `Error sending message: ${error.message}`;
    }

    return JSON.stringify({ sent: true, message: data });
  },
});
