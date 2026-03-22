"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { getMenusForWorkspace } from "../_actions/bridge-actions";
import { websiteKeys } from "./website-keys";

export function useMenus() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  const query = useQuery({
    queryKey: [...websiteKeys.all, "menus", wsId],
    queryFn: () => getMenusForWorkspace(wsId!),
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000,
  });

  return { menus: query.data ?? [], isLoading: query.isLoading };
}
