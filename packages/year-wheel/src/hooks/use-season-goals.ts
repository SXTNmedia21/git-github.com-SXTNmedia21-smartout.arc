/**
 * useSeasonGoals — CRUD for season_goal table.
 *
 * Fetches goals scoped to a specific season, sorted by sort_order.
 * Provides create, update, and delete mutations with telemetry.
 * Used by SeasonGoalsTab in the season page.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@smartout/i18n";

import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";

import { yearWheelKeys } from "../query-keys";
import { toast } from "sonner";
import type { SeasonGoalRow, SeasonGoalStatus } from "../types";

type CreateGoalInput = {
  title: string;
  description?: string | null;
  metric_key?: string | null;
  target_value?: number | null;
  target_unit?: string | null;
};

type UpdateGoalInput = {
  season_goal_id: string;
  title?: string;
  description?: string | null;
  metric_key?: string | null;
  target_value?: number | null;
  target_unit?: string | null;
  status?: SeasonGoalStatus;
  sort_order?: number;
};

export function useSeasonGoals(
  seasonId: string | null,
  workspaceId: string | null,
  profileId: string | null,
) {
  const { t } = useTranslation("dashboard");

  const wsId = workspaceId;

  const supabase = createClient();
  const queryClient = useQueryClient();

  const queryKey = yearWheelKeys.seasonGoals(wsId ?? "none", seasonId ?? "none");

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<SeasonGoalRow[]> => {
      const { data, error } = await supabase
        .from("season_goal")
        .select("*")
        .eq("workspace_id", wsId!)
        .eq("season_id", seasonId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as SeasonGoalRow[];
    },
    enabled: !!wsId && !!seasonId,
    staleTime: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
  };

  const createGoal = useMutation({
    mutationFn: async (input: CreateGoalInput): Promise<SeasonGoalRow> => {
      const currentGoals = query.data ?? [];
      const nextOrder =
        currentGoals.length > 0 ? Math.max(...currentGoals.map((g) => g.sort_order)) + 1 : 0;

      const { data, error } = await supabase
        .from("season_goal")
        .insert({
          workspace_id: wsId!,
          season_id: seasonId!,
          title: input.title.trim(),
          description: input.description ?? null,
          metric_key: input.metric_key ?? null,
          target_value: input.target_value ?? null,
          target_unit: input.target_unit ?? null,
          sort_order: nextOrder,
          created_by: profileId ?? null,
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return data as SeasonGoalRow;
    },
    onSuccess: (data) => {
      void emit({
        event: "season_goal created",
        workspace_id: wsId ? nonEmpty(wsId, "workspace_id") : null,
        actor_id: nonEmpty(profileId ?? "unknown", "actor_id"),
        properties: {
          entity: {
            entity_type: "season_goal",
            entity_id: data.season_goal_id,
            entity_label: data.title,
          },
          data: { title: data.title, season_id: data.season_id },
        },
      });
      invalidate();
      toast.success(t("yearWheel.toast_goal_created"));
    },
    onError: (error: Error) => {
      toast.error(t("yearWheel.toast_goal_create_error", { error: error.message }));
    },
  });

  const updateGoal = useMutation({
    mutationFn: async (input: UpdateGoalInput): Promise<void> => {
      const { season_goal_id, ...patch } = input;
      const { error } = await supabase
        .from("season_goal")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("season_goal_id", season_goal_id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, input) => {
      void emit({
        event: "season_goal updated",
        workspace_id: wsId ? nonEmpty(wsId, "workspace_id") : null,
        actor_id: nonEmpty(profileId ?? "unknown", "actor_id"),
        properties: {
          entity: {
            entity_type: "season_goal",
            entity_id: input.season_goal_id,
          },
          data: { status: input.status },
        },
      });
      invalidate();
      toast.success(t("yearWheel.toast_goal_updated"));
    },
    onError: (error: Error) => {
      toast.error(t("yearWheel.toast_goal_update_error", { error: error.message }));
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (goalId: string): Promise<void> => {
      const { error } = await supabase.from("season_goal").delete().eq("season_goal_id", goalId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, goalId) => {
      void emit({
        event: "season_goal deleted",
        workspace_id: wsId ? nonEmpty(wsId, "workspace_id") : null,
        actor_id: nonEmpty(profileId ?? "unknown", "actor_id"),
        properties: {
          entity: {
            entity_type: "season_goal",
            entity_id: goalId,
          },
        },
      });
      invalidate();
      toast.success(t("yearWheel.toast_goal_deleted"));
    },
    onError: (error: Error) => {
      toast.error(t("yearWheel.toast_goal_delete_error", { error: error.message }));
    },
  });

  return {
    goals: query.data ?? [],
    isLoading: query.isLoading,
    createGoal,
    updateGoal,
    deleteGoal,
  };
}
