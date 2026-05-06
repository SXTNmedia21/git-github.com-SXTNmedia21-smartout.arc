"use client";

/**
 * ContractPreviewEditor — lightweight Tiptap-based document preview/edit for the send-drawer.
 *
 * Renders the template HTML with placeholders resolved to actual values.
 * Admin can read and edit the document before sending. Returns the final
 * HTML via onContentChange so the send-drawer can pass it to the API.
 *
 * Reuses the same Tiptap extensions and toolbar as the platform-admin template editor
 * but without sidebar, metadata bar, or save logic.
 */

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef } from "react";

import { EditorToolbarV2 } from "@/components/contract-editor/editor-toolbar-v2";
import {
  ClauseBlock,
  PlaceholderField,
  SignatureField,
  SectionSummary,
  DateField,
  HighlightSection,
} from "@/components/contract-editor/extensions";
import { cn } from "@/lib/utils";

type ContractPreviewEditorProps = {
  /** Template HTML with {{placeholders}} already replaced with resolved values */
  contentHtml: string;
  /** Called on every edit with the current HTML */
  onContentChange: (html: string) => void;
  /** "preview" (default) = read-only toolbar; "edit" = full toolbar + editable body */
  mode?: "preview" | "edit";
};

export function ContractPreviewEditor({
  contentHtml,
  onContentChange,
  mode = "preview",
}: ContractPreviewEditorProps) {
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      ClauseBlock,
      PlaceholderField,
      SignatureField,
      SectionSummary,
      DateField,
      HighlightSection,
    ],
    content: contentHtml,
    editable: mode !== "preview",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        // A4-document styling: full-width canvas + generous margins (24mm/96px),
        // proper paragraph spacing, section dividers via h2 borders.
        // prose prose-base = 16px text, ~1.75 line-height — matches typical contract.
        class: cn(
          "prose prose-base dark:prose-invert max-w-none focus:outline-none min-h-[400px]",
          // A4-margin emulation for live preview (DocuSeal applies its own at print).
          "px-12 py-10",
          // Whitespace + readability tuning
          "prose-h1:mb-6 prose-h1:mt-0 prose-h1:text-3xl prose-h1:font-semibold prose-h1:tracking-tight prose-h1:text-center",
          "prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-lg prose-h2:font-semibold prose-h2:border-b prose-h2:border-border prose-h2:pb-2",
          "prose-p:my-3 prose-p:leading-relaxed",
          "prose-strong:font-semibold",
          "prose-section:mb-6",
          // Background = paper-white (A4 look)
          "bg-white text-foreground",
          mode === "preview" && "cursor-default select-text caret-transparent",
        ),
      },
    },
    onUpdate:
      mode === "preview"
        ? undefined
        : ({ editor: ed }) => {
            onContentChangeRef.current(ed.getHTML());
          },
  });

  useEffect(() => {
    editor?.setEditable(mode !== "preview");
  }, [editor, mode]);

  // Sync content if the parent provides new HTML (e.g. going back and returning)
  useEffect(() => {
    if (editor && contentHtml && editor.getHTML() !== contentHtml) {
      editor.commands.setContent(contentHtml);
    }
  }, [editor, contentHtml]);

  return (
    <div className="border-border bg-muted/40 flex h-full flex-col overflow-hidden rounded-lg border">
      <EditorToolbarV2 editor={editor} mode={mode === "edit" ? "full" : "preview"} />
      {/* Document-area: scrollable A4 canvas (max-w-3xl ≈ 768px = ~A4 width). */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl shadow-sm">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
