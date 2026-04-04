"use client";

import { useContext } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { websiteKeys } from "./website-keys";
import {
  createSection,
  deleteSection,
  updateSectionContent,
  reorderSections,
  updateSectionSettings,
} from "../_actions/section-actions";
import type { SectionRow } from "../_actions/section-actions";
import { toast } from "sonner";

export type { SectionRow };

/**
 * Fetches all sections for a page and exposes full CRUD + content + settings mutations.
 * Sections are ordered by sort_order ascending.
 */
export function useSections(websiteId: string | null, pageId: string | null) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const { profileId } = useContext(DashboardContext);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: websiteKeys.sections(pageId ?? "none"),
    queryFn: async (): Promise<SectionRow[]> => {
      const { data, error } = await supabase
        .schema("websites" as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- SAFETY: websites is a valid Postgres schema not in Supabase generated types
        .from("website_section")
        .select(
          "website_section_id, website_page_id, section_type, content, settings, is_visible, sort_order",
        )
        .eq("website_page_id", pageId!)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as SectionRow[];
    },
    enabled: !!pageId,
    staleTime: 2 * 60 * 1000, // 2 minutes — sections change more often than pages
  });

  const create = useMutation({
    mutationFn: async (sectionType: string) => {
      if (!websiteId || !pageId) throw new Error("No website or page selected");
      return createSection(websiteId, pageId, sectionType);
    },
    onSuccess: (data) => {
      void emit({
        event: "website section created",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "website_section" as const, entity_id: data.website_section_id },
          data: { section_type: data.section_type },
        },
      });
      queryClient.invalidateQueries({ queryKey: websiteKeys.sections(pageId ?? "none") });
      toast.success("Seksjon lagt til");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke legge til seksjon: ${error.message}`);
    },
  });

  const remove = useMutation({
    mutationFn: async (sectionId: string) => {
      if (!websiteId) throw new Error("No website selected");
      const result = await deleteSection(websiteId, sectionId);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: websiteKeys.sections(pageId ?? "none") });
      toast.success("Seksjon fjernet");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke fjerne seksjon: ${error.message}`);
    },
  });

  const updateContent = useMutation({
    mutationFn: async ({
      sectionId,
      content,
      source = "manual",
    }: {
      sectionId: string;
      content: Record<string, unknown>;
      source?: "manual" | "autosave";
    }) => {
      if (!websiteId) throw new Error("No website selected");
      const result = await updateSectionContent(websiteId, sectionId, content, source);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: (_data, { source }) => {
      queryClient.invalidateQueries({ queryKey: websiteKeys.sections(pageId ?? "none") });
      if (source !== "autosave") {
        toast.success("Innhold lagret");
      }
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke lagre innhold: ${error.message}`);
    },
  });

  const reorder = useMutation({
    mutationFn: async (orderedSectionIds: string[]) => {
      if (!websiteId || !pageId) throw new Error("No website or page selected");
      const result = await reorderSections(websiteId, pageId, orderedSectionIds);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: (_data, orderedSectionIds) => {
      void emit({
        event: "website sections reordered",
        workspace_id: wsId ?? null,
        actor_id: profileId ?? "",
        properties: {
          entity: { entity_type: "website_page" as const, entity_id: pageId ?? "" },
          data: { section_count: orderedSectionIds.length },
        },
      });
      queryClient.invalidateQueries({ queryKey: websiteKeys.sections(pageId ?? "none") });
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke sortere seksjoner: ${error.message}`);
    },
  });

  const updateSettings = useMutation({
    mutationFn: async ({
      sectionId,
      settings,
    }: {
      sectionId: string;
      settings: Record<string, unknown>;
    }) => {
      if (!websiteId) throw new Error("No website selected");
      const result = await updateSectionSettings(websiteId, sectionId, settings);
      if (!result.success) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: websiteKeys.sections(pageId ?? "none") });
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke oppdatere innstillinger: ${error.message}`);
    },
  });

  return {
    sections: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create,
    remove,
    updateContent,
    reorder,
    updateSettings,
  };
}
