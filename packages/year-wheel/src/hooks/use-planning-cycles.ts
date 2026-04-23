/**
 * usePlanningCycles — CRUD for planning_cycle table.
 *
 * Fetches cycles scoped to a workspace, ordered by start_date descending.
 * Used by PlanningCycleSelector in the season page.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@smartout/i18n";
import { createClient } from "@smartout/supabase/client";
import { yearWheelKeys } from "../query-keys";

import { toast } from "sonner";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { PlanningCycleRow, PlanningCycleStatus } from "../types";

type CreateCycleInput = {
  name: string;
  start_date: string;
  end_date: string;
  total_revenue_target?: number | null;
  status?: PlanningCycleStatus;
};

type UpdateCycleInput = Partial<CreateCycleInput> & { planning_cycle_id: string };

export function usePlanningCycles(workspaceId: string | null, profileId: string | null) {
  const { t } = useTranslation("dashboard");

  const wsId = workspaceId;

  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: yearWheelKeys.planningCycles(wsId ?? "none"),
    queryFn: async (): Promise<PlanningCycleRow[]> => {
      const { data, error } = await supabase
        .from("planning_cycle")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("start_date", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as PlanningCycleRow[];
    },
    enabled: !!wsId,
    staleTime: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: yearWheelKeys.planningCycles(wsId ?? "none") });
  };

  const createCycle = useMutation({
    mutationFn: async (input: CreateCycleInput) => {
      const { data, error } = await supabase
        .from("planning_cycle")
        .insert({
          workspace_id: wsId!,
          name: input.name,
          start_date: input.start_date,
          end_date: input.end_date,
          total_revenue_target: input.total_revenue_target ?? null,
          status: input.status ?? "draft",
          created_by: profileId ?? null,
        })
        .select("planning_cycle_id")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_data, input) => {
      void emit({
        event: "planning_cycle created" as never,
        workspace_id: wsId ? nonEmpty(wsId, "workspace_id") : null,
        actor_id: nonEmpty(profileId ?? "unknown", "actor_id"),
        properties: {},
      });
      invalidate();
      toast.success(t("yearWheel.toast_cycle_created"));
    },
    onError: (error: Error) => {
      toast.error(t("yearWheel.toast_cycle_create_error", { error: error.message }));
    },
  });

  const updateCycle = useMutation({
    mutationFn: async (input: UpdateCycleInput) => {
      const { planning_cycle_id, ...patch } = input;
      const { error } = await supabase
        .from("planning_cycle")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("planning_cycle_id", planning_cycle_id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_data, input) => {
      void emit({
        event: "planning_cycle updated" as never,
        workspace_id: wsId ? nonEmpty(wsId, "workspace_id") : null,
        actor_id: nonEmpty(profileId ?? "unknown", "actor_id"),
        properties: {},
      });
      invalidate();
      toast.success(t("yearWheel.toast_cycle_updated"));
    },
    onError: (error: Error) => {
      toast.error(t("yearWheel.toast_cycle_update_error", { error: error.message }));
    },
  });

  const linkSeasonToCycle = useMutation({
    mutationFn: async ({ seasonId, cycleId }: { seasonId: string; cycleId: string | null }) => {
      const { error } = await supabase
        .from("season")
        .update({ planning_cycle_id: cycleId })
        .eq("season_id", seasonId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: yearWheelKeys.seasons(wsId ?? "none") });
      toast.success(t("yearWheel.toast_cycle_linked"));
    },
    onError: (error: Error) => {
      toast.error(t("yearWheel.toast_cycle_link_error", { error: error.message }));
    },
  });

  const activateCycle = useMutation({
    mutationFn: async (cycleId: string) => {
      const { error: archiveError } = await supabase
        .from("planning_cycle")
        .update({ status: "archived" as PlanningCycleStatus, updated_at: new Date().toISOString() })
        .eq("workspace_id", wsId!)
        .eq("status", "active" as PlanningCycleStatus);

      if (archiveError) throw new Error(archiveError.message);

      const { data, error } = await supabase
        .from("planning_cycle")
        .update({ status: "active" as PlanningCycleStatus, updated_at: new Date().toISOString() })
        .eq("planning_cycle_id", cycleId)
        .select("planning_cycle_id, name")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      void emit({
        event: "planning_cycle activated",
        workspace_id: wsId ? nonEmpty(wsId, "workspace_id") : null,
        actor_id: nonEmpty(profileId ?? "unknown", "actor_id"),
        properties: {
          entity: {
            entity_type: "planning_cycle",
            entity_id: data.planning_cycle_id,
            entity_label: data.name,
          },
          data: { status: "active" as const },
        },
      });
      invalidate();
      toast.success(t("yearWheel.toast_cycle_activated"));
    },
    onError: (error: Error) => {
      toast.error(t("yearWheel.toast_cycle_activate_error", { error: error.message }));
    },
  });

  const archiveCycle = useMutation({
    mutationFn: async (cycleId: string) => {
      const { data, error } = await supabase
        .from("planning_cycle")
        .update({ status: "archived" as PlanningCycleStatus, updated_at: new Date().toISOString() })
        .eq("planning_cycle_id", cycleId)
        .select("planning_cycle_id, name")
        .single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data) => {
      void emit({
        event: "planning_cycle archived",
        workspace_id: wsId ? nonEmpty(wsId, "workspace_id") : null,
        actor_id: nonEmpty(profileId ?? "unknown", "actor_id"),
        properties: {
          entity: {
            entity_type: "planning_cycle",
            entity_id: data.planning_cycle_id,
            entity_label: data.name,
          },
          data: { status: "archived" as const },
        },
      });
      invalidate();
      toast.success(t("yearWheel.toast_cycle_archived"));
    },
    onError: (error: Error) => {
      toast.error(t("yearWheel.toast_cycle_archive_error", { error: error.message }));
    },
  });

  return {
    cycles: query.data ?? [],
    isLoading: query.isLoading,
    createCycle,
    updateCycle,
    linkSeasonToCycle,
    activateCycle,
    archiveCycle,
  };
}
