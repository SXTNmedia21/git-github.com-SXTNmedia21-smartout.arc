"use client";

/**
 * Fetches and mutates maintenance-type procedures for the cleaning checklist admin.
 * Queries procedure table filtered by procedure_type = 'maintenance',
 * joined with procedure_step for checkpoint details and session_hook for scheduling.
 *
 * Also provides mutations for creating/updating procedures and managing steps.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";
import { useTranslation } from "@smartout/i18n";

export type MaintenanceStep = {
  step_id: string;
  title: string;
  description: string | null;
  step_order: number;
  is_required: boolean;
};

export type MaintenanceHook = {
  id: string;
  hook_type: string;
  department_id: string;
  trigger_offset_min: number;
  is_active: boolean;
};

export type MaintenanceProcedure = {
  procedure_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  protocol: { protocol_id: string; name: string } | null;
  steps: MaintenanceStep[];
  hooks: MaintenanceHook[];
};

function maintenanceKey(wsId: string) {
  return ["hms", "maintenance-procedures", wsId] as const;
}

export function useMaintenanceProcedures() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: maintenanceKey(wsId ?? ""),
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const supabase = createClient();

      /* Fetch maintenance procedures with steps and hooks.
         The session_hook FK name is explicit to avoid ambiguity. */
      const { data, error } = await supabase
        .from("procedure")
        .select(
          `
          procedure_id, name, description, is_active,
          protocol:protocol_id(protocol_id, name),
          steps:procedure_step(step_id, title, description, step_order, is_required),
          hooks:session_hook!session_hook_linked_procedure_id_fkey(id, hook_type, department_id, trigger_offset_min, is_active)
        `,
        )
        .eq("procedure_type", "maintenance")
        .order("name");

      if (error) throw error;
      return (data ?? []) as unknown as MaintenanceProcedure[];
    },
  });
}

export function useCreateSessionHook() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const { t } = useTranslation("cleaning");
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      department_id: string;
      hook_type: "pre_open" | "close";
      linked_procedure_id: string;
    }) => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("session_hook")
        .insert({
          workspace_id: wsId!,
          department_id: params.department_id,
          hook_type: params.hook_type,
          trigger_offset_min: 0,
          linked_procedure_id: params.linked_procedure_id,
          is_active: true,
        })
        .select("id")
        .single();
      if (error) throw error;
      return { ...data, ...params };
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: maintenanceKey(wsId ?? "") });
      void emit({
        event: "session_hook created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            hook_id: _data.id,
            department_id: variables.department_id,
            hook_type: variables.hook_type,
            linked_procedure_id: variables.linked_procedure_id,
          },
        },
      });
      toast.success(t("cleaning.hookCreated"));
    },
    onError: (error: Error) => {
      toast.error(`${t("cleaning.hookCreateError")}: ${error.message}`);
    },
  });
}

export function useDeleteSessionHook() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const { t } = useTranslation("cleaning");
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (hookId: string) => {
      const supabase = createClient();
      const { error } = await supabase.from("session_hook").delete().eq("id", hookId);
      if (error) throw error;
    },
    onSuccess: (_data, hookId) => {
      qc.invalidateQueries({ queryKey: maintenanceKey(wsId ?? "") });
      void emit({
        event: "session_hook deleted",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          data: {
            hook_id: hookId,
          },
        },
      });
      toast.success(t("cleaning.hookDeleted"));
    },
    onError: (error: Error) => {
      toast.error(`${t("cleaning.hookDeleteError")}: ${error.message}`);
    },
  });
}
