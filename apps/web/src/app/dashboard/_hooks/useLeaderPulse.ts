"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { dashboardKeys } from "./dashboard-keys";

// ── Types ────────────────────────────────────────────────

export type LeaderPulseStatus = "pending" | "delivered" | "answered" | "expired";

export type LeaderPulse = {
  id: string;
  workspace_id: string;
  profile_id: string;
  question: string;
  context: Record<string, unknown>;
  status: LeaderPulseStatus;
  delivered_via: string | null;
  delivered_at: string | null;
  answered_at: string | null;
  answer: string | null;
  created_at: string;
};

// ── Stable empty array ───────────────────────────────────

const EMPTY_PULSES: LeaderPulse[] = [];

// ── Hook ─────────────────────────────────────────────────

/**
 * Fetches pending pulse questions for the current user's profile(s).
 * Provides mutations for answering and dismissing.
 * Connected to: LeaderPulseCard component
 */
export function useLeaderPulse() {
  const ctx = useWorkspaceOptional();
  const workspaceId = ctx?.workspace.workspace_id;
  const queryClient = useQueryClient();

  const queryKey = dashboardKeys.leaderPulse(workspaceId ?? "none");

  const pulsesQuery = useQuery({
    queryKey,
    enabled: !!workspaceId,
    staleTime: 60_000, // 1 min — pulse data is relatively stable
    refetchInterval: 5 * 60_000, // 5 min
    queryFn: async (): Promise<LeaderPulse[]> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("leader_pulse")
        .select(
          "id, workspace_id, profile_id, question, context, status, delivered_via, delivered_at, answered_at, answer, created_at",
        )
        .eq("workspace_id", workspaceId!)
        .in("status", ["pending", "delivered"])
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data ?? []) as LeaderPulse[];
    },
  });

  const answerMutation = useMutation({
    mutationFn: async ({ pulseId, answer }: { pulseId: string; answer: string }) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("leader_pulse")
        .update({
          status: "answered",
          answer,
          answered_at: new Date().toISOString(),
        })
        .eq("id", pulseId);

      if (error) throw error;
    },
    onSuccess: (_data, { pulseId }) => {
      queryClient.invalidateQueries({ queryKey });

      void emit({
        event: "leader_pulse answered",
        workspace_id: (workspaceId ?? null) ? nonEmpty(workspaceId ?? null, "workspace_id") : null,
        actor_id: nonEmpty("", "actor_id"),
        properties: { data: { pulse_id: pulseId } },
      });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async ({ pulseId }: { pulseId: string }) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("leader_pulse")
        .update({ status: "expired" })
        .eq("id", pulseId);

      if (error) throw error;
    },
    onSuccess: (_data, { pulseId }) => {
      queryClient.invalidateQueries({ queryKey });

      void emit({
        event: "leader_pulse dismissed",
        workspace_id: (workspaceId ?? null) ? nonEmpty(workspaceId ?? null, "workspace_id") : null,
        actor_id: nonEmpty("", "actor_id"),
        properties: { data: { pulse_id: pulseId } },
      });
    },
  });

  const pulses = useMemo(() => pulsesQuery.data ?? EMPTY_PULSES, [pulsesQuery.data]);

  return {
    pulses,
    isLoading: pulsesQuery.isLoading,
    isError: pulsesQuery.isError,
    answer: answerMutation.mutate,
    dismiss: dismissMutation.mutate,
    isAnswering: answerMutation.isPending,
    isDismissing: dismissMutation.isPending,
  };
}
