"use client";

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { dashboardKeys } from "../../_hooks/dashboard-keys";
import { toast } from "sonner";
import { getDayFactorTemplate, WEEKDAY_LABELS } from "../_definitions/season-planning";

export type DayFactor = {
  day_factor_id: string;
  weekday: number;
  factor: number;
};

/** Default restaurant profile: weekend-heavy */
const DEFAULT_DAY_FACTORS = getDayFactorTemplate("restaurant");

export { WEEKDAY_LABELS, DEFAULT_DAY_FACTORS };

export function useDayFactors(seasonBudgetId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardKeys.dayFactors(wsId ?? "none", seasonBudgetId ?? "none"),
    queryFn: async (): Promise<DayFactor[]> => {
      const { data, error } = await supabase
        .from("day_factor")
        .select("day_factor_id, weekday, factor")
        .eq("workspace_id", wsId!)
        .eq("season_budget_id", seasonBudgetId!)
        .order("weekday");

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!wsId && !!seasonBudgetId,
    staleTime: 5 * 60 * 1000, // 5 minutes — semi-stable budget factors
  });

  const saveDayFactors = useMutation({
    mutationFn: async (factors: { weekday: number; factor: number }[]) => {
      // Delete existing + insert new (simpler than individual upserts for 7 rows)
      const { error: deleteError } = await supabase
        .from("day_factor")
        .delete()
        .eq("season_budget_id", seasonBudgetId!)
        .eq("workspace_id", wsId!);

      if (deleteError) throw new Error(deleteError.message);

      const rows = factors.map((f) => ({
        season_budget_id: seasonBudgetId!,
        workspace_id: wsId!,
        weekday: f.weekday,
        factor: f.factor,
      }));

      const { error: insertError } = await supabase.from("day_factor").insert(rows);

      if (insertError) throw new Error(insertError.message);
    },
    onSuccess: (_data, factors) => {
      void emit({
        event: "day_factors updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            season_budget_id: seasonBudgetId ?? "",
            count: factors.length,
          },
        },
      });
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.dayFactors(wsId!, seasonBudgetId!),
      });
      toast.success("Dagfaktorer lagret");
    },
    onError: (err: Error) => {
      toast.error(`Kunne ikke lagre dagfaktorer: ${err.message}`);
    },
  });

  return {
    dayFactors: query.data ?? [],
    isLoading: query.isLoading,
    saveDayFactors,
  };
}
