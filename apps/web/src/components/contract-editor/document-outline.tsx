"use client";

import { useMemo } from "react";
import type { Editor } from "@tiptap/react";
import { FileText, Pen } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type OutlineItem = {
  id: string;
  title: string;
  category: string;
  pos: number;
};

type DocumentOutlineProps = {
  editor: Editor | null;
};

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-neutral-500/20 text-neutral-400",
  parties: "bg-blue-500/20 text-blue-400",
  pricing: "bg-green-500/20 text-green-400",
  deliverables: "bg-purple-500/20 text-purple-400",
  timeline: "bg-orange-500/20 text-orange-400",
  legal: "bg-red-500/20 text-red-400",
  support: "bg-cyan-500/20 text-cyan-400",
  requirements: "bg-yellow-500/20 text-yellow-400",
  signatures: "bg-pink-500/20 text-pink-400",
  special: "bg-indigo-500/20 text-indigo-400",
};

export function DocumentOutline({ editor }: DocumentOutlineProps) {
  const sections = useMemo(() => {
    if (!editor) return [];

    const items: OutlineItem[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "clauseBlock") {
        items.push({
          id: (node.attrs.clauseId as string) || String(pos),
          title: (node.attrs.title as string) || "Uten tittel",
          category: (node.attrs.category as string) || "general",
          pos,
        });
      }
    });
    return items;
  }, [editor, editor?.state.doc]);

  function scrollToSection(pos: number) {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .setTextSelection(pos + 1)
      .run();

    // Scroll the editor view to the node
    const domNode = editor.view.nodeDOM(pos);
    if (domNode instanceof HTMLElement) {
      domNode.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Count signature fields and placeholder fields
  const signatureCount = useMemo(() => {
    if (!editor) return 0;
    let count = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "signatureField") count++;
    });
    return count;
  }, [editor, editor?.state.doc]);

  const placeholderCount = useMemo(() => {
    if (!editor) return 0;
    let count = 0;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "placeholderField") count++;
    });
    return count;
  }, [editor, editor?.state.doc]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-border border-b px-4 py-3">
        <h3 className="text-sm font-semibold">Oversikt</h3>
        <p className="text-muted-foreground mt-0.5 text-xs">Dokumentstruktur og navigasjon</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-4">
          {/* Stats */}
          <div className="text-muted-foreground mb-3 flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" /> {sections.length} seksjoner
            </span>
            <span className="flex items-center gap-1">
              <Pen className="h-3 w-3" /> {signatureCount} signaturer
            </span>
            <span>{placeholderCount} felt</span>
          </div>

          {sections.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-xs">
              Ingen seksjoner i dokumentet.
            </p>
          ) : (
            sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.pos)}
                className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors"
              >
                <span
                  className={`inline-flex h-5 items-center rounded-sm px-1.5 text-[10px] font-medium ${
                    CATEGORY_COLORS[section.category] || CATEGORY_COLORS.general
                  }`}
                >
                  {section.category}
                </span>
                <span className="truncate">{section.title}</span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
