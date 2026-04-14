"use client";

/**
 * TanStack Query mutations for protocol assignment management.
 * Handles assign, waive, revoke, and bulk assign operations.
 * Every mutation calls emit() from @smartout/telemetry on success.
 * Connected to: AssignProtocolSheet, WaiveAssignmentDialog, ProtocolEmployeeList
 */

import { useContext } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { dashboardKeys } from "@/app/dashboard/_hooks";

// ══════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════

type AssignProtocolInput = {
  protocolId: string;
  profileId: string;
  protocolVersion?: string;
};

type BulkAssignProtocolInput = {
  protocolId: string;
  profileIds: string[];
  protocolVersion?: string;
};

type WaiveAssignmentInput = {
  assignmentId: string;
  reason: string;
};

type RevokeAssignmentInput = {
  assignmentId: string;
  protocolId: string;
};

// ══════════════════════════════════════════════════════════════
// Assign Protocol (single)
// ══════════════════════════════════════════════════════════════

export function useAssignProtocol() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: AssignProtocolInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("protocol_assignment")
        .insert({
          protocol_id: input.protocolId,
          profile_id: input.profileId,
          workspace_id: workspace.workspace_id,
          assigned_via: "manual",
          assigned_by: profileId!,
          status: "not_started",
          protocol_version: input.protocolVersion ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "training-protocol-assigned",
          context: data.assignment_id,
        },
      });
      toast.success("Protokoll tildelt");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
      void queryClient.invalidateQueries({
        queryKey: ["hms", "competence-matrix", workspace.workspace_id],
      });
    },

    onError: () => {
      toast.error("Kunne ikke tildele protokoll");
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Bulk Assign Protocol
// ══════════════════════════════════════════════════════════════

export function useBulkAssignProtocol() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: BulkAssignProtocolInput) => {
      const supabase = createClient();

      const rows = input.profileIds.map((pid) => ({
        protocol_id: input.protocolId,
        profile_id: pid,
        workspace_id: workspace.workspace_id,
        assigned_via: "manual" as const,
        assigned_by: profileId!,
        status: "not_started" as const,
        protocol_version: input.protocolVersion ?? null,
      }));

      const { data, error } = await supabase.from("protocol_assignment").insert(rows).select();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "training-protocol-bulk-assigned",
          context: `${data.length} assignments`,
        },
      });
      toast.success(`${data.length} ansatte tildelt protokoll`);
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
      void queryClient.invalidateQueries({
        queryKey: ["hms", "competence-matrix", workspace.workspace_id],
      });
    },

    onError: () => {
      toast.error("Kunne ikke tildele protokoll til ansatte");
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Waive Assignment
// ══════════════════════════════════════════════════════════════

export function useWaiveAssignment() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: WaiveAssignmentInput) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("protocol_assignment")
        .update({
          status: "waived",
          waived_by: profileId!,
          waived_reason: input.reason,
        })
        .eq("assignment_id", input.assignmentId)
        .eq("workspace_id", workspace.workspace_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },

    onSuccess: (data) => {
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "training-assignment-waived",
          context: data.assignment_id,
        },
      });
      toast.success("Tildeling frafalt");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
      void queryClient.invalidateQueries({
        queryKey: ["hms", "competence-matrix", workspace.workspace_id],
      });
    },

    onError: () => {
      toast.error("Kunne ikke frafalle tildeling");
    },
  });
}

// ══════════════════════════════════════════════════════════════
// Revoke Assignment (delete — only if not completed)
// ══════════════════════════════════════════════════════════════

export function useRevokeAssignment() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);

  return useMutation({
    mutationFn: async (input: RevokeAssignmentInput) => {
      const supabase = createClient();

      // Guard: never delete completed assignments
      const { data: existing, error: fetchError } = await supabase
        .from("protocol_assignment")
        .select("assignment_id, status")
        .eq("assignment_id", input.assignmentId)
        .eq("workspace_id", workspace.workspace_id)
        .single();

      if (fetchError) throw fetchError;
      if (existing.status === "completed") {
        throw new Error("Kan ikke fjerne en fullfort tildeling");
      }

      const { error } = await supabase
        .from("protocol_assignment")
        .delete()
        .eq("assignment_id", input.assignmentId)
        .eq("workspace_id", workspace.workspace_id);

      if (error) throw error;
      return { assignmentId: input.assignmentId, protocolId: input.protocolId };
    },

    onSuccess: (result) => {
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "training-assignment-revoked",
          context: result.assignmentId,
        },
      });
      toast.success("Tildeling fjernet");
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.governanceOverview(workspace.workspace_id),
      });
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.protocolAssignees(workspace.workspace_id, result.protocolId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["hms", "competence-matrix", workspace.workspace_id],
      });
    },

    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Kunne ikke fjerne tildeling");
    },
  });
}
