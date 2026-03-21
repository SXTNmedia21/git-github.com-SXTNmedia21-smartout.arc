"use client";

import { useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { dashboardKeys } from "../../_hooks/dashboard-keys";
import { toast } from "sonner";

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
  planning_cycle_id: string | null;
};

type CreateSeasonInput = {
  name: string;
  startDate?: string | null;
  endDate?: string | null;
};

/**
 * Converts free text into a stable slug format for season names.
 */
function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function useSeasons() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardKeys.seasons(wsId ?? "none"),
    queryFn: async (): Promise<Season[]> => {
      const { data, error } = await supabase
        .from("season")
        .select(
          "season_id, name, slug, season_type, start_date, end_date, status, is_default, color, icon, description, planning_cycle_id",
        )
        .eq("workspace_id", wsId!)
        .order("start_date", { ascending: false });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!wsId,
    staleTime: 10 * 60 * 1000, // 10 minutes — stable season definitions
  });

  const createSeason = useMutation({
    mutationFn: async (input: CreateSeasonInput): Promise<Season> => {
      const trimmedName = input.name.trim();
      const existingSlugs = new Set((query.data ?? []).map((season) => season.slug));
      const baseSlug = toSlug(trimmedName) || "season";

      let slug = baseSlug;
      let slugSuffix = 2;
      while (existingSlugs.has(slug)) {
        slug = `${baseSlug}-${slugSuffix}`;
        slugSuffix += 1;
      }

      const { data, error } = await supabase
        .from("season")
        .insert({
          workspace_id: wsId!,
          name: trimmedName,
          slug,
          season_type: "default",
          start_date: input.startDate ?? null,
          end_date: input.endDate ?? null,
          status: "draft",
        })
        .select(
          "season_id, name, slug, season_type, start_date, end_date, status, is_default, color, icon, description, planning_cycle_id",
        )
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data, { name }) => {
      void emit({
        event: "season created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season",
            entity_id: data.season_id,
            entity_label: name,
          },
          data: { name, status: "draft" },
        },
      });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.seasons(wsId ?? "none"),
      });
      toast.success("Sesong opprettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opprette sesong: ${error.message}`);
    },
  });

  return {
    seasons: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createSeason,
  };
}
