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

  const activateSeason = useMutation({
    mutationFn: async (seasonId: string): Promise<Season> => {
      // Validate: budget must exist and have required fields
      const { data: budget, error: budgetError } = await supabase
        .from("season_budget")
        .select("season_budget_id, total_target_revenue, target_labor_percentage, avg_hourly_wage")
        .eq("season_id", seasonId)
        .single();

      if (budgetError || !budget) throw new Error("Sesong mangler budsjett");
      if (!budget.total_target_revenue || budget.total_target_revenue <= 0)
        throw new Error("Budsjett mangler omsetningsmål");

      // Validate: day factors must exist (keyed on season_budget_id).
      // workspace_id guard ensures we never see factors from another tenant's budget
      // if season_budget_id were ever reused across workspaces.
      const { count: dayFactorCount } = await supabase
        .from("day_factor")
        .select("*", { count: "exact", head: true })
        .eq("season_budget_id", budget.season_budget_id)
        .eq("workspace_id", wsId!);

      if (!dayFactorCount || dayFactorCount === 0) throw new Error("Sesong mangler dagfaktorer");

      // Validate: hour factors must exist (keyed on season_budget_id)
      const { count: hourFactorCount } = await supabase
        .from("hour_factor")
        .select("*", { count: "exact", head: true })
        .eq("season_budget_id", budget.season_budget_id);

      if (!hourFactorCount || hourFactorCount === 0) throw new Error("Sesong mangler timefaktorer");

      // Deactivate any currently active season in this workspace.
      // We check the error explicitly so a failed deactivation doesn't leave two
      // seasons active at the same time (partial success window).
      const { error: deactivateError } = await supabase
        .from("season")
        .update({ status: "archived" })
        .eq("workspace_id", wsId!)
        .eq("status", "active");

      if (deactivateError) throw deactivateError;

      // Activate this season
      const { data, error } = await supabase
        .from("season")
        .update({ status: "active" })
        .eq("season_id", seasonId)
        .select(
          "season_id, name, slug, season_type, start_date, end_date, status, is_default, color, icon, description, planning_cycle_id",
        )
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      void emit({
        event: "season activated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season",
            entity_id: data.season_id,
            entity_label: data.name,
          },
          data: { status: "active" },
        },
      });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.seasons(wsId ?? "none"),
      });
      toast.success(`${data.name} er nå aktiv!`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const archiveSeason = useMutation({
    mutationFn: async (seasonId: string): Promise<Season> => {
      const { data, error } = await supabase
        .from("season")
        .update({ status: "archived" })
        .eq("season_id", seasonId)
        .select(
          "season_id, name, slug, season_type, start_date, end_date, status, is_default, color, icon, description, planning_cycle_id",
        )
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      void emit({
        event: "season archived",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season",
            entity_id: data.season_id,
            entity_label: data.name,
          },
          data: { status: "archived" },
        },
      });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.seasons(wsId ?? "none"),
      });
      toast.success(`${data.name} er arkivert`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return {
    seasons: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createSeason,
    activateSeason,
    archiveSeason,
  };
}
