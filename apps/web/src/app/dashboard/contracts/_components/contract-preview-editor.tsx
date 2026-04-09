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

type ContractPreviewEditorProps = {
  /** Template HTML with {{placeholders}} already replaced with resolved values */
  contentHtml: string;
  /** Called on every edit with the current HTML */
  onContentChange: (html: string) => void;
};

export function ContractPreviewEditor({
  contentHtml,
  onContentChange,
}: ContractPreviewEditorProps) {
  const onContentChangeRef = useRef(onContentChange);
  onContentChangeRef.current = onContentChange;

  const editor = useEditor({
    immediatelyRender: false,
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
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[400px] px-5 py-4 dark:prose-invert",
      },
    },
    onUpdate: ({ editor: ed }) => {
      onContentChangeRef.current(ed.getHTML());
    },
  });

  // Sync content if the parent provides new HTML (e.g. going back and returning)
  useEffect(() => {
    if (editor && contentHtml && editor.getHTML() !== contentHtml) {
      editor.commands.setContent(contentHtml);
    }
  }, [editor, contentHtml]);

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <EditorToolbarV2 editor={editor} mode="preview" />
      <div className="max-h-[50vh] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
