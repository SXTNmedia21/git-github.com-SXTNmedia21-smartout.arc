/**
 * TanStack Query hooks for contract template bindings and template copy.
 *
 * Used by the template bindings settings UI inside employee group cards.
 * Workspace-scoped via DashboardContext.
 */

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateBindingRow = {
  id: string;
  workspace_id: string;
  template_id: string;
  employment_category: string;
  employee_group_id: string | null;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  contract_template: {
    template_id: string;
    name: string;
    employment_category: string | null;
    is_system: boolean;
  } | null;
};

export type WorkspaceTemplate = {
  template_id: string;
  name: string;
  employment_category: string | null;
  is_system: boolean;
  is_active: boolean;
};

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

function bindingsKey(workspaceId: string, groupId?: string) {
  return ["template-bindings", workspaceId, groupId ?? "all"] as const;
}

function workspaceTemplatesKey(workspaceId: string) {
  return ["workspace-templates", workspaceId] as const;
}

// ---------------------------------------------------------------------------
// Read: bindings for a group
// ---------------------------------------------------------------------------

export function useTemplateBindings(employeeGroupId?: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: bindingsKey(wsId ?? "none", employeeGroupId),
    queryFn: async (): Promise<TemplateBindingRow[]> => {
      const params = new URLSearchParams({ workspace_id: wsId! });
      if (employeeGroupId) params.set("employee_group_id", employeeGroupId);

      const res = await fetch(`/api/contract-template-bindings?${params}`);
      if (!res.ok) throw new Error("Failed to fetch bindings");
      const json = (await res.json()) as { data: TemplateBindingRow[] };
      return json.data;
    },
    enabled: !!wsId,
    staleTime: 2 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Read: workspace + system templates (for binding selector)
// ---------------------------------------------------------------------------

export function useWorkspaceTemplates() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  return useQuery({
    queryKey: workspaceTemplatesKey(wsId ?? "none"),
    queryFn: async (): Promise<WorkspaceTemplate[]> => {
      const { data, error } = await supabase
        .from("contract_template")
        .select("template_id, name, employment_category, is_system, is_active")
        .eq("contract_type", "employee")
        .eq("is_active", true)
        .or(`workspace_id.eq.${wsId},is_system.eq.true`)
        .order("is_system", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as WorkspaceTemplate[];
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutation: create/update binding
// ---------------------------------------------------------------------------

type CreateBindingInput = {
  template_id: string;
  employment_category: string;
  employee_group_id?: string | null;
  priority?: number;
};

export function useCreateTemplateBinding() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateBindingInput) => {
      const res = await fetch("/api/contract-template-bindings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: wsId, ...input }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to create binding");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "template_binding created",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "contract_template_binding", entity_id: _data?.id ?? "" },
          data: {
            template_id: variables.template_id,
            employment_category: variables.employment_category,
            employee_group_id: variables.employee_group_id ?? null,
          },
        },
      });
      void queryClient.invalidateQueries({
        queryKey: bindingsKey(wsId!, variables.employee_group_id ?? undefined),
      });
      toast.success("Mal knyttet til gruppe");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: delete binding
// ---------------------------------------------------------------------------

export function useDeleteTemplateBinding() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, groupId }: { id: string; groupId?: string }) => {
      const res = await fetch(`/api/contract-template-bindings/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to delete binding");
      }
      return { id, groupId };
    },
    onSuccess: (data) => {
      void emit({
        event: "template_binding deleted",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "contract_template_binding", entity_id: data.id },
          data: { template_id: "", employment_category: "", employee_group_id: null },
        },
      });
      void queryClient.invalidateQueries({
        queryKey: bindingsKey(wsId!, data.groupId),
      });
      toast.success("Maltilknytning fjernet");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ---------------------------------------------------------------------------
// Read: all bindings for the workspace (no group filter)
// ---------------------------------------------------------------------------

export function useAllBindings() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;

  return useQuery({
    queryKey: ["template-bindings", wsId ?? "none", "all"] as const,
    queryFn: async (): Promise<TemplateBindingRow[]> => {
      const params = new URLSearchParams({ workspace_id: wsId! });

      const res = await fetch(`/api/contract-template-bindings?${params}`);
      if (!res.ok) throw new Error("Failed to fetch bindings");
      const json = (await res.json()) as { data: TemplateBindingRow[] };
      return json.data;
    },
    enabled: !!wsId,
    staleTime: 2 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Mutation: update binding (is_active, priority, template_id)
// ---------------------------------------------------------------------------

type UpdateBindingInput = {
  id: string;
  is_active?: boolean;
  priority?: number;
  template_id?: string;
};

export function useUpdateTemplateBinding() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fields }: UpdateBindingInput) => {
      const res = await fetch(`/api/contract-template-bindings/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to update binding");
      }
      return (await res.json()) as { data: TemplateBindingRow };
    },
    onSuccess: (result, variables) => {
      void emit({
        event: "template_binding updated",
        workspace_id: (wsId ?? null) ? nonEmpty(wsId ?? null, "workspace_id") : null,
        actor_id: nonEmpty(profileId, "actor_id"),
        properties: {
          entity: { entity_type: "contract_template_binding", entity_id: variables.id },
          data: {
            is_active: variables.is_active,
            priority: variables.priority,
            template_id: variables.template_id,
            employment_category: result.data.employment_category,
            employee_group_id: result.data.employee_group_id,
          },
        },
      });
      void queryClient.invalidateQueries({
        queryKey: ["template-bindings", wsId],
        exact: false,
      });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation: copy system template to workspace
// ---------------------------------------------------------------------------

type CopyTemplateInput = {
  system_template_id: string;
  name: string;
  description?: string;
};

export function useCopySystemTemplate() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CopyTemplateInput) => {
      const res = await fetch("/api/contract-templates/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_id: wsId, ...input }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to copy template");
      }
      return res.json() as Promise<{ template_id: string; name: string }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: workspaceTemplatesKey(wsId!) });
      toast.success("Mal kopiert til arbeidsområdet");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
