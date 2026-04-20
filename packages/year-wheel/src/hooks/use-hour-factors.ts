import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@smartout/i18n";

import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";

import { yearWheelKeys } from "../query-keys";
import { toast } from "sonner";
import { getHourFactorTemplate } from "../season-planning";

export type HourFactor = {
  hour_factor_id: string;
  hour: number;
  factor: number;
};

/** Default restaurant profile: lunch + dinner peaks */
const DEFAULT_HOUR_FACTORS = getHourFactorTemplate("restaurant", 10, 22);

export { DEFAULT_HOUR_FACTORS };

export function useHourFactors(
  seasonBudgetId: string | null,
  workspaceId: string | null,
  profileId: string | null,
) {
  const { t } = useTranslation("dashboard");

  const wsId = workspaceId;

  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: yearWheelKeys.hourFactors(wsId ?? "none", seasonBudgetId ?? "none"),
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
    onSuccess: (_data, factors) => {
      void emit({
        event: "hour_factors updated",
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
        queryKey: yearWheelKeys.hourFactors(wsId!, seasonBudgetId!),
      });
      toast.success(t("yearWheel.toast_hour_factors_saved"));
    },
    onError: (err: Error) => {
      toast.error(t("yearWheel.toast_hour_factors_save_error", { error: err.message }));
    },
  });

  return {
    hourFactors: query.data ?? [],
    isLoading: query.isLoading,
    saveHourFactors,
  };
}
