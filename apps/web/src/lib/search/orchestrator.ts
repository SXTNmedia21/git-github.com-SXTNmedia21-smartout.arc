/**
 * Search orchestrator
 *
 * Runs three search modes in parallel and returns a grouped,
 * hard-capped response envelope used by `/api/search`.
 */

import { createClient } from "@smartout/supabase/server";

export type SearchMode = "all" | "knowledge" | "people" | "commands";

export type OrchestratorInput = {
  workspaceId: string;
  query: string;
  mode?: SearchMode;
  limitPerGroup?: number;
};

export type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  deepLink: string;
  relevance: number;
};

export type SearchGroupName = "people" | "knowledge" | "policies";

export type SearchGroup = {
  group: SearchGroupName;
  results: SearchItem[];
};

export type SearchResult = {
  groups: SearchGroup[];
  timing_ms: number;
};

type InstanceRpcRow = {
  result_id: string;
  title: string;
  subtitle: string;
  deep_link: string;
  relevance: number;
};

type DependencyRpcRow = {
  policy_id: string;
  policy_name: string;
  protocol_name: string | null;
};

type SearchRpcName = "search_instance" | "search_dependency_graph";

type RpcArgs = {
  p_workspace_id: string;
  p_query: string;
  p_limit: number;
};

type RpcInvoker = <TRow>(rpcName: SearchRpcName, args: RpcArgs) => Promise<TRow[]>;

type OrchestratorDeps = {
  now?: () => number;
  runSemanticSearch?: (ctx: OrchestratorInput) => Promise<SearchGroup>;
};

/**
 * Calls an untyped Supabase RPC and narrows its result to a typed array.
 * Why: generated DB RPC typings may lag migrations in active feature branches.
 */
async function callRpc<TRow>(rpcName: SearchRpcName, args: RpcArgs): Promise<TRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(rpcName, args);

  if (error) {
    throw new Error(`${rpcName} failed: ${error.message}`);
  }

  if (!Array.isArray(data)) {
    throw new Error(`${rpcName} returned non-array payload`);
  }

  return data as TRow[];
}

/**
 * Executes instance-mode search and maps rows into the shared search item shape.
 */
async function runInstanceSearch(
  ctx: OrchestratorInput,
  invokeRpc: RpcInvoker,
): Promise<SearchGroup> {
  const rows = await invokeRpc<InstanceRpcRow>("search_instance", {
    p_workspace_id: ctx.workspaceId,
    p_query: ctx.query,
    p_limit: ctx.limitPerGroup ?? 5,
  });

  return {
    group: "people",
    results: rows.map((row) => ({
      id: row.result_id,
      title: row.title,
      subtitle: row.subtitle,
      deepLink: row.deep_link,
      relevance: row.relevance,
    })),
  };
}

/**
 * Executes semantic-mode search.
 * Why: semantic retrieval is optional-safe until embedding pipeline is fully wired.
 */
async function runSemanticSearch(_ctx: OrchestratorInput): Promise<SearchGroup> {
  return {
    group: "knowledge",
    results: [],
  };
}

/**
 * Executes dependency graph search and maps relation rows to navigation results.
 */
async function runDependencySearch(
  ctx: OrchestratorInput,
  invokeRpc: RpcInvoker,
): Promise<SearchGroup> {
  const rows = await invokeRpc<DependencyRpcRow>("search_dependency_graph", {
    p_workspace_id: ctx.workspaceId,
    p_query: ctx.query,
    p_limit: ctx.limitPerGroup ?? 5,
  });

  return {
    group: "policies",
    results: rows.map((row) => ({
      id: row.policy_id,
      title: row.policy_name,
      subtitle: row.protocol_name ?? "",
      deepLink: `/dashboard/governance/policies/${row.policy_id}`,
      relevance: 0.8,
    })),
  };
}

/**
 * Hard-caps each group while preserving deterministic group order.
 */
function mergeAndCap(groups: SearchGroup[], limitPerGroup: number): SearchGroup[] {
  return groups
    .map((group) => ({
      group: group.group,
      results: group.results.slice(0, limitPerGroup),
    }))
    .filter((group) => group.results.length > 0);
}

/**
 * Runs instance + semantic + dependency modes in parallel and returns grouped output.
 */
export async function runSearchOrchestrator(
  input: OrchestratorInput,
  deps: OrchestratorDeps = {},
): Promise<SearchResult> {
  const startedAt = (deps.now ?? Date.now)();
  const limitPerGroup = input.limitPerGroup ?? 5;
  const invokeRpc: RpcInvoker = callRpc;
  const semanticRunner = deps.runSemanticSearch ?? runSemanticSearch;

  const mode = input.mode ?? "all";
  const shouldRunInstance = mode === "all" || mode === "people" || mode === "commands";
  const shouldRunSemantic = mode === "all" || mode === "knowledge";
  const shouldRunDependency = mode === "all" || mode === "knowledge";

  const [instance, semantic, dependency] = await Promise.all([
    shouldRunInstance ? runInstanceSearch(input, invokeRpc) : Promise.resolve(null),
    shouldRunSemantic ? semanticRunner(input) : Promise.resolve(null),
    shouldRunDependency ? runDependencySearch(input, invokeRpc) : Promise.resolve(null),
  ]);

  const groups = [instance, semantic, dependency].filter(
    (group): group is SearchGroup => group !== null,
  );

  return {
    groups: mergeAndCap(groups, limitPerGroup),
    timing_ms: Math.max(0, (deps.now ?? Date.now)() - startedAt),
  };
}
