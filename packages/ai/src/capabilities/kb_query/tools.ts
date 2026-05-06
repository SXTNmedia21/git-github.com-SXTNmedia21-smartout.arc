// packages/ai/src/capabilities/kb_query/tools.ts
// ADR-0221 — KB capability binds existing searchWorkspaceDocs to AgentToolContext.
// Without this wrapper, agent-router cannot dispatch the tool because the original
// tool uses WorkspaceDocToolContext (different shape).
import { z } from "zod";
import { defineTool } from "../../types.js";
import { getQueryEmbedding } from "../../embedding.js";
import type { AgentToolContext } from "../types.js";

type MatchWorkspaceDocRow = {
  chunk_id: string;
  source_type: string;
  source_path: string;
  title: string | null;
  content: string;
  similarity: number;
};

function toRows(data: unknown): MatchWorkspaceDocRow[] {
  if (!Array.isArray(data)) return [];
  return data.filter((row): row is MatchWorkspaceDocRow => {
    if (!row || typeof row !== "object") return false;
    const c = row as Partial<MatchWorkspaceDocRow>;
    return (
      typeof c.chunk_id === "string" &&
      typeof c.source_type === "string" &&
      typeof c.source_path === "string" &&
      (c.title === null || typeof c.title === "string") &&
      typeof c.content === "string" &&
      typeof c.similarity === "number"
    );
  });
}

export const searchKb = defineTool({
  name: "search_kb",
  description:
    "Search workspace documentation (handbook chapters, policies, procedures) using semantic similarity. Returns the most relevant chunks for the query. Use this to answer employee questions about workplace rules and procedures.",
  capability: "kb_query",
  schema: z.object({
    query: z.string().min(2).describe("Natural language search query"),
    matchCount: z.number().optional().default(5),
    matchThreshold: z.number().optional().default(0.5),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const sanitized = params.query.trim();
    if (!sanitized) {
      return JSON.stringify({ ok: false, error: "empty_query" });
    }

    try {
      const embedding = await getQueryEmbedding(sanitized);
      const { data, error } = await ctx.supabaseAdmin.rpc("match_workspace_docs", {
        p_workspace_id: ctx.workspaceId,
        query_embedding: embedding,
        match_count: params.matchCount,
        match_threshold: params.matchThreshold,
      });

      if (error) {
        return JSON.stringify({
          ok: false,
          error: "rpc_failed",
          details: error.message,
        });
      }

      const rows = toRows(data);
      return JSON.stringify({
        ok: true,
        results: rows.map((r) => ({
          chunk_id: r.chunk_id,
          source_type: r.source_type,
          title: r.title,
          content: r.content.slice(0, 500),
          similarity: Math.round(r.similarity * 100) / 100,
        })),
      });
    } catch (err) {
      return JSON.stringify({
        ok: false,
        error: "embedding_failed",
        details: err instanceof Error ? err.message : String(err),
      });
    }
  },
});
