// packages/ai/src/capabilities/communication/tools.ts
// Migrated from legacy chat_* tables to Komm channel_* tables (2026-03-28)
// Channel context + knowledge search tools merged from tools/channels.ts (2026-04-13)
import { z } from "zod";
import { emit } from "@smartout/telemetry";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";
import { getQueryEmbedding } from "../../embedding.js";

export const getConversations = defineTool({
  name: "get_conversations",
  description: "List the employee's active communication channels with latest message preview",
  capability: "communication",
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
  capability: "communication",
  schema: z.object({}),
  execute: async (_params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // The get_unread_counts RPC relies on auth.uid() which is unavailable
    // with service-role access. Replicate the logic: for each channel membership,
    // count messages created after last_read_message_id.
    const { data: memberships, error: memberError } = await supabase
      .from("channel_member")
      .select("channel_id, last_read_message_id")
      .eq("profile_id", ctx.profileId)
      .is("left_at", null);

    if (memberError) {
      return `Error loading unread count: ${memberError.message}`;
    }

    if (!memberships || memberships.length === 0) {
      return JSON.stringify({ total_unread: 0, channels: [] });
    }

    const channels: Array<{ channel_id: string; unread_count: number }> = [];
    let total = 0;

    for (const membership of memberships) {
      let query = supabase
        .from("channel_message")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", membership.channel_id)
        .is("deleted_at", null)
        .eq("delivery_mode", "timeline");

      if (membership.last_read_message_id) {
        // Get the timestamp of the last read message to filter newer ones
        const { data: lastRead } = await supabase
          .from("channel_message")
          .select("created_at")
          .eq("id", membership.last_read_message_id)
          .single();

        if (lastRead?.created_at) {
          query = query.gt("created_at", lastRead.created_at);
        }
      }

      const { count, error } = await query;

      if (!error && count && count > 0) {
        channels.push({ channel_id: membership.channel_id, unread_count: count });
        total += count;
      }
    }

    return JSON.stringify({ total_unread: total, channels });
  },
});

export const sendMessage = defineTool({
  name: "send_message",
  description: "Send a text message to a communication channel",
  capability: "communication",
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
        workspace_id: ctx.workspaceId,
        sender_id: ctx.profileId,
        content: params.content,
        message_type: "text",
      })
      .select("id, content, created_at")
      .single();

    if (error) {
      return `Error sending message: ${error.message}`;
    }

    // T1 fix: route via emit() registry — use existing "channel.message.sent"
    // event name. ADR-0156 / L-0064.
    await emit({
      event: "channel.message.sent",
      workspace_id: ctx.workspaceId,
      actor_id: ctx.profileId,
      entity: {
        entity_type: "channel_message",
        entity_id: data.id,
        entity_label: params.channel_id,
      },
      properties: {
        channel_id: params.channel_id,
        origin_type: "agent",
        message_type: "text",
      },
    });

    return JSON.stringify({ sent: true, message: data });
  },
});

/**
 * get_channel_context — Returns recent messages, members, and channel metadata
 * so the AI agent can understand the conversation before responding.
 * Migrated from packages/ai/src/tools/channels.ts (2026-04-13).
 */
export const getChannelContext = defineTool({
  name: "get_channel_context",
  description:
    "Get context about a communication channel: recent messages, members, and channel metadata. Use this to understand the conversation context before responding in a channel.",
  capability: "communication",
  schema: z.object({
    channel_id: z.string().uuid().describe("The channel UUID"),
    message_limit: z
      .number()
      .optional()
      .default(20)
      .describe("Maximum number of recent messages to return (default 20)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;

    // Fetch channel metadata
    const { data: channel, error: channelError } = await supabase
      .from("channel")
      .select("id, name, description, channel_type, created_at")
      .eq("id", params.channel_id)
      .eq("workspace_id", ctx.workspaceId)
      .single();

    if (channelError) {
      return JSON.stringify({ error: `Failed to fetch channel: ${channelError.message}` });
    }

    // Fetch channel members with profile names
    const { data: members, error: membersError } = await supabase
      .from("channel_member")
      .select("profile_id, role, joined_at")
      .eq("channel_id", params.channel_id)
      .is("left_at", null);

    if (membersError) {
      return JSON.stringify({ error: `Failed to fetch members: ${membersError.message}` });
    }

    // Fetch recent messages
    const { data: messages, error: messagesError } = await supabase
      .from("channel_message")
      .select("id, sender_id, content, created_at")
      .eq("channel_id", params.channel_id)
      .is("deleted_at", null)
      .eq("delivery_mode", "timeline")
      .order("created_at", { ascending: false })
      .limit(params.message_limit);

    if (messagesError) {
      return JSON.stringify({ error: `Failed to fetch messages: ${messagesError.message}` });
    }

    return JSON.stringify({
      channel,
      members: members ?? [],
      messages: (messages ?? []).reverse(),
      memberCount: members?.length ?? 0,
      messageCount: messages?.length ?? 0,
    });
  },
});

/**
 * search_knowledge — Searches workspace documentation using semantic similarity.
 * Filters by content type (procedures, manuals, training, quizzes).
 * Migrated from packages/ai/src/tools/channels.ts (2026-04-13).
 */
export const searchKnowledge = defineTool({
  name: "search_knowledge",
  description:
    "Search for procedures, manuals, training modules, and quizzes in the workspace knowledge base. Use this to find relevant content to share with employees in channels.",
  capability: "communication",
  schema: z.object({
    query: z.string().describe("Natural language search query"),
    content_types: z
      .array(z.enum(["procedure", "manual", "training", "quiz"]))
      .optional()
      .describe("Filter by content type"),
    match_count: z
      .number()
      .optional()
      .default(5)
      .describe("Maximum number of results to return (default 5)"),
    match_threshold: z
      .number()
      .optional()
      .default(0.5)
      .describe("Minimum similarity score 0-1 (default 0.5)"),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const sanitizedQuery = params.query.trim();
    if (!sanitizedQuery) {
      return JSON.stringify({ error: "Query must not be empty." });
    }

    try {
      const queryEmbedding = await getQueryEmbedding(sanitizedQuery);

      const { data, error } = await ctx.supabaseAdmin.rpc("match_workspace_docs", {
        p_workspace_id: ctx.workspaceId,
        query_embedding: queryEmbedding,
        match_count: params.match_count,
        match_threshold: params.match_threshold,
      });

      if (error) {
        return JSON.stringify({
          error: "Knowledge search failed.",
          details: error.message,
          code: error.code ?? null,
        });
      }

      if (!Array.isArray(data) || data.length === 0) {
        return JSON.stringify({
          results: [],
          message: "No matching knowledge content found. Try a broader query.",
        });
      }

      // Filter by content type if specified
      const filtered = params.content_types
        ? data.filter((row: { source_type: string }) =>
            params.content_types!.includes(
              row.source_type as "procedure" | "manual" | "training" | "quiz",
            ),
          )
        : data;

      const results = filtered.map(
        (row: {
          chunk_id: string;
          source_type: string;
          source_path: string;
          title: string | null;
          content: string;
          similarity: number;
        }) => ({
          chunkId: row.chunk_id,
          contentType: row.source_type,
          sourcePath: row.source_path,
          title: row.title,
          content: row.content,
          similarity: Math.round(row.similarity * 1000) / 1000,
        }),
      );

      return JSON.stringify({ results, count: results.length });
    } catch (err) {
      return JSON.stringify({
        error: "Knowledge search failed.",
        details: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
});
