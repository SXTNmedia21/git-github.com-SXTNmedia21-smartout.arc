// packages/ai/src/capabilities/operations-intelligence/learn-tools.ts
// ADR-0088 Phase 3 LEARN: On-demand tool to query K1b learned patterns from engine_memory.
// query_patterns — surfaces learned operational patterns for a department or workspace.
import { z } from "zod";
import { defineTool } from "../../types.js";
import type { AgentToolContext } from "../types.js";

/**
 * query_patterns — Query learned operational patterns from K1b workspace knowledge base.
 * Manager/system asks: "what patterns have we learned about this department?" or
 * "show me staffing patterns we've detected."
 */
export const queryPatterns = defineTool({
  name: "query_patterns",
  description:
    "Query learned operational patterns from the workspace knowledge base (K1b engine_memory). Returns patterns grouped by type, filtered by importance and retention policy. Useful for surfacing recurring staffing trends, deviation correlations, and task duration baselines.",
  capability: "operations_intelligence",
  schema: z.object({
    pattern_type: z
      .enum(["task_duration", "staffing", "deviation_correlation"])
      .optional()
      .describe(
        "Filter by pattern type: task_duration, staffing, or deviation_correlation. If omitted, returns all types.",
      ),
    department_id: z
      .string()
      .uuid()
      .optional()
      .describe("Scope patterns to this department. If omitted, returns workspace-wide patterns."),
    min_importance: z
      .number()
      .min(0)
      .max(1)
      .default(0.3)
      .describe("Minimum importance score (0–1) for returned patterns. Default 0.3 filters noise."),
    limit: z
      .number()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum number of patterns to return. Default 20."),
  }),
  execute: async (params, ctx: AgentToolContext) => {
    const supabase = ctx.supabaseAdmin;
    const now = new Date().toISOString();

    // 1. Query engine_memory for learned_pattern entries that:
    //    - belong to this workspace
    //    - meet minimum importance
    //    - have not expired (retention policy)
    let query = supabase
      .from("engine_memory")
      .select(
        "memory_id, entity_type, entity_id, content, importance, expires_at, created_at, updated_at",
      )
      .eq("workspace_id", ctx.workspaceId)
      .eq("memory_type", "learned_pattern")
      .gte("importance", params.min_importance)
      .or(`expires_at.is.null,expires_at.gte.${now}`)
      .order("importance", { ascending: false })
      .limit(params.limit * 3); // over-fetch to allow client-side filtering

    if (params.department_id) {
      query = query.eq("entity_id", params.department_id);
    }

    const { data: rows, error } = await query;

    if (error) {
      return JSON.stringify({ error: error.message });
    }

    // 2. Parse content JSON, filter by pattern_type and department_id if given
    type ParsedPattern = {
      memory_id: string;
      entity_type: string;
      entity_id: string | null;
      pattern_type: string;
      importance: number;
      expires_at: string | null;
      created_at: string;
      updated_at: string | null;
      data: unknown;
    };

    const patterns: ParsedPattern[] = [];

    for (const row of rows ?? []) {
      let parsed: Record<string, unknown>;
      try {
        parsed =
          typeof row.content === "string"
            ? (JSON.parse(row.content) as Record<string, unknown>)
            : (row.content as Record<string, unknown>);
      } catch {
        // Skip unparseable entries — they are not structured learned_pattern records
        continue;
      }

      const patternType = (parsed.pattern_type as string) ?? (parsed.type as string) ?? "unknown";

      // Filter by pattern_type if specified
      if (params.pattern_type && patternType !== params.pattern_type) {
        continue;
      }

      // Filter by department_id via content field if entity_id is not set
      if (params.department_id && row.entity_id && row.entity_id !== params.department_id) {
        continue;
      }

      patterns.push({
        memory_id: row.memory_id as string,
        entity_type: (row.entity_type as string) ?? "unknown",
        entity_id: (row.entity_id as string | null) ?? null,
        pattern_type: patternType,
        importance: row.importance as number,
        expires_at: (row.expires_at as string | null) ?? null,
        created_at: row.created_at as string,
        updated_at: (row.updated_at as string | null) ?? null,
        data: parsed,
      });

      if (patterns.length >= params.limit) break;
    }

    // 3. Group by pattern_type
    const byType: Record<string, { count: number; patterns: ParsedPattern[] }> = {};

    for (const p of patterns) {
      if (!byType[p.pattern_type]) {
        byType[p.pattern_type] = { count: 0, patterns: [] };
      }
      const bucket = byType[p.pattern_type];
      if (bucket) {
        bucket.count++;
        bucket.patterns.push(p);
      }
    }

    // 4. Emit telemetry
    await supabase.from("engine_event").insert({
      workspace_id: ctx.workspaceId,
      event_type: "ops.learn.patterns_queried",
      payload: {
        department_id: params.department_id ?? null,
        pattern_type: params.pattern_type ?? null,
        min_importance: params.min_importance,
        limit: params.limit,
        total_returned: patterns.length,
        types_found: Object.keys(byType),
        source: "agent_tool",
        actor_id: ctx.profileId,
        origin: "system",
      },
    });

    return JSON.stringify({
      total_patterns: patterns.length,
      filters: {
        pattern_type: params.pattern_type ?? null,
        department_id: params.department_id ?? null,
        min_importance: params.min_importance,
      },
      by_type: byType,
    });
  },
});
