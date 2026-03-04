// ============================================
// docs.ts
// RAG retrieval tools for AI agents to search documentation.
// Provides semantic search and direct file retrieval over
// the platform_doc_chunk table.
// Connected to: src/embedding.ts (generates query embeddings)
// Connected to: ADR-0031 (pgvector RAG architecture)
// ============================================

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defineTool } from "../types";
import { getQueryEmbedding } from "../embedding";

/**
 * Context required by doc retrieval tools.
 * Needs a Supabase client (service-role recommended for platform-level data).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DocToolContext = { supabase: SupabaseClient<any, any, any> };

/**
 * search_platform_docs — Semantic search over embedded documentation.
 * Converts the query to a vector and finds the most similar chunks
 * using the match_platform_docs RPC function.
 */
export const searchPlatformDocs = defineTool({
  name: "search_platform_docs",
  description:
    "Search the Smartout documentation using semantic similarity. Returns the most relevant documentation chunks for the given query. Use this to find architecture decisions, module specs, and implementation guidance.",
  schema: z.object({
    query: z.string().describe("Natural language search query about the documentation"),
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
    docType: z
      .enum([
        "adr",
        "module",
        "architecture",
        "cross_cutting",
        "plan",
        "research",
        "roadmap",
        "other",
      ])
      .optional()
      .describe("Filter results to a specific document type"),
  }),
  execute: async ({ query, matchCount, matchThreshold, docType }, ctx: DocToolContext) => {
    // Generate embedding for the search query
    const queryEmbedding = await getQueryEmbedding(query);

    // Call the match_platform_docs RPC function
    const { data, error } = await ctx.supabase.rpc("match_platform_docs", {
      query_embedding: queryEmbedding,
      match_count: matchCount,
      match_threshold: matchThreshold,
      filter_doc_type: docType ?? null,
    });

    if (error) {
      return JSON.stringify({ error: `Search failed: ${error.message}` });
    }

    if (!data || data.length === 0) {
      return JSON.stringify({
        results: [],
        message: "No matching documentation found. Try a broader query.",
      });
    }

    // Format results for the AI agent
    const results = data.map(
      (row: {
        source_path: string;
        doc_type: string;
        section_title: string | null;
        content: string;
        token_count: number;
        similarity: number;
      }) => ({
        path: row.source_path,
        type: row.doc_type,
        section: row.section_title,
        content: row.content,
        tokens: row.token_count,
        similarity: Math.round(row.similarity * 1000) / 1000,
      }),
    );

    return JSON.stringify({ results, count: results.length });
  },
});

/**
 * get_doc_by_path — Fetches all chunks for a specific document by file path.
 * Useful when the agent knows exactly which document to read.
 */
export const getDocByPath = defineTool({
  name: "get_doc_by_path",
  description:
    "Fetch the full content of a specific documentation file by its path. Returns all chunks in order. Use this when you know the exact file path (e.g., from search results or ADR references).",
  schema: z.object({
    path: z
      .string()
      .describe(
        'Relative file path from project root (e.g., "docs/decisions/0031-documentation-rag-pgvector.md")',
      ),
  }),
  execute: async ({ path }, ctx: DocToolContext) => {
    const { data, error } = await ctx.supabase
      .from("platform_doc_chunk")
      .select("chunk_index, section_title, content, token_count, doc_type, metadata")
      .eq("source_path", path)
      .order("chunk_index", { ascending: true });

    if (error) {
      return JSON.stringify({ error: `Fetch failed: ${error.message}` });
    }

    if (!data || data.length === 0) {
      return JSON.stringify({
        error: `No document found at path: ${path}`,
        hint: "Use search_platform_docs to find the correct path.",
      });
    }

    // Combine all chunks into the full document content
    const fullContent = data.map((chunk) => chunk.content).join("\n\n---\n\n");
    const totalTokens = data.reduce((sum, chunk) => sum + chunk.token_count, 0);

    return JSON.stringify({
      path,
      type: data[0]?.doc_type,
      chunks: data.length,
      totalTokens,
      content: fullContent,
    });
  },
});

/** All doc retrieval tools. Pass to toVercelTools() with a DocToolContext. */
export const DOC_TOOLS = [searchPlatformDocs, getDocByPath] as const;
