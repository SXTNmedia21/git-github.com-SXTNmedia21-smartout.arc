"use client";

import { useQuery } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "../../_hooks/dashboard-keys";

export type Season = {
  season_id: string;
  name: string;
  slug: string;
  season_type: string;
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "active" | "archived";
  is_default: boolean;
  color: string | null;
  icon: string | null;
  description: string | null;
};

export function useSeasons() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  const query = useQuery({
    queryKey: dashboardKeys.seasons(wsId ?? "none"),
    queryFn: async (): Promise<Season[]> => {
      const { data, error } = await supabase
        .from("season")
        .select(
          "season_id, name, slug, season_type, start_date, end_date, status, is_default, color, icon, description",
        )
        .eq("workspace_id", wsId!)
        .order("start_date", { ascending: false });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!wsId,
  });

  return {
    seasons: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
