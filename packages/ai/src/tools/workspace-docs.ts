// ============================================
// workspace-docs.ts
// RAG retrieval tools for AI agents to search workspace-scoped
// documentation (handbook chapters, policies, procedures, etc.).
// Uses the match_workspace_docs RPC for semantic search over
// the workspace_doc_chunk table.
// Connected to: src/embedding.ts (generates query embeddings)
// Connected to: match_workspace_docs RPC (pgvector similarity search)
// ============================================

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defineTool } from "../types";
import { getQueryEmbedding } from "../embedding";

/**
 * Context required by workspace doc retrieval tools.
 * Needs a Supabase client with RLS (workspace-scoped access).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WorkspaceDocToolContext = { supabase: SupabaseClient<any, any, any> };

type MatchWorkspaceDocRow = {
  chunk_id: string;
  source_type: string;
  source_path: string;
  title: string | null;
  content: string;
  similarity: number;
};

/**
 * Converts unknown RPC data into a typed result list.
 *
 * Why: Supabase RPC responses are runtime data, so this guard prevents
 * unsafe property access and keeps tool output stable when schemas change.
 *
 * @param data - RPC response payload
 * @returns A validated list of workspace doc rows
 */
function toWorkspaceDocRows(data: unknown): MatchWorkspaceDocRow[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((row): row is MatchWorkspaceDocRow => {
      if (!row || typeof row !== "object") {
        return false;
      }

      const candidate = row as Partial<MatchWorkspaceDocRow>;
      return (
        typeof candidate.chunk_id === "string" &&
        typeof candidate.source_type === "string" &&
        typeof candidate.source_path === "string" &&
        (candidate.title === null || typeof candidate.title === "string") &&
        typeof candidate.content === "string" &&
        typeof candidate.similarity === "number"
      );
    })
    .map((row) => row);
}

/**
 * search_workspace_docs — Semantic search over workspace documentation.
 * Converts the query to a vector and finds the most similar chunks
 * using the match_workspace_docs RPC function.
 */
export const searchWorkspaceDocs = defineTool({
  name: "search_workspace_docs",
  description:
    "Search workspace documentation (handbook chapters, policies, procedures, training materials) using semantic similarity. Returns the most relevant chunks for the given query. Use this to answer employee questions about workplace rules, procedures, and guidelines.",
  schema: z.object({
    workspaceId: z.string().uuid().describe("The workspace UUID to search within"),
    query: z.string().describe("Natural language search query about the workspace documentation"),
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
    { workspaceId, query, matchCount, matchThreshold },
    ctx: WorkspaceDocToolContext,
  ) => {
    const sanitizedQuery = query.trim();
    if (!sanitizedQuery) {
      return JSON.stringify({ error: "Query must not be empty." });
    }

    try {
      // Generate embedding for the search query
      const queryEmbedding = await getQueryEmbedding(sanitizedQuery);

      // Call the match_workspace_docs RPC function
      const { data, error } = await ctx.supabase.rpc("match_workspace_docs", {
        p_workspace_id: workspaceId,
        query_embedding: queryEmbedding,
        match_count: matchCount,
        match_threshold: matchThreshold,
      });

      if (error) {
        return JSON.stringify({
          error: "Search failed while querying workspace documents.",
          details: error.message,
          code: error.code ?? null,
        });
      }

      const rows = toWorkspaceDocRows(data);
      if (rows.length === 0) {
        return JSON.stringify({
          results: [],
          message: "No matching workspace documentation found. Try a broader query.",
        });
      }

      // Format results for the AI agent
      const results = rows.map((row) => ({
        chunkId: row.chunk_id,
        sourceType: row.source_type,
        sourcePath: row.source_path,
        title: row.title,
        content: row.content,
        similarity: Math.round(row.similarity * 1000) / 1000,
      }));

      return JSON.stringify({ results, count: results.length });
    } catch (error) {
      return JSON.stringify({
        error: "Search failed while preparing workspace document retrieval.",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

/** All workspace doc retrieval tools. Pass to toVercelTools() with a WorkspaceDocToolContext. */
export const WORKSPACE_DOC_TOOLS = [searchWorkspaceDocs] as const;
