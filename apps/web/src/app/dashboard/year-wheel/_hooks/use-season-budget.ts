"use client";

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { dashboardKeys } from "../../_hooks/dashboard-keys";
import { toast } from "sonner";
import type { SeasonBudgetStatus } from "../_definitions/season-planning";

export type SeasonBudget = {
  season_budget_id: string;
  season_id: string;
  total_target_revenue: number;
  base_price_per_guest: number | null;
  season_price_factor: number;
  target_labor_percentage: number;
  avg_hourly_wage: number | null;
  status: SeasonBudgetStatus;
};

type UpsertSeasonBudgetInput = {
  season_id: string;
  total_target_revenue: number;
  base_price_per_guest?: number | null;
  season_price_factor?: number;
  target_labor_percentage?: number;
  avg_hourly_wage?: number | null;
  status?: SeasonBudgetStatus;
};

export function useSeasonBudget(seasonId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardKeys.seasonBudget(wsId ?? "none", seasonId ?? "none"),
    queryFn: async (): Promise<SeasonBudget | null> => {
      const { data, error } = await supabase
        .from("season_budget")
        .select(
          "season_budget_id, season_id, total_target_revenue, base_price_per_guest, season_price_factor, target_labor_percentage, avg_hourly_wage, status",
        )
        .eq("workspace_id", wsId!)
        .eq("season_id", seasonId!)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!wsId && !!seasonId,
    staleTime: 5 * 60 * 1000, // 5 minutes — semi-stable season budget
  });

  const upsertBudget = useMutation({
    mutationFn: async (input: UpsertSeasonBudgetInput) => {
      const existing = query.data;

      if (existing) {
        const { error } = await supabase
          .from("season_budget")
          .update({
            total_target_revenue: input.total_target_revenue,
            base_price_per_guest: input.base_price_per_guest ?? null,
            season_price_factor: input.season_price_factor ?? 1.0,
            target_labor_percentage: input.target_labor_percentage ?? 0.3,
            avg_hourly_wage: input.avg_hourly_wage ?? null,
            status: input.status ?? existing.status,
            updated_at: new Date().toISOString(),
          })
          .eq("season_budget_id", existing.season_budget_id);

        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("season_budget").insert({
          season_id: input.season_id,
          workspace_id: wsId!,
          total_target_revenue: input.total_target_revenue,
          base_price_per_guest: input.base_price_per_guest ?? null,
          season_price_factor: input.season_price_factor ?? 1.0,
          target_labor_percentage: input.target_labor_percentage ?? 0.3,
          avg_hourly_wage: input.avg_hourly_wage ?? null,
          status: input.status ?? "draft",
        });

        if (error) throw new Error(error.message);
      }
    },
    onSuccess: (_data, input) => {
      void emit({
        event: "season_budget updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: {
            entity_type: "season_budget",
            entity_id: seasonId ?? "",
          },
          data: {
            season_id: seasonId ?? "",
            total_target_revenue: input.total_target_revenue,
          },
        },
      });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.seasonBudget(wsId!, seasonId!),
      });
      toast.success("Sesongbudsjett lagret");
    },
    onError: (err: Error) => {
      toast.error(`Kunne ikke lagre budsjett: ${err.message}`);
    },
  });

  return {
    budget: query.data ?? null,
    isLoading: query.isLoading,
    upsertBudget,
  };
}
