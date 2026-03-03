"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "../../_hooks/dashboard-keys";
import { toast } from "sonner";

export type DayFactor = {
  day_factor_id: string;
  weekday: number;
  factor: number;
};

const WEEKDAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const;

/** Default restaurant profile: weekend-heavy */
const DEFAULT_DAY_FACTORS: { weekday: number; factor: number }[] = [
  { weekday: 0, factor: 1.0 },
  { weekday: 1, factor: 1.1 },
  { weekday: 2, factor: 1.2 },
  { weekday: 3, factor: 1.4 },
  { weekday: 4, factor: 2.2 },
  { weekday: 5, factor: 2.5 },
  { weekday: 6, factor: 1.3 },
];

export { WEEKDAY_LABELS, DEFAULT_DAY_FACTORS };

export function useDayFactors(seasonBudgetId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
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
    onSuccess: () => {
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
