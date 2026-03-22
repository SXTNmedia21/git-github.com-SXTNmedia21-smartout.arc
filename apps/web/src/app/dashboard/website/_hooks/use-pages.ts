"use client";

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { websiteKeys } from "./website-keys";
import {
  createPage,
  deletePage,
  reorderPages,
  togglePageVisibility,
} from "../_actions/page-actions";
import type { PageRow } from "../_actions/page-actions";
import { toast } from "sonner";

export type { PageRow };

/**
 * Fetches all pages for a website and exposes CRUD mutations.
 * Pages are ordered by sort_order ascending.
 */
export function usePages(websiteId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: websiteKeys.pages(websiteId ?? "none"),
    queryFn: async (): Promise<PageRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .schema("websites")
        .from("website_page")
        .select("website_page_id, title, slug, page_type, sort_order, is_visible")
        .eq("website_id", websiteId!)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as PageRow[];
    },
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });

  const create = useMutation({
    mutationFn: async ({
      title,
      pageType,
      slug,
    }: {
      title: string;
      pageType: string;
      slug: string;
    }) => {
      if (!websiteId) throw new Error("No website selected");
      return createPage(websiteId, title, pageType, slug);
    },
    onSuccess: (data) => {
      void emit({
        event: "website page created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "website_page", entity_id: data.website_page_id },
          data: { title: data.title, page_type: data.page_type },
        },
      });
      queryClient.invalidateQueries({ queryKey: websiteKeys.pages(websiteId ?? "none") });
      toast.success("Side opprettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke opprette side: ${error.message}`);
    },
  });

  const remove = useMutation({
    mutationFn: async (pageId: string) => {
      if (!websiteId) throw new Error("No website selected");
      const result = await deletePage(websiteId, pageId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: websiteKeys.pages(websiteId ?? "none") });
      toast.success("Side slettet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke slette side: ${error.message}`);
    },
  });

  const reorder = useMutation({
    mutationFn: async (orderedPageIds: string[]) => {
      if (!websiteId) throw new Error("No website selected");
      const result = await reorderPages(websiteId, orderedPageIds);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: (_data, orderedPageIds) => {
      void emit({
        event: "website pages reordered",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "website_page", entity_id: websiteId ?? "" },
          data: { page_count: orderedPageIds.length },
        },
      });
      queryClient.invalidateQueries({ queryKey: websiteKeys.pages(websiteId ?? "none") });
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke sortere sider: ${error.message}`);
    },
  });

  const toggleVisibility = useMutation({
    mutationFn: async ({ pageId, isVisible }: { pageId: string; isVisible: boolean }) => {
      if (!websiteId) throw new Error("No website selected");
      const result = await togglePageVisibility(websiteId, pageId, isVisible);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: websiteKeys.pages(websiteId ?? "none") });
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke endre synlighet: ${error.message}`);
    },
  });

  return {
    pages: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create,
    remove,
    reorder,
    toggleVisibility,
  };
}
