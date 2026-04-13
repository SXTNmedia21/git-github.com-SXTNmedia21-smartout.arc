"use client";

/**
 * usePlanningEvents — CRUD for planning_event table.
 *
 * Fetches events scoped to a workspace, optionally filtered by planning_cycle_id.
 * Used by the PlanningEventsTab in the season page.
 */

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";
import type {
  PlanningEventRow,
  PlanningEventCategory,
  PlanningEventSource,
} from "@/lib/cascade/types";

type CreateEventInput = {
  name: string;
  description?: string | null;
  category: PlanningEventCategory;
  source?: PlanningEventSource;
  event_date: string;
  end_date?: string | null;
  demand_multiplier: number;
  expected_covers?: number | null;
  confidence?: number | null;
  is_recurring?: boolean;
  recurrence_rule?: string | null;
  planning_cycle_id?: string | null;
};

type UpdateEventInput = Partial<CreateEventInput> & { planning_event_id: string };

function planningEventKeys(workspaceId: string, cycleId?: string | null) {
  return ["planning-events", workspaceId, cycleId ?? "all"] as const;
}

export function usePlanningEvents(planningCycleId?: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: planningEventKeys(wsId ?? "none", planningCycleId),
    queryFn: async (): Promise<PlanningEventRow[]> => {
      let q = supabase
        .from("planning_event")
        .select("*")
        .eq("workspace_id", wsId!)
        .order("event_date", { ascending: true });

      if (planningCycleId) {
        q = q.eq("planning_cycle_id", planningCycleId);
      }

      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as PlanningEventRow[];
    },
    enabled: !!wsId,
    staleTime: 60_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: ["planning-events", wsId],
    });
  };

  const createEvent = useMutation({
    mutationFn: async (input: CreateEventInput) => {
      const { error } = await supabase.from("planning_event").insert({
        workspace_id: wsId!,
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        source: input.source ?? "manual",
        event_date: input.event_date,
        end_date: input.end_date ?? null,
        demand_multiplier: input.demand_multiplier,
        expected_covers: input.expected_covers ?? null,
        confidence: input.confidence ?? 0.5,
        is_recurring: input.is_recurring ?? false,
        recurrence_rule: input.recurrence_rule ?? null,
        planning_cycle_id: input.planning_cycle_id ?? null,
        created_by: profileId ?? null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void emit({
        event: "planning_event created" as never,
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {},
      });
      invalidate();
      toast.success("Hendelse opprettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opprette: ${error.message}`);
    },
  });

  const updateEvent = useMutation({
    mutationFn: async (input: UpdateEventInput) => {
      const { planning_event_id, ...patch } = input;
      const { error } = await supabase
        .from("planning_event")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("planning_event_id", planning_event_id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Hendelse oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere: ${error.message}`);
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("planning_event")
        .delete()
        .eq("planning_event_id", eventId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Hendelse slettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette: ${error.message}`);
    },
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}
