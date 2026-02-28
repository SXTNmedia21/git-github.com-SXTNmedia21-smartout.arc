"use client";

import { useMemo } from "react";
import type { Editor } from "@tiptap/react";
import { Check, Loader2, AlertCircle } from "lucide-react";

type StatusBarProps = {
  editor: Editor | null;
  lastSavedAt: Date | null;
  isSaving: boolean;
  isDirty: boolean;
  attachmentCount: number;
};

export function StatusBar({
  editor,
  lastSavedAt,
  isSaving,
  isDirty,
  attachmentCount,
}: StatusBarProps) {
  const stats = useMemo(() => {
    if (!editor) return { sections: 0, placeholders: 0, signatures: 0 };

    let sections = 0;
    let placeholders = 0;
    let signatures = 0;

    editor.state.doc.descendants((node) => {
      if (node.type.name === "clauseBlock") sections++;
      if (node.type.name === "placeholderField") placeholders++;
      if (node.type.name === "signatureField") signatures++;
    });

    return { sections, placeholders, signatures };
  }, [editor, editor?.state.doc]);

  const saveStatus = isSaving ? (
    <span className="flex items-center gap-1 text-yellow-500">
      <Loader2 className="h-3 w-3 animate-spin" />
      Lagrer...
    </span>
  ) : isDirty ? (
    <span className="flex items-center gap-1 text-yellow-500">
      <AlertCircle className="h-3 w-3" />
      Ulagrede endringer
    </span>
  ) : lastSavedAt ? (
    <span className="flex items-center gap-1 text-green-500">
      <Check className="h-3 w-3" />
      Lagret {lastSavedAt.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}
    </span>
  ) : null;

  return (
    <div className="border-border bg-muted/30 flex items-center justify-between border-t px-4 py-1.5 text-[11px]">
      <div className="flex items-center gap-1">{saveStatus}</div>
      <div className="text-muted-foreground flex items-center gap-3">
        <span>{stats.sections} seksjoner</span>
        <span>{stats.placeholders} plassholdere</span>
        <span>{stats.signatures} signaturfelt</span>
        {attachmentCount > 0 && <span>{attachmentCount} vedlegg</span>}
      </div>
    </div>
  );
}
