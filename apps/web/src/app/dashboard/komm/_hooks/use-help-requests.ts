"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";
import { emit } from "@smartout/telemetry";
import { toast } from "sonner";

export type HelpRequest = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  resolver_name?: string | null;
};

export function useHelpRequests() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: ["help-requests", workspaceId],
    staleTime: 30_000,
    queryFn: async (): Promise<HelpRequest[]> => {
      const supabase = createClient();
      // help_request table added in 20260422300600 — not yet in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("help_request")
        .select("id, title, description, status, resolved_by, resolved_at, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as HelpRequest[];
    },
  });
}

export function useCreateHelpRequest(profileId: string) {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useMutation({
    mutationFn: async ({ title, description }: { title: string; description?: string }) => {
      const supabase = createClient();
      // help_request table added in 20260422300600 — not yet in generated types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("help_request")
        .insert({
          workspace_id: workspaceId,
          profile_id: profileId,
          title,
          description: description ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: (data) => {
      void emit({
        event: "help_request.created",
        workspace_id: workspaceId,
        actor_id: profileId,
        properties: { title: "" },
        entity: { entity_type: "help_request", entity_id: data.id },
      });
      toast.success("Henvendelse opprettet");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["help-requests", workspaceId] });
    },
    onError: () => {
      toast.error("Kunne ikke opprette henvendelse");
    },
  });
}
