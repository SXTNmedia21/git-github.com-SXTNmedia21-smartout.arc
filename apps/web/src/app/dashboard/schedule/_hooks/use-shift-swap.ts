"use client";

/**
 * Hooks for shift swap in the schedule view.
 * Queries engine_state for pending swaps, calls SECURITY DEFINER RPCs
 * for initiate/respond/approve. Telemetry emitted in onSuccess
 * (RPCs run in PostgreSQL, cannot call TypeScript emit()).
 *
 * Connected to: engine_state (process_id = 'shift_swap')
 * Connected to: schedule_shift (read for eligibility, mutated by RPCs)
 */

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import type { ShiftSwapContext } from "@smartout/utils";

// ── Query Keys ──────────────────────────────────────────────────────────────

function swapKey(wsId: string) {
  return ["schedule", "swaps", wsId] as const;
}

// ── Types ───────────────────────────────────────────────────────────────────

export type SwapRequest = {
  id: string;
  context: ShiftSwapContext;
  engineStatus: string;
  startedAt: string;
};

// ── Query: Pending Swap Requests ────────────────────────────────────────────

export function useSwapRequests() {
  const { workspace } = useWorkspace();
  const wsId = workspace.workspace_id;

  return useQuery({
    queryKey: swapKey(wsId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("engine_state")
        .select("id, context, status, started_at, updated_at")
        .eq("process_id", "shift_swap")
        .eq("workspace_id", wsId)
        .in("status", ["active", "waiting"])
        .order("started_at", { ascending: false });

      if (error) throw error;
      return (data ?? []).map(
        (row): SwapRequest => ({
          id: row.id as string,
          context: row.context as ShiftSwapContext,
          engineStatus: row.status as string,
          startedAt: row.started_at as string,
        }),
      );
    },
  });
}

// ── Mutation: Initiate Swap ─────────────────────────────────────────────────

export function useInitiateSwap() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      requesterShiftId: string;
      targetProfileId: string;
      targetShiftId: string;
      reason?: string;
    }) => {
      const supabase = createClient();
      // RPC not yet in generated types — cast fn name until next `supabase gen types`
      const { data, error } = await supabase.rpc(
        "initiate_shift_swap" as never,
        {
          p_requester_shift_id: params.requesterShiftId,
          p_target_profile_id: params.targetProfileId,
          p_target_shift_id: params.targetShiftId,
          p_reason: params.reason ?? null,
        } as never,
      );
      if (error) throw error;
      return data as string;
    },
    onSuccess: (swapId, variables) => {
      void emit({
        event: "shift swap_requested",
        workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity_type: "shift",
          entity_id: swapId,
          data: {
            swap_id: swapId,
            requester_shift_id: variables.requesterShiftId,
            target_shift_id: variables.targetShiftId,
            target_profile_id: variables.targetProfileId,
          },
        },
      });
      void qc.invalidateQueries({ queryKey: swapKey(workspace.workspace_id) });
      toast.success("Bytteforespørsel sendt");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Kunne ikke sende bytteforespørsel";
      toast.error(message);
    },
  });
}

// ── Mutation: Respond to Swap ───────────────────────────────────────────────

export function useRespondToSwap() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { swapId: string; accepted: boolean; reason?: string }) => {
      const supabase = createClient();
      // RPC not yet in generated types — cast fn name until next `supabase gen types`
      const { error } = await supabase.rpc(
        "respond_to_shift_swap" as never,
        {
          p_swap_id: params.swapId,
          p_accepted: params.accepted,
          p_reason: params.reason ?? null,
        } as never,
      );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      if (vars.accepted) {
        void emit({
          event: "shift swap_accepted",
          workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: vars.swapId,
            data: { swap_id: vars.swapId },
          },
        });
      } else {
        void emit({
          event: "shift swap_rejected",
          workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: vars.swapId,
            data: { swap_id: vars.swapId, rejected_by: profileId ?? "" },
          },
        });
      }
      void qc.invalidateQueries({ queryKey: swapKey(workspace.workspace_id) });
      toast.success(vars.accepted ? "Bytte akseptert" : "Bytte avvist");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Kunne ikke svare på bytteforespørsel";
      toast.error(message);
    },
  });
}

// ── Mutation: Approve/Reject Swap ───────────────────────────────────────────

export function useApproveSwap() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { swapId: string; approved: boolean; reason?: string }) => {
      const supabase = createClient();
      // RPC not yet in generated types — cast fn name until next `supabase gen types`
      const { error } = await supabase.rpc(
        "approve_shift_swap" as never,
        {
          p_swap_id: params.swapId,
          p_approved: params.approved,
          p_reason: params.reason ?? null,
        } as never,
      );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      if (vars.approved) {
        // Emit both approval and execution — the RPC swaps employee_ids on approval
        void emit({
          event: "shift swap_approved",
          workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: vars.swapId,
            data: { swap_id: vars.swapId },
          },
        });
        void emit({
          event: "shift swap_executed",
          workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: vars.swapId,
            data: { swap_id: vars.swapId },
          },
        });
      } else {
        void emit({
          event: "shift swap_rejected",
          workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
          actor_id: nonEmpty(profileId, "actor_id"),
          properties: {
            entity_type: "shift",
            entity_id: vars.swapId,
            data: { swap_id: vars.swapId, rejected_by: profileId ?? "" },
          },
        });
      }
      // Invalidate both swap queries and shift queries (shifts mutated on approval)
      void qc.invalidateQueries({ queryKey: swapKey(workspace.workspace_id) });
      void qc.invalidateQueries({ queryKey: ["schedule"] });
      toast.success(vars.approved ? "Bytte godkjent" : "Bytte avvist");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Kunne ikke behandle bytteforespørsel";
      toast.error(message);
    },
  });
}

// ── Mutation: Cancel Swap ──────────────────────────────────────────────────

export function useCancelSwap() {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (swapId: string) => {
      const supabase = createClient();
      // RPC not yet in generated types — cast fn name until next `supabase gen types`
      const { data, error } = await supabase.rpc(
        "cancel_shift_swap" as never,
        { p_swap_id: swapId } as never,
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (_, swapId) => {
      void emit({
        event: "shift swap_cancelled",
        workspace_id: nonEmpty(workspace.workspace_id, "workspace_id"),
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity_type: "shift",
          entity_id: swapId,
          data: { swap_id: swapId },
        },
      });
      void qc.invalidateQueries({ queryKey: swapKey(workspace.workspace_id) });
      toast.success("Byttforespørsel kansellert");
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Kunne ikke kansellere bytte";
      toast.error(message);
    },
  });
}
