"use client";

/**
 * usePlanningCycles — CRUD for planning_cycle table.
 *
 * Fetches cycles scoped to a workspace, ordered by start_date descending.
 * Used by PlanningCycleSelector in the season page.
 */

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";
import type { PlanningCycleRow, PlanningCycleStatus } from "@/lib/cascade/types";

type CreateCycleInput = {
  name: string;
  start_date: string;
  end_date: string;
  total_revenue_target?: number | null;
  status?: PlanningCycleStatus;
};

type UpdateCycleInput = Partial<CreateCycleInput> & { planning_cycle_id: string };

export function usePlanningCycles() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["planning-cycles", wsId],
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
    void queryClient.invalidateQueries({ queryKey: ["planning-cycles", wsId] });
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
    onSuccess: () => {
      invalidate();
      toast.success("Planperiode opprettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opprette: ${error.message}`);
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
    onSuccess: () => {
      invalidate();
      toast.success("Planperiode oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
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
      void queryClient.invalidateQueries({ queryKey: ["seasons"] });
      toast.success("Sesong koblet til planperiode");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke koble: ${error.message}`);
    },
  });

  return {
    cycles: query.data ?? [],
    isLoading: query.isLoading,
    createCycle,
    updateCycle,
    linkSeasonToCycle,
  };
}
