// ============================================
// channels.ts
// AI tool definitions for Botsson's channel context and
// workspace knowledge search. Definitions only — handlers
// live in the stage-engine service.
// Connected to: packages/walkieTalkie (channel infrastructure)
// Connected to: workspace_doc_chunk table (knowledge search)
// ============================================

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defineTool } from "../types";
import { getQueryEmbedding } from "../embedding";

/**
 * Context required by channel tools.
 * Needs a Supabase client with RLS (workspace-scoped access).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ChannelToolContext = { supabase: SupabaseClient<any, any, any> };

/**
 * get_channel_context — Gives Botsson context about a communication channel.
 * Returns recent messages, members, and channel metadata so the AI agent
 * can understand the conversation context before responding.
 */
export const channelContextTool = defineTool({
  name: "get_channel_context",
  description:
    "Get context about a communication channel: recent messages, members, and channel metadata. Use this to understand the conversation context before responding in a channel.",
  schema: z.object({
    channelId: z.string().uuid().describe("The channel UUID"),
    workspaceId: z.string().uuid().describe("The workspace UUID"),
    messageLimit: z
      .number()
      .optional()
      .default(20)
      .describe("Maximum number of recent messages to return (default 20)"),
  }),
  execute: async ({ channelId, workspaceId, messageLimit }, ctx: ChannelToolContext) => {
    // Fetch channel metadata
    const { data: channel, error: channelError } = await ctx.supabase
      .from("channel")
      .select("id, name, description, channel_type, created_at")
      .eq("id", channelId)
      .eq("workspace_id", workspaceId)
      .single();

    if (channelError) {
      return JSON.stringify({ error: `Failed to fetch channel: ${channelError.message}` });
    }

    // Fetch channel members
    const { data: members, error: membersError } = await ctx.supabase
      .from("channel_member")
      .select("profile_id, role, joined_at")
      .eq("channel_id", channelId);

    if (membersError) {
      return JSON.stringify({ error: `Failed to fetch members: ${membersError.message}` });
    }

    // Fetch recent messages
    const { data: messages, error: messagesError } = await ctx.supabase
      .from("channel_message")
      .select("id, sender_profile_id, content, created_at")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false })
      .limit(messageLimit);

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
 * search_knowledge — Lets Botsson search and share knowledge content.
 * Searches workspace documentation filtered by content type (procedures,
 * manuals, training modules, quizzes) using semantic similarity.
 */
export const knowledgeSearchTool = defineTool({
  name: "search_knowledge",
  description:
    "Search for procedures, manuals, training modules, and quizzes in the workspace knowledge base. Use this to find relevant content to share with employees in channels.",
  schema: z.object({
    query: z.string().describe("Natural language search query"),
    workspaceId: z.string().uuid().describe("The workspace UUID"),
    contentTypes: z
      .array(z.enum(["procedure", "manual", "training", "quiz"]))
      .optional()
      .describe("Filter by content type"),
    matchCount: z
      .number()
      .optional()
      .default(5)
      .describe("Maximum number of results to return (default 5)"),
    matchThreshold: z
      .number()
      .optional()
      .default(0.5)
      .describe("Minimum similarity score 0-1 (default 0.5)"),
  }),
  execute: async (
    { query, workspaceId, contentTypes, matchCount, matchThreshold },
    ctx: ChannelToolContext,
  ) => {
    const sanitizedQuery = query.trim();
    if (!sanitizedQuery) {
      return JSON.stringify({ error: "Query must not be empty." });
    }

    try {
      const queryEmbedding = await getQueryEmbedding(sanitizedQuery);

      const { data, error } = await ctx.supabase.rpc("match_workspace_docs", {
        p_workspace_id: workspaceId,
        query_embedding: queryEmbedding,
        match_count: matchCount,
        match_threshold: matchThreshold,
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
      const filtered = contentTypes
        ? data.filter((row: { source_type: string }) =>
            contentTypes.includes(row.source_type as "procedure" | "manual" | "training" | "quiz"),
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
    } catch (error) {
      return JSON.stringify({
        error: "Knowledge search failed.",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

/** All channel AI tools. Pass to toVercelTools() with a ChannelToolContext. */
export const CHANNEL_TOOLS = [channelContextTool, knowledgeSearchTool] as const;
