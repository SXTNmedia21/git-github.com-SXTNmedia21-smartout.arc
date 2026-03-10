"use client";

/**
 * TanStack Query hook for fetching all handbook chapters for the current workspace.
 * Returns chapters in order by chapter_key, matching CHAPTERS definition.
 * Connected to: ChapterReader component
 */

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@smartout/supabase/client";
import { useWorkspace } from "@/lib/workspace-context";

export type HandbookChapter = {
  id: string;
  chapterKey: string;
  title: string;
  content: unknown;
  updatedAt: string;
};

const handbookReaderKeys = {
  chapters: (workspaceId: string) => ["handbook-reader", "chapters", workspaceId] as const,
};

export { handbookReaderKeys };

export function useHandbookChapters() {
  const { workspace } = useWorkspace();
  const workspaceId = workspace.workspace_id;

  return useQuery({
    queryKey: handbookReaderKeys.chapters(workspaceId),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<HandbookChapter[]> => {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("handbook_chapter")
        .select("handbook_chapter_id, chapter_key, title, content, updated_at")
        .eq("workspace_id", workspaceId)
        .order("chapter_key");

      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.handbook_chapter_id,
        chapterKey: row.chapter_key,
        title: row.title,
        content: row.content,
        updatedAt: row.updated_at,
      }));
    },
  });
}
