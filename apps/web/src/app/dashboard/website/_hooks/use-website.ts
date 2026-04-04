"use client";

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { websiteKeys } from "./website-keys";
import { updateWebsite } from "../_actions/website-actions";
import type { WebsiteRow } from "../_actions/website-actions";
import { toast } from "sonner";

export type { WebsiteRow };

type UpdateWebsiteInput = Parameters<typeof updateWebsite>[1];

/**
 * Fetches the website for the current workspace via the websites schema.
 * Returns null when the workspace has no website yet (PGRST116 — zero rows).
 * Also exposes an updateWebsite mutation for editing settings.
 */
export function useWebsite() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: websiteKeys.website(wsId ?? "none"),
    queryFn: async (): Promise<WebsiteRow | null> => {
      const { data, error } = await supabase
        .schema("websites" as "public") // SAFETY: websites is a valid Postgres schema not represented as "public" in Supabase client types
        .from("website")
        .select(
          "website_id, name, site_slug, tagline, template_key, template_version, theme, visibility, booking_provider, booking_url, social_links, contact_email, contact_phone, contact_address, created_at, updated_at",
        )
        .eq("workspace_id", wsId!)
        .is("deleted_at", null)
        .single();

      if (error?.code === "PGRST116") return null; // Workspace has no website yet
      if (error) throw new Error(error.message);
      return data as WebsiteRow;
    },
    enabled: !!wsId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const update = useMutation({
    mutationFn: async ({
      websiteId,
      updates,
    }: {
      websiteId: string;
      updates: UpdateWebsiteInput;
    }) => {
      const result = await updateWebsite(websiteId, updates);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: (_data, variables) => {
      void emit({
        event: "website updated",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "website", entity_id: variables.websiteId },
          data: {},
        },
      });
      queryClient.invalidateQueries({ queryKey: websiteKeys.website(wsId ?? "none") });
      toast.success("Nettside oppdatert");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere nettside: ${error.message}`);
    },
  });

  return {
    website: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    hasWebsite: !!query.data,
    update,
  };
}
