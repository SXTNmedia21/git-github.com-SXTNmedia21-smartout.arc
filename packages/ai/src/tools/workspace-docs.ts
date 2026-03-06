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
    // Generate embedding for the search query
    const queryEmbedding = await getQueryEmbedding(query);

    // Call the match_workspace_docs RPC function
    const { data, error } = await ctx.supabase.rpc("match_workspace_docs", {
      p_workspace_id: workspaceId,
      query_embedding: queryEmbedding,
      match_count: matchCount,
      match_threshold: matchThreshold,
    });

    if (error) {
      return JSON.stringify({ error: `Search failed: ${error.message}` });
    }

    if (!data || data.length === 0) {
      return JSON.stringify({
        results: [],
        message: "No matching workspace documentation found. Try a broader query.",
      });
    }

    // Format results for the AI agent
    const results = data.map(
      (row: {
        chunk_id: string;
        doc_id: string;
        doc_title: string;
        section_title: string | null;
        content: string;
        token_count: number;
        similarity: number;
      }) => ({
        chunkId: row.chunk_id,
        docId: row.doc_id,
        docTitle: row.doc_title,
        section: row.section_title,
        content: row.content,
        tokens: row.token_count,
        similarity: Math.round(row.similarity * 1000) / 1000,
      }),
    );

    return JSON.stringify({ results, count: results.length });
  },
});

/** All workspace doc retrieval tools. Pass to toVercelTools() with a WorkspaceDocToolContext. */
export const WORKSPACE_DOC_TOOLS = [searchWorkspaceDocs] as const;
