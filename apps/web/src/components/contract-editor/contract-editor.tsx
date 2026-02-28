"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TiptapPlaceholder from "@tiptap/extension-placeholder";
import { useState, useCallback, useRef, useEffect } from "react";
import { ArrowLeft, Save, Eye } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EditorToolbar } from "./toolbar";
import { AiChatPanel } from "./ai-chat-panel";
import { DiffOverlay } from "./diff-overlay";

import {
  ClauseBlock,
  PlaceholderField,
  SignatureField,
  SectionSummary,
  DateField,
  HighlightSection,
} from "./extensions";

/**
 * EditorAction — Describes a change proposed by the AI agent.
 * Matches the schema used in @smartout/ai contract tools.
 */
export type EditorAction = {
  type: string;
  target?: string;
  content?: string;
  data?: Record<string, unknown>;
};

/**
 * DiffProposal — A pending change awaiting user acceptance.
 */
export type DiffProposal = {
  id: string;
  action: EditorAction;
  description: string;
  status: "pending" | "accepted" | "rejected";
};

type ContractEditorProps = {
  templateId: string;
  templateName: string;
  initialContent: string;
  onSave?: (html: string) => Promise<void>;
};

export function ContractEditor({
  templateId,
  templateName,
  initialContent,
  onSave,
}: ContractEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDiffs, setPendingDiffs] = useState<DiffProposal[]>([]);
  const editorContentRef = useRef<string>(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TiptapPlaceholder.configure({
        placeholder: "Start typing your contract template...",
      }),
      ClauseBlock,
      PlaceholderField,
      SignatureField,
      SectionSummary,
      DateField,
      HighlightSection,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none focus:outline-none min-h-[500px] px-6 py-4",
      },
    },
    onUpdate: ({ editor: ed }) => {
      editorContentRef.current = ed.getHTML();
    },
  });

  const handleSave = useCallback(async () => {
    if (!onSave || !editor) return;
    setIsSaving(true);
    try {
      await onSave(editor.getHTML());
    } finally {
      setIsSaving(false);
    }
  }, [editor, onSave]);

  const handleApplyAction = useCallback(
    (action: EditorAction) => {
      if (!editor) return;

      switch (action.type) {
        case "insert_section": {
          const attrs = {
            clauseId: (action.data?.clauseId as string) || crypto.randomUUID(),
            title: (action.data?.title as string) || "New Section",
            category: (action.data?.category as string) || "general",
          };
          editor
            .chain()
            .focus()
            .insertContent({
              type: "clauseBlock",
              attrs,
              content: [
                {
                  type: "paragraph",
                  content: action.content ? [{ type: "text", text: action.content }] : [],
                },
              ],
            })
            .run();
          break;
        }

        case "replace_section": {
          // Replace content of a specific clause block by clauseId
          if (!action.target || !action.content) break;
          const { state } = editor;
          let found = false;
          state.doc.descendants((node, pos) => {
            if (found) return false;
            if (node.type.name === "clauseBlock" && node.attrs.clauseId === action.target) {
              // Replace the inner content of the clause block
              const from = pos + 1; // inside the clause block
              const to = pos + node.nodeSize - 1;
              editor.chain().focus().insertContentAt({ from, to }, action.content!).run();
              found = true;
              return false;
            }
            return true;
          });
          break;
        }

        case "remove_section": {
          if (!action.target) break;
          const { state: removeState } = editor;
          removeState.doc.descendants((node, pos) => {
            if (node.type.name === "clauseBlock" && node.attrs.clauseId === action.target) {
              editor
                .chain()
                .focus()
                .deleteRange({ from: pos, to: pos + node.nodeSize })
                .run();
              return false;
            }
            return true;
          });
          break;
        }

        case "add_placeholder": {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "placeholderField",
              attrs: {
                key: (action.data?.key as string) || "placeholder",
                label: (action.data?.label as string) || "Placeholder",
                placeholderType: (action.data?.placeholderType as string) || "manual",
              },
            })
            .run();
          break;
        }

        case "add_signature_field": {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "signatureField",
              attrs: {
                role: (action.data?.role as string) || "recipient",
                label: (action.data?.label as string) || "Signatur",
                required: action.data?.required !== false,
              },
            })
            .run();
          break;
        }

        case "add_date_field": {
          editor
            .chain()
            .focus()
            .insertContent({
              type: "dateField",
              attrs: {
                key: (action.data?.key as string) || "date",
                label: (action.data?.label as string) || "Dato",
              },
            })
            .run();
          break;
        }

        case "highlight_text": {
          if (action.data?.color) {
            editor
              .chain()
              .focus()
              .setMark("highlightSection", {
                color: action.data.color as string,
                note: (action.data?.note as string) || null,
              })
              .run();
          }
          break;
        }

        default:
          console.warn(`Unknown editor action type: ${action.type}`);
      }
    },
    [editor],
  );

  const handleAiActions = useCallback((actions: EditorAction[]) => {
    const newDiffs: DiffProposal[] = actions.map((action) => ({
      id: crypto.randomUUID(),
      action,
      description: `${action.type}: ${action.target || action.data?.title || "document"}`,
      status: "pending" as const,
    }));
    setPendingDiffs((prev) => [...prev, ...newDiffs]);
  }, []);

  const handleAcceptDiff = useCallback(
    (diffId: string) => {
      const diff = pendingDiffs.find((d) => d.id === diffId);
      if (!diff) return;

      handleApplyAction(diff.action);
      setPendingDiffs((prev) =>
        prev.map((d) => (d.id === diffId ? { ...d, status: "accepted" as const } : d)),
      );
    },
    [pendingDiffs, handleApplyAction],
  );

  const handleRejectDiff = useCallback((diffId: string) => {
    setPendingDiffs((prev) =>
      prev.map((d) => (d.id === diffId ? { ...d, status: "rejected" as const } : d)),
    );
  }, []);

  const handleAcceptAll = useCallback(() => {
    pendingDiffs.filter((d) => d.status === "pending").forEach((d) => handleApplyAction(d.action));
    setPendingDiffs((prev) =>
      prev.map((d) => (d.status === "pending" ? { ...d, status: "accepted" as const } : d)),
    );
  }, [pendingDiffs, handleApplyAction]);

  const handleRejectAll = useCallback(() => {
    setPendingDiffs((prev) =>
      prev.map((d) => (d.status === "pending" ? { ...d, status: "rejected" as const } : d)),
    );
  }, []);

  const handleDismissDiffs = useCallback(() => {
    setPendingDiffs((prev) => prev.filter((d) => d.status === "pending"));
  }, []);

  // Get current editor content as JSON for the AI to read
  const getEditorState = useCallback(() => {
    if (!editor) return null;
    return {
      html: editor.getHTML(),
      json: editor.getJSON(),
      text: editor.getText(),
    };
  }, [editor]);

  // Keep ref in sync
  useEffect(() => {
    if (editor) {
      editorContentRef.current = editor.getHTML();
    }
  }, [editor]);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="border-border bg-background flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
          <Link
            href="/platform-admin/contracts"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-sm font-semibold">{templateName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Eye className="mr-1 h-3.5 w-3.5" />
            Forhandsvis
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="mr-1 h-3.5 w-3.5" />
            {isSaving ? "Lagrer..." : "Lagre"}
          </Button>
        </div>
      </div>

      {/* Main content area: Editor (70%) + AI Panel (30%) */}
      <div className="flex min-h-0 flex-1">
        {/* Editor side */}
        <div className="flex w-[70%] flex-col">
          <EditorToolbar editor={editor} />

          <div className="relative flex-1 overflow-y-auto">
            <EditorContent editor={editor} />

            {/* Diff overlay for pending changes */}
            {pendingDiffs.some((d) => d.status === "pending") && (
              <DiffOverlay
                diffs={pendingDiffs.filter((d) => d.status === "pending")}
                onAccept={handleAcceptDiff}
                onReject={handleRejectDiff}
                onAcceptAll={handleAcceptAll}
                onRejectAll={handleRejectAll}
                onDismiss={handleDismissDiffs}
              />
            )}
          </div>
        </div>

        {/* AI Chat Panel side */}
        <div className="border-border w-[30%] border-l">
          <AiChatPanel
            templateId={templateId}
            getEditorState={getEditorState}
            onApplyActions={handleAiActions}
          />
        </div>
      </div>
    </div>
  );
}
