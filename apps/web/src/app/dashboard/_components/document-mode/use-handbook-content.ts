"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { emit } from "@smartout/telemetry";
import { useContext } from "react";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import type { ChapterKey } from "./chapters";
import type { JSONContent } from "@tiptap/core";

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

/**
 * handbook_chapter is not yet in database.types.ts (migration pending).
 * We use raw rpc-style queries via `.from()` with a type assertion until
 * types are regenerated after migration.
 */
export function useHandbookContent(chapterKey: ChapterKey) {
  const { workspaceData } = useContext(DashboardContext);
  const workspaceId = workspaceData?.workspace_id ?? "";

  return useQuery({
    queryKey: handbookKeys.chapter(workspaceId, chapterKey),
    queryFn: async (): Promise<HandbookRow | null> => {
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
      const { data, error } = (await (supabase as any)
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
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not yet in generated types
      const { error } = await (supabase as any).from("handbook_chapter").upsert(
        {
          workspace_id: workspaceId,
          chapter_key: chapterKey,
          title,
          content: content as Record<string, unknown>,
        },
        { onConflict: "workspace_id,chapter_key" },
      );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      void emit({
        event: "handbook chapter_saved",
        workspace_id: workspaceId,
        actor_id: "",
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
