import { createClient } from "@smartout/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchGroup = {
  group: string;
  results: Array<{
    id: string;
    title: string;
    subtitle: string;
    deepLink: string;
    relevance: number;
  }>;
};

type SearchResult = {
  groups: SearchGroup[];
  timing_ms: number;
};

type SearchContext = {
  workspaceId: string;
  query: string;
  mode?: "all" | "knowledge" | "people" | "commands";
  limitPerGroup?: number;
};

// ---------------------------------------------------------------------------
// Individual search runners
// ---------------------------------------------------------------------------

async function runInstanceSearch(ctx: SearchContext): Promise<SearchGroup> {
  const supabase = await createClient();
  // TODO: Remove cast once search RPCs are in generated types
  const { data, error } = await (supabase.rpc as Function)("search_instance", {
    p_workspace_id: ctx.workspaceId,
    p_query: ctx.query,
    p_limit: ctx.limitPerGroup ?? 5,
  });

  if (error || !data) return { group: "people", results: [] };

  return {
    group: "people",
    results: (
      data as Array<{
        result_id: string;
        title: string;
        subtitle: string;
        deep_link: string;
        relevance: number;
      }>
    ).map((r) => ({
      id: r.result_id,
      title: r.title,
      subtitle: r.subtitle,
      deepLink: r.deep_link,
      relevance: r.relevance,
    })),
  };
}

async function runSemanticSearch(_ctx: SearchContext): Promise<SearchGroup> {
  // Semantic search requires embedding the query first
  // For now, return empty — will be wired in Wave 3 (Task 6)
  return { group: "knowledge", results: [] };
}

async function runDependencySearch(ctx: SearchContext): Promise<SearchGroup> {
  const supabase = await createClient();
  // TODO: Remove cast once search RPCs are in generated types
  const { data, error } = await (supabase.rpc as Function)("search_dependency_graph", {
    p_workspace_id: ctx.workspaceId,
    p_query: ctx.query,
    p_limit: ctx.limitPerGroup ?? 5,
  });

  if (error || !data) return { group: "policies", results: [] };

  return {
    group: "policies",
    results: (
      data as Array<{
        policy_id: string;
        policy_name: string;
        protocol_id: string | null;
        protocol_name: string | null;
      }>
    ).map((r) => ({
      id: r.policy_id,
      title: r.policy_name,
      subtitle: r.protocol_name ?? "",
      deepLink: `/dashboard/governance/policies/${r.policy_id}`,
      relevance: 0.8,
    })),
  };
}

// ---------------------------------------------------------------------------
// Merge helper
// ---------------------------------------------------------------------------

function mergeAndCap(groups: SearchGroup[], limit: number): SearchGroup[] {
  return groups
    .filter((g) => g.results.length > 0)
    .map((g) => ({
      ...g,
      results: g.results.slice(0, limit),
    }));
}

// ---------------------------------------------------------------------------
// Orchestrator entry point
// ---------------------------------------------------------------------------

export async function runSearchOrchestrator(ctx: SearchContext): Promise<SearchResult> {
  const start = performance.now();
  const limit = ctx.limitPerGroup ?? 5;

  const [instance, semantic, dependency] = await Promise.all([
    runInstanceSearch(ctx),
    runSemanticSearch(ctx),
    runDependencySearch(ctx),
  ]);

  return {
    groups: mergeAndCap([instance, semantic, dependency], limit),
    timing_ms: Math.round(performance.now() - start),
  };
}
