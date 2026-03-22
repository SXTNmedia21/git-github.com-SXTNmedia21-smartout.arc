"use client";

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { toast } from "sonner";

export type ChangeProposal = {
  change_proposal_id: string;
  workspace_id: string;
  status: string;
  proposal_payload: Record<string, unknown>;
  preview_payload: Record<string, unknown> | null;
  initiator: string;
  created_at: string;
  applied_at: string | null;
};

function proposalKeys(workspaceId: string) {
  return ["settings", "change-proposals", workspaceId] as const;
}

export function useChangeProposals() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: proposalKeys(wsId ?? "none"),
    queryFn: async (): Promise<ChangeProposal[]> => {
      const { data, error } = await supabase
        .from("change_proposal")
        .select("*")
        .eq("workspace_id", wsId!)
        .in("status", ["pending", "approved", "failed"])
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!wsId,
    staleTime: 30_000,
  });

  const createProposal = useMutation({
    mutationFn: async (payload: {
      changeType: string;
      proposalPayload: Record<string, unknown>;
      previewPayload: Record<string, unknown>;
    }) => {
      const { error } = await supabase.from("change_proposal").insert({
        workspace_id: wsId!,
        status: "pending",
        initiator: "admin_manual",
        proposal_payload: { change_type: payload.changeType, ...payload.proposalPayload },
        preview_payload: payload.previewPayload,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      void emit({
        event: "change_proposal created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {},
      });
      queryClient.invalidateQueries({ queryKey: proposalKeys(wsId!) });
      toast.success("Endringsforslag opprettet");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase
        .from("change_proposal")
        .update({ status: "approved" })
        .eq("change_proposal_id", proposalId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalKeys(wsId!) });
      toast.success("Forslag godkjent");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      const { error } = await supabase
        .from("change_proposal")
        .update({ status: "rejected" })
        .eq("change_proposal_id", proposalId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalKeys(wsId!) });
      toast.success("Forslag avvist");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyProposal = useMutation({
    mutationFn: async (proposalId: string) => {
      const response = await supabase.functions.invoke("apply-change-proposal", {
        body: { proposalId },
      });
      if (response.error) throw new Error(response.error.message);
    },
    onSuccess: () => {
      void emit({
        event: "change_proposal applied",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {},
      });
      queryClient.invalidateQueries({ queryKey: proposalKeys(wsId!) });
      toast.success("Endring gjennomført");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    proposals: query.data ?? [],
    isLoading: query.isLoading,
    createProposal,
    approveProposal,
    rejectProposal,
    applyProposal,
  };
}
