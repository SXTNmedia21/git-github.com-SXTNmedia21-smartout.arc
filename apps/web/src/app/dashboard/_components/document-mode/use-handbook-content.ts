"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit, nonEmpty } from "@smartout/telemetry";
import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { ChapterKey } from "./chapters";
import type { JSONContent } from "@tiptap/core";
import type { Json } from "@smartout/supabase";
import { upsertHandbookChapterAction } from "@/app/dashboard/governance/_actions/update-handbook-chapter-action";

const handbookKeys = {
  all: (wsId: string) => ["handbook", wsId] as const,
  chapter: (wsId: string, key: ChapterKey) => ["handbook", wsId, key] as const,
};

type HandbookRow = {
  handbook_chapter_id: string;
  workspace_id: string;
  chapter_key: string;
  title: string;
  content: unknown;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export function useHandbookContent(chapterKey: ChapterKey) {
  const { workspaceData } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? "";

  return useQuery({
    queryKey: handbookKeys.chapter(workspaceId, chapterKey),
    queryFn: async (): Promise<HandbookRow | null> => {
      const supabase = createClient();
      const { data, error } = (await supabase
        .from("handbook_chapter")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("chapter_key", chapterKey)
        .maybeSingle()) as { data: HandbookRow | null; error: Error | null };

      if (error) throw error;
      return data;
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
}

export function useHandbookSave() {
  const { workspaceData } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? "";
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      chapterKey,
      content,
      title,
    }: {
      chapterKey: ChapterKey;
      content: JSONContent;
      title: string;
    }) => {
      // Resolve existing chapter_id (if any) so the Server Action branches
      // update vs create deterministically. Server Action handles gateAction.
      const supabase = createClient();
      const { data: existing } = await supabase
        .from("handbook_chapter")
        .select("handbook_chapter_id")
        .eq("workspace_id", workspaceId)
        .eq("chapter_key", chapterKey)
        .maybeSingle();

      const result = await upsertHandbookChapterAction({
        chapter_id: existing?.handbook_chapter_id ?? null,
        chapter_key: chapterKey,
        title,
        content: content as unknown as Json,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }
    },
    onSuccess: (_data, vars) => {
      void emit({
        event: "handbook chapter_saved",
        workspace_id: nonEmpty(workspaceId, "workspace_id"),
        actor_id: nonEmpty("", "actor_id"),
        properties: {
          data: { chapter_key: vars.chapterKey },
        },
      });
      void queryClient.invalidateQueries({
        queryKey: handbookKeys.chapter(workspaceId, vars.chapterKey),
      });
    },
  });
}
