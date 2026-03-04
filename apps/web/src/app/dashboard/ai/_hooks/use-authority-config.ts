"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";

const CAPABILITIES = [
  "knowledge",
  "schedule",
  "training",
  "operations",
  "profile",
  "communication",
  "memory",
  "payroll",
] as const;

type CapabilityName = (typeof CAPABILITIES)[number];
type AuthorityLevel = "autonomous" | "confirm" | "suggest" | "read_only" | "disabled";

type AuthorityConfigMap = Record<CapabilityName, AuthorityLevel>;

const authorityKeys = {
  all: (workspaceId: string) => ["authority-config", workspaceId] as const,
};

/**
 * Fetches authority config for the workspace and merges with defaults.
 * Missing capabilities default to 'read_only'.
 */
export function useAuthorityConfig() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: authorityKeys.all(workspaceId),
    staleTime: 10 * 60 * 1000, // 10 minutes — stable workspace config
    queryFn: async (): Promise<AuthorityConfigMap> => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("engine_authority_config")
        .select("capability, level")
        .eq("workspace_id", workspaceId);

      if (error) throw error;

      // Start with all capabilities at read_only
      const config: AuthorityConfigMap = {} as AuthorityConfigMap;
      for (const cap of CAPABILITIES) {
        config[cap] = "read_only";
      }

      // Override with DB values
      if (data) {
        for (const row of data) {
          const cap = row.capability as CapabilityName;
          if (CAPABILITIES.includes(cap)) {
            config[cap] = row.level as AuthorityLevel;
          }
        }
      }

      return config;
    },
  });
}

/**
 * Upserts a single capability's authority level.
 * Uses ON CONFLICT to insert or update.
 */
export function useUpdateAuthority() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      capability,
      level,
    }: {
      capability: CapabilityName;
      level: AuthorityLevel;
    }) => {
      const supabase = createClient();

      // Get current user id for updated_by
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("engine_authority_config").upsert(
        {
          workspace_id: workspaceId,
          capability,
          level,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,capability" },
      );

      if (error) throw error;
    },
    onMutate: async ({ capability, level }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: authorityKeys.all(workspaceId) });
      const previous = queryClient.getQueryData<AuthorityConfigMap>(authorityKeys.all(workspaceId));

      if (previous) {
        queryClient.setQueryData<AuthorityConfigMap>(authorityKeys.all(workspaceId), {
          ...previous,
          [capability]: level,
        });
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(authorityKeys.all(workspaceId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: authorityKeys.all(workspaceId) });
    },
  });
}

export { CAPABILITIES, type CapabilityName, type AuthorityLevel, type AuthorityConfigMap };
