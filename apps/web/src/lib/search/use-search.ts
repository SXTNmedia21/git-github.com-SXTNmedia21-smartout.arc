"use client";

/**
 * TanStack Query hook for the global search palette.
 * Debounces input, calls /api/search, maps response to SearchGroup[].
 * Falls back to static navigation commands when query is empty.
 */

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import type { SearchMode } from "@/lib/search/query-prefix";

export type SearchResult = {
  id: string;
  title: string;
  subtitle: string;
  deepLink: string;
  icon: "page" | "person" | "knowledge" | "policy" | "command";
};

export type SearchGroup = {
  label: string;
  results: SearchResult[];
};

/** Map backend group names to Norwegian UI labels */
const GROUP_LABELS: Record<string, string> = {
  people: "Ansatte",
  knowledge: "Kunnskap",
  policies: "Kvalitetsstyring",
};

/** Infer icon type from backend group name */
function iconForGroup(group: string): SearchResult["icon"] {
  switch (group) {
    case "people":
      return "person";
    case "knowledge":
      return "knowledge";
    case "policies":
      return "policy";
    default:
      return "page";
  }
}

type ApiResponse = {
  groups: Array<{
    group: string;
    results: Array<{
      id: string;
      title: string;
      subtitle: string;
      deepLink: string;
      relevance: number;
    }>;
  }>;
  timing_ms: number;
};

export function useSearch(query: string, mode: SearchMode, enabled: boolean) {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["global-search", workspaceId, mode, query],
    enabled: enabled && !!workspaceId && query.length > 0,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<SearchGroup[]> => {
      const params = new URLSearchParams({
        workspaceId: workspaceId!,
        q:
          mode === "all"
            ? query
            : `${mode === "knowledge" ? "?" : mode === "people" ? "@" : ">"}${query}`,
      });

      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) return [];

      const data = (await res.json()) as ApiResponse;

      return data.groups.map((g) => ({
        label: GROUP_LABELS[g.group] ?? g.group,
        results: g.results.map((r) => ({
          id: r.id,
          title: r.title,
          subtitle: r.subtitle,
          deepLink: r.deepLink,
          icon: iconForGroup(g.group),
        })),
      }));
    },
  });
}
