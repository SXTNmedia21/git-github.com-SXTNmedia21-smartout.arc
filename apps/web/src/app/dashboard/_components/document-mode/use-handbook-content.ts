"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceOptional } from "@/lib/workspace-context";
import { createClient } from "@smartout/supabase/client";
import type { JSONContent } from "@tiptap/react";
import type { Editor } from "@tiptap/react";

const handbookKeys = {
  chapter: (workspaceId: string, chapterKey: string) =>
    ["handbook-chapter", workspaceId, chapterKey] as const,
};

type HandbookChapterRow = {
  handbook_chapter_id: string;
  workspace_id: string;
  chapter_key: string;
  title: string;
  content: JSONContent;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export function useHandbookChapter(chapterKey: string) {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();

  const query = useQuery({
    queryKey: handbookKeys.chapter(wsId ?? "none", chapterKey),
    queryFn: async (): Promise<HandbookChapterRow | null> => {
      // TODO: Remove cast once migration is applied and types regenerated
      const { data, error } = await (
        supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }
      )
        .from("handbook_chapter")
        .select("*")
        .eq("workspace_id", wsId!)
        .eq("chapter_key", chapterKey)
        .maybeSingle();

      if (error) throw error;
      return data as HandbookChapterRow | null;
    },
    enabled: !!wsId && !!chapterKey,
    staleTime: 5 * 60 * 1000,
  });

  return {
    content: (query.data?.content as JSONContent) ?? null,
    isLoading: query.isLoading,
    updatedAt: query.data?.updated_at ?? null,
  };
}

export function useSaveHandbookChapter() {
  const ctx = useWorkspaceOptional();
  const wsId = ctx?.workspace.workspace_id;
  const supabase = createClient();
  const queryClient = useQueryClient();
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const mutation = useMutation({
    mutationFn: async ({
      chapterKey,
      title,
      content,
    }: {
      chapterKey: string;
      title: string;
      content: JSONContent;
    }) => {
      // TODO: Remove cast once migration is applied and types regenerated
      const { error } = await (
        supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }
      )
        .from("handbook_chapter")
        .upsert(
          {
            workspace_id: wsId!,
            chapter_key: chapterKey,
            title,
            content,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,chapter_key" },
        );

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      setLastSaved(new Date());
      queryClient.invalidateQueries({
        queryKey: handbookKeys.chapter(wsId!, variables.chapterKey),
      });
    },
  });

  return {
    save: mutation.mutate,
    isSaving: mutation.isPending,
    lastSaved,
  };
}

const AUTO_SAVE_DELAY = 2000;

export function useAutoSave(editor: Editor | null, chapterKey: string, title: string) {
  const { save, isSaving, lastSaved } = useSaveHandbookChapter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const scheduleSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      if (!editor) return;
      const content = editor.getJSON();
      saveRef.current({ chapterKey, title, content });
    }, AUTO_SAVE_DELAY);
  }, [editor, chapterKey, title]);

  useEffect(() => {
    if (!editor) return;

    editor.on("update", scheduleSave);
    return () => {
      editor.off("update", scheduleSave);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [editor, scheduleSave]);

  return { isSaving, lastSaved };
}
