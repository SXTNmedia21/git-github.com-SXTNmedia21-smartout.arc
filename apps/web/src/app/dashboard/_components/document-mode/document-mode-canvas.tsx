"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import TiptapPlaceholder from "@tiptap/extension-placeholder";
import { CHAPTERS } from "./chapters";
import { useDocumentMode } from "./document-mode-context";
import { useHandbookContent } from "./use-handbook-content";
import { DocumentModeToolbar } from "./document-mode-toolbar";
import type { JSONContent } from "@tiptap/core";

// UI Events:
// - action: editor.onUpdate() (marks chapter dirty)
// - action: editor.setContent() (loads saved or template content)

export function DocumentModeCanvas({ isDark }: { isDark: boolean }) {
  const { activeChapterKey, setIsDirty, editorRef } = useDocumentMode();
  const chapter = CHAPTERS.find((c) => c.key === activeChapterKey)!;
  const { data, isLoading } = useHandbookContent(activeChapterKey);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Highlight,
      Link.configure({ openOnClick: false }),
      TiptapPlaceholder.configure({
        placeholder: `Begynn a skrive innhold for "${chapter.title}"...`,
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "document-mode-editor focus:outline-none min-h-[60vh] px-1 py-4",
      },
    },
    onUpdate: () => {
      setIsDirty(true);
    },
  });

  // Keep editor ref in sync for panel access
  useEffect(() => {
    editorRef.current = editor ?? null;
    return () => {
      editorRef.current = null;
    };
  }, [editor, editorRef]);

  // Load content when chapter changes or data arrives
  useEffect(() => {
    if (!editor || isLoading) return;
    const content = data?.content as JSONContent | undefined;
    if (content && Object.keys(content).length > 0) {
      editor.commands.setContent(content);
    } else {
      editor.commands.clearContent();
    }
    setIsDirty(false);
  }, [editor, data, isLoading, activeChapterKey, setIsDirty]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DocumentModeToolbar editor={editor} isDark={isDark} />
      <div className="scroll-overlay flex-1 px-8 py-6 md:px-16">
        {isLoading ? (
          <div className="space-y-3 pt-8">
            <div className="sk-bone h-8 w-64 rounded" />
            <div className="sk-bone h-4 w-full rounded" />
            <div className="sk-bone h-4 w-3/4 rounded" />
          </div>
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  );
}
