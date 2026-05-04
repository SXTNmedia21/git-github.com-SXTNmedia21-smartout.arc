"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { guardianKeys } from "./guardian-keys";

export type GuardianSignalRow = {
  id: string;
  signal_type: string;
  domain: string;
  severity: "info" | "warning" | "critical";
  entity_type: string | null;
  entity_label: string | null;
  title: string;
  description: string | null;
  status: "active" | "acknowledged" | "resolved" | "dismissed";
  data: Record<string, unknown> | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  workspace_id: string;
};

export function useGuardianSignals() {
  return useQuery({
    queryKey: guardianKeys.signalsActive(),
    queryFn: async (): Promise<GuardianSignalRow[]> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("guardian_signal")
        .select(
          "id, signal_type, domain, severity, entity_type, entity_label, title, description, status, data, acknowledged_by, acknowledged_at, resolved_at, created_at, updated_at, workspace_id",
        )
        .eq("status", "active")
        .order("severity", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data as GuardianSignalRow[]) ?? [];
    },
    refetchInterval: 90_000,
    refetchOnWindowFocus: false,
    refetchIntervalInBackground: false,
  });
}

export function useAcknowledgeSignal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ signalId, note }: { signalId: string; note?: string }) => {
      const supabase = createClient();

      const updatePayload: Record<string, unknown> = {
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (note) {
        const { data: existing } = await supabase
          .from("guardian_signal")
          .select("data")
          .eq("id", signalId)
          .single();

        updatePayload.data = {
          ...((existing?.data as Record<string, unknown>) ?? {}),
          acknowledged_note: note,
        };
      }

      const { error } = await supabase
        .from("guardian_signal")
        .update(updatePayload)
        .eq("id", signalId)
        .eq("status", "active");

      if (error) throw error;
    },
    onSuccess: (_data, { signalId, note }) => {
      queryClient.invalidateQueries({ queryKey: guardianKeys.signals() });
      queryClient.invalidateQueries({ queryKey: guardianKeys.health() });

      void emit({
        event: "guardian_signal acknowledged",
        workspace_id: null,
        actor_id: nonEmpty("", "actor_id"),
        properties: { data: { signal_id: signalId, note } },
      });
    },
  });
}

export function useDismissSignal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (signalId: string) => {
      const supabase = createClient();

      const { error } = await supabase
        .from("guardian_signal")
        .update({
          status: "dismissed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", signalId)
        .eq("status", "active");

      if (error) throw error;
    },
    onSuccess: (_data, signalId) => {
      queryClient.invalidateQueries({ queryKey: guardianKeys.signals() });
      queryClient.invalidateQueries({ queryKey: guardianKeys.health() });

      void emit({
        event: "guardian_signal dismissed",
        workspace_id: null,
        actor_id: nonEmpty("", "actor_id"),
        properties: { data: { signal_id: signalId } },
      });
    },
  });
}
