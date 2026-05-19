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
        // A4-document styling: full-width canvas + generous margins (~24mm),
        // proper paragraph spacing, section dividers via h2 borders.
        // Use child-selector arbitrary classes (Tailwind v4 [&_X]: syntax)
        // because prose plugin's prose-h2:* doesn't apply for arbitrary
        // border/padding utilities reliably.
        class: cn(
          "max-w-none focus:outline-none min-h-[400px]",
          // A4-margin emulation
          "px-12 py-10 bg-white text-zinc-900",
          // Body text + paragraph spacing
          "[&_p]:my-3 [&_p]:leading-relaxed [&_p]:text-[15px]",
          "[&_strong]:font-semibold [&_strong]:text-zinc-900",
          // Title (h1) — centered, large, generous bottom margin
          "[&_h1]:text-3xl [&_h1]:font-bold [&_h1]:text-center [&_h1]:tracking-tight [&_h1]:mb-8 [&_h1]:mt-0",
          // Section heading (h2) — bordered separator, indented numbering feel
          "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:pb-2",
          "[&_h2]:border-b [&_h2]:border-zinc-200",
          // Section block — reset top margin so border-b on h2 sits at top of section
          "[&_section]:mb-6 [&_section]:scroll-mt-8",
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
