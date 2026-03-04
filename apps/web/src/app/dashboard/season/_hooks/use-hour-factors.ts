"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { dashboardKeys } from "../../_hooks/dashboard-keys";
import { toast } from "sonner";

export type HourFactor = {
  hour_factor_id: string;
  hour: number;
  factor: number;
};

/** Default restaurant profile: lunch + dinner peaks */
const DEFAULT_HOUR_FACTORS: { hour: number; factor: number }[] = [
  { hour: 10, factor: 0.4 },
  { hour: 11, factor: 0.7 },
  { hour: 12, factor: 1.3 },
  { hour: 13, factor: 1.0 },
  { hour: 14, factor: 0.8 },
  { hour: 15, factor: 0.6 },
  { hour: 16, factor: 0.9 },
  { hour: 17, factor: 1.5 },
  { hour: 18, factor: 2.0 },
  { hour: 19, factor: 2.4 },
  { hour: 20, factor: 2.2 },
  { hour: 21, factor: 1.1 },
];

export { DEFAULT_HOUR_FACTORS };

export function useHourFactors(seasonBudgetId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: dashboardKeys.hourFactors(wsId ?? "none", seasonBudgetId ?? "none"),
    queryFn: async (): Promise<HourFactor[]> => {
      const { data, error } = await supabase
        .from("hour_factor")
        .select("hour_factor_id, hour, factor")
        .eq("workspace_id", wsId!)
        .eq("season_budget_id", seasonBudgetId!)
        .order("hour");

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!wsId && !!seasonBudgetId,
    staleTime: 5 * 60 * 1000, // 5 minutes — semi-stable budget factors
  });

  const saveHourFactors = useMutation({
    mutationFn: async (factors: { hour: number; factor: number }[]) => {
      const { error: deleteError } = await supabase
        .from("hour_factor")
        .delete()
        .eq("season_budget_id", seasonBudgetId!)
        .eq("workspace_id", wsId!);

      if (deleteError) throw new Error(deleteError.message);

      const rows = factors.map((f) => ({
        season_budget_id: seasonBudgetId!,
        workspace_id: wsId!,
        hour: f.hour,
        factor: f.factor,
      }));

      const { error: insertError } = await supabase.from("hour_factor").insert(rows);

      if (insertError) throw new Error(insertError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: dashboardKeys.hourFactors(wsId!, seasonBudgetId!),
      });
      toast.success("Timefaktorer lagret");
    },
    onError: (err: Error) => {
      toast.error(`Kunne ikke lagre timefaktorer: ${err.message}`);
    },
  });

  return {
    hourFactors: query.data ?? [],
    isLoading: query.isLoading,
    saveHourFactors,
  };
}
