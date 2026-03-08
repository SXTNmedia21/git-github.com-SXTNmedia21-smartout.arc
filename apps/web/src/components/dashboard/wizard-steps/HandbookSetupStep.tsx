"use client";

import { useState, useCallback, useContext, useMemo } from "react";
import {
  CheckCircle2,
  Loader2,
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { createClient } from "@smartout/supabase/client";
import type { Json } from "@smartout/supabase";
import { emit } from "@smartout/telemetry";
import { useWorkspace } from "@/lib/workspace-context";
import { DashboardContext } from "@/components/dashboard/DashboardShell";
import { CHAPTERS } from "@/app/dashboard/_components/document-mode/chapters";
import type { ChapterKey } from "@/app/dashboard/_components/document-mode/chapters";

// ─── Types ───────────────────────────────────────────────

type SavedChapter = {
  handbook_chapter_id: string;
  chapter_key: string;
  title: string;
  content: Json;
};

// ─── Toolbar ─────────────────────────────────────────────

function EditorToolbar({
  editor,
  isDark,
}: {
  editor: ReturnType<typeof useEditor>;
  isDark: boolean;
}) {
  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `rounded p-1.5 transition-colors ${
      active
        ? "bg-orange-500/20 text-orange-500"
        : isDark
          ? "text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
    }`;

  return (
    <div
      className={`flex items-center gap-1 border-b px-2 py-1.5 ${
        isDark ? "border-zinc-700" : "border-zinc-200"
      }`}
    >
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btnClass(editor.isActive("bold"))}
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btnClass(editor.isActive("italic"))}
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btnClass(editor.isActive("heading", { level: 2 }))}
      >
        <Heading2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btnClass(editor.isActive("heading", { level: 3 }))}
      >
        <Heading3 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btnClass(editor.isActive("bulletList"))}
      >
        <List className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btnClass(editor.isActive("orderedList"))}
      >
        <ListOrdered className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Inline Chapter Editor ───────────────────────────────

function ChapterEditor({
  chapterKey,
  chapterTitle,
  existingContent,
  isDark,
  onSaved,
  onCancel,
}: {
  chapterKey: ChapterKey;
  chapterTitle: string;
  existingContent: Json | null;
  isDark: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { workspace } = useWorkspace();
  const { profileId } = useContext(DashboardContext);
  const queryClient = useQueryClient();
  const supabase = createClient();

  const editor = useEditor({
    extensions: [StarterKit],
    content: (existingContent as Record<string, unknown>) ?? "",
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none min-h-[120px] p-3 ${
          isDark ? "prose-invert" : ""
        }`,
      },
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editor) throw new Error("Editor not initialized");

      const content = editor.getJSON() as unknown as Json;

      // Select-then-upsert pattern
      const { data: existing } = await supabase
        .from("handbook_chapter")
        .select("handbook_chapter_id")
        .eq("workspace_id", workspace.workspace_id)
        .eq("chapter_key", chapterKey)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("handbook_chapter")
          .update({
            title: chapterTitle,
            content,
            updated_by: profileId,
          })
          .eq("handbook_chapter_id", existing.handbook_chapter_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("handbook_chapter").insert({
          chapter_key: chapterKey,
          title: chapterTitle,
          content,
          workspace_id: workspace.workspace_id,
          updated_by: profileId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`«${chapterTitle}» lagret`);
      void queryClient.invalidateQueries({
        queryKey: ["handbook-chapters", workspace.workspace_id],
      });
      void emit({
        event: "button clicked",
        workspace_id: workspace.workspace_id,
        actor_id: profileId ?? "",
        properties: {
          trackingId: "handbook-chapter-saved",
          context: chapterKey,
        },
      });
      onSaved();
    },
    onError: () => {
      toast.error("Kunne ikke lagre kapitlet");
    },
  });

  return (
    <div
      className={`mt-2 overflow-hidden rounded-xl border ${
        isDark ? "border-zinc-700 bg-zinc-900/80" : "border-zinc-200 bg-white"
      }`}
    >
      <EditorToolbar editor={editor} isDark={isDark} />
      <EditorContent editor={editor} />
      <div
        className={`flex items-center justify-end gap-2 border-t px-3 py-2 ${
          isDark ? "border-zinc-700" : "border-zinc-200"
        }`}
      >
        <button
          type="button"
          onClick={onCancel}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            isDark
              ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
          }`}
        >
          Avbryt
        </button>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            saveMutation.isPending
              ? "cursor-not-allowed opacity-50"
              : "bg-orange-500 text-white hover:bg-orange-600"
          }`}
        >
          {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Lagre
        </button>
      </div>
    </div>
  );
}

// ─── HandbookSetupStep ───────────────────────────────────

export function HandbookSetupStep({ isDark }: { isDark: boolean }) {
  const { workspace } = useWorkspace();
  const supabase = createClient();

  const [editingKey, setEditingKey] = useState<ChapterKey | null>(null);

  // ── Query saved chapters ──
  const { data: savedChapters } = useQuery({
    queryKey: ["handbook-chapters", workspace.workspace_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("handbook_chapter")
        .select("handbook_chapter_id, chapter_key, title, content")
        .eq("workspace_id", workspace.workspace_id);
      if (error) throw error;
      return data as SavedChapter[];
    },
  });

  const savedMap = useMemo(() => {
    const map = new Map<string, SavedChapter>();
    for (const ch of savedChapters ?? []) {
      map.set(ch.chapter_key, ch);
    }
    return map;
  }, [savedChapters]);

  const handleWrite = useCallback((key: ChapterKey) => {
    setEditingKey(key);
  }, []);

  const handleSaved = useCallback(() => {
    setEditingKey(null);
  }, []);

  const handleCancel = useCallback(() => {
    setEditingKey(null);
  }, []);

  const completedCount = savedMap.size;

  return (
    <div className="space-y-6">
      {/* Header summary */}
      <div className="flex items-center justify-between">
        <h3 className={`text-sm font-bold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
          Håndbok-kapitler
        </h3>
        <span className={`text-xs font-medium ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
          {completedCount} av {CHAPTERS.length} fullført
        </span>
      </div>

      {/* Chapter list */}
      <div className="space-y-2">
        {CHAPTERS.map((chapter) => {
          const Icon = chapter.icon;
          const isSaved = savedMap.has(chapter.key);
          const isEditing = editingKey === chapter.key;
          const savedData = savedMap.get(chapter.key);

          return (
            <div key={chapter.key}>
              {/* Chapter row */}
              <div
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                  isDark ? "border-zinc-800 bg-zinc-900/50" : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      isDark ? "bg-zinc-800" : "bg-zinc-100"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${isDark ? "text-zinc-400" : "text-zinc-500"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-semibold ${
                        isDark ? "text-zinc-200" : "text-zinc-800"
                      }`}
                    >
                      {chapter.number}. {chapter.title}
                    </p>
                    <p className={`truncate text-xs ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                      {chapter.description}
                    </p>
                  </div>
                </div>

                {/* Action */}
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  {isSaved ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      <button
                        type="button"
                        onClick={() => handleWrite(chapter.key)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          isDark
                            ? "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                            : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
                        }`}
                      >
                        Rediger
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleWrite(chapter.key)}
                        className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-orange-600"
                      >
                        Skriv
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditing) setEditingKey(null);
                        }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                          isDark
                            ? "text-zinc-500 hover:text-zinc-300"
                            : "text-zinc-400 hover:text-zinc-600"
                        }`}
                      >
                        Hopp over
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Inline editor */}
              {isEditing && (
                <ChapterEditor
                  chapterKey={chapter.key}
                  chapterTitle={chapter.title}
                  existingContent={savedData?.content ?? null}
                  isDark={isDark}
                  onSaved={handleSaved}
                  onCancel={handleCancel}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
